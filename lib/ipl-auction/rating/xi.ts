import {RATING_CONFIG,type XIConstraints} from './config';
import type {PlayerRating} from './types';
export type Candidate={id:string;isOverseas:boolean;rating:PlayerRating;priceLakh:number|null};
export type XISelection={status:'LEGAL'|'INCOMPLETE';ids:string[];utility:number|null;rules:XIConstraints;reason:string|null};
export function selectLegalXI(candidates:Candidate[],rules:XIConstraints=RATING_CONFIG.xi):XISelection{
 if(new Set(candidates.map(c=>c.id)).size!==candidates.length)throw Error('Duplicate owned player.');
 for(const n of Object.values(rules))if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid Playing XI rules.');
 if(!rules.size||rules.maxOverseas>rules.size||rules.minKeepers>rules.size||rules.minBattingOptions>rules.size||rules.minBowlingOptions>rules.size)throw Error('Invalid Playing XI constraints.');
 type State={count:number;overseas:number;keepers:number;bats:number;bowls:number;utility:number;ids:string[]};
 const key=(s:State)=>[s.count,s.overseas,s.keepers,s.bats,s.bowls].join(':');let states=new Map<string,State>();const empty={count:0,overseas:0,keepers:0,bats:0,bowls:0,utility:0,ids:[]};states.set(key(empty),empty);
 // Exact 0/1 dynamic programme: optimal additive selection utility under configured constraints.
 // Capped coverage counts retain every fact needed by later candidates, so no greedy pruning occurs.
 for(const c of [...candidates].sort((a,b)=>a.id.localeCompare(b.id))){const next=new Map(states);
  for(const s of states.values()){if(s.count>=rules.size||s.overseas+Number(c.isOverseas)>rules.maxOverseas)continue;const n:State={count:s.count+1,overseas:s.overseas+Number(c.isOverseas),keepers:Math.min(rules.minKeepers,s.keepers+Number(c.rating.keeper)),bats:Math.min(rules.minBattingOptions,s.bats+Number(c.rating.battingOption)),bowls:Math.min(rules.minBowlingOptions,s.bowls+Number(c.rating.bowlingOption)),utility:s.utility+c.rating.selectionQuality,ids:[...s.ids,c.id]};const old=next.get(key(n));if(!old||n.utility>old.utility+1e-9)next.set(key(n),n);}
  states=next;
 }
 const best=[...states.values()].filter(s=>s.count===rules.size&&s.keepers>=rules.minKeepers&&s.bats>=rules.minBattingOptions&&s.bowls>=rules.minBowlingOptions).sort((a,b)=>b.utility-a.utility||a.ids.join().localeCompare(b.ids.join()))[0];
 return best?{status:'LEGAL' as const,ids:best.ids,utility:best.utility,rules,reason:null}:{status:'INCOMPLETE' as const,ids:[],utility:null,rules,reason:`A legal ${rules.size}-player XI needs at most ${rules.maxOverseas} overseas players, ${rules.minKeepers} keeper, ${rules.minBattingOptions} batting and ${rules.minBowlingOptions} bowling options. Your current owned squad cannot satisfy these configured rules.`};
}
