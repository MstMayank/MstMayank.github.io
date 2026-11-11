import { z } from 'zod';
export const ruleSchema=z.object({purseLakh:z.number().int().positive().max(1_000_000),maxRetentions:z.number().int().min(1).max(100),maxOverseas:z.number().int().min(0).max(100),requirePublishedSalary:z.boolean().optional(),costMode:z.enum(['TIERS','SALARY']).optional(),retentionTiersLakh:z.array(z.number().int().positive()).max(100)}).strict().refine(r=>(r.costMode==='SALARY'||r.retentionTiersLakh.length>=r.maxRetentions)&&r.maxOverseas<=r.maxRetentions,'Invalid rule tiers or overseas limit');
export type Rules=z.infer<typeof ruleSchema>;
export const DEMO_RULES:Rules={purseLakh:12000,maxRetentions:6,maxOverseas:3,retentionTiersLakh:[1800,1400,1100,800,600,400]};
export const SALARY_RULES:Rules={purseLakh:12000,maxRetentions:100,maxOverseas:100,retentionTiersLakh:[],costMode:'SALARY'};
export const PUBLISHED_SALARY_RULES:Rules={...SALARY_RULES,requirePublishedSalary:true};
export type Action='RETAIN'|'RELEASE';
export type SquadMember={playerId:string;eligible:boolean;isOverseas:boolean;previousSalaryLakh?:number|null;salaryVerified?:boolean;customSalaryLakh?:number|null};
export class GameError extends Error{constructor(message:string,public status=400){super(message);}}
export function retentionSalary(member:SquadMember){
 const cost=member.salaryVerified?member.previousSalaryLakh:member.customSalaryLakh;
 if(!Number.isSafeInteger(cost)||cost!<=0)throw new GameError('Enter a positive custom simulation salary in lakh before retaining this player.');
 return cost!;
}
export function calculate(rules:Rules,squad:SquadMember[],decisions:Record<string,Action>){
  ruleSchema.parse(rules);
  const ids=new Set(squad.map(p=>p.playerId));
  if(ids.size!==squad.length)throw new GameError('Duplicate player in squad.');
  for(const [id,action] of Object.entries(decisions)){
    if(!ids.has(id)||!squad.find(p=>p.playerId===id)?.eligible)throw new GameError('Player is not eligible in this squad.');
    if(!['RETAIN','RELEASE'].includes(action))throw new GameError('Invalid retention action.');
  }
  const retained=squad.filter(p=>decisions[p.playerId]==='RETAIN');
  if(rules.costMode!=='SALARY'&&retained.length>rules.maxRetentions)throw new GameError('Retention slots are full.');
  const overseas=retained.filter(p=>p.isOverseas).length;
  if(rules.costMode!=='SALARY'&&overseas>rules.maxOverseas)throw new GameError('Overseas retention limit reached.');
  if(rules.requirePublishedSalary&&retained.some(p=>!p.salaryVerified))throw new GameError('Published salary unavailable for this player.');
  const spentLakh=rules.costMode==='SALARY'?retained.reduce((sum,p)=>sum+retentionSalary(p),0):rules.retentionTiersLakh.slice(0,retained.length).reduce((sum,cost)=>sum+cost,0);
  if(spentLakh>rules.purseLakh)throw new GameError('Insufficient purse for this retention.');
  const released=squad.filter(p=>decisions[p.playerId]==='RELEASE').length;
  return {spentLakh,remainingLakh:rules.purseLakh-spentLakh,retained:retained.length,released,overseas,undecided:squad.filter(p=>p.eligible&&!decisions[p.playerId]).length,slotsLeft:(rules.costMode==='SALARY'?squad.filter(p=>p.eligible).length:rules.maxRetentions)-retained.length,nextCostLakh:rules.costMode==='SALARY'?null:rules.retentionTiersLakh[retained.length]??null};
}
export function applyDecision(rules:Rules,squad:SquadMember[],decisions:Record<string,Action>,playerId:string,action:Action|'UNDO',state:string){
  if(state!=='RETENTION')throw new GameError('Retentions are locked. Start a new simulation to try again.',409);
  if(!squad.some(p=>p.playerId===playerId&&p.eligible))throw new GameError('Player is not eligible in this squad.');
  const next={...decisions};if(action==='UNDO')delete next[playerId];else next[playerId]=action;
  calculate(rules,squad,next);return next;
}
export function confirmRetentions(rules:Rules,squad:SquadMember[],decisions:Record<string,Action>,state:string){
  if(state!=='RETENTION')throw new GameError('This session is already locked.',409);
  const totals=calculate(rules,squad,decisions);
  if(totals.undecided>0)throw new GameError('Choose Retain or Release for every eligible player before confirming.');
  return totals;
}
