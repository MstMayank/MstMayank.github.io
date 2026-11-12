import type {SessionView} from '../types';
import {RATING_CONFIG,type RatingConfig,type XIConstraints} from './config';
import {known,mean,playerRatings,seasonWeighted,shrink} from './players';
import {selectLegalXI,type Candidate} from './xi';
import type {PlayerRating,RatingDataset,Phase} from './types';
export type Contract={playerId:string;salaryLakh:number};
const performance=(p:PlayerRating)=>p.allRounder?mean([p.batting,p.bowling].filter(known)):p.bowlingOption&&!p.battingOption?p.bowling:p.batting;
function weighted(players:Candidate[],get:(p:PlayerRating)=>number|null){let numerator=0,denominator=0,count=0;for(const p of players){const value=get(p.rating);if(!known(value))continue;const reliability=Math.max(.05,p.rating.confidence/100);numerator+=value*reliability;denominator+=reliability;count++;}return {score:denominator?numerator/denominator:null,coverage:players.length?count/players.length:0};}
function percentile(v:number,values:number[]){return values.length?100*(values.filter(x=>x<v).length+.5*values.filter(x=>x===v).length)/values.length:null;}
export function ownedCandidates(session:SessionView,ratings:Map<string,PlayerRating>):Candidate[]{
 const retained=session.squad.filter(m=>m.eligible&&session.decisions[m.playerId]==='RETAIN').map(m=>({id:m.playerId,isOverseas:m.isOverseas,player:m.player,priceLakh:m.salaryVerified?m.previousSalaryLakh:null}));
 const purchased=(session.ratingPurchases??[]).map(m=>({id:m.player.id,isOverseas:m.isOverseas,player:m.player,priceLakh:m.salaryVerified?m.priceLakh:null}));
 const members=[...retained,...purchased];if(new Set(members.map(p=>p.id)).size!==members.length)throw Error('Duplicate owned player: a player cannot be retained and purchased twice.');
 return members.map(m=>{const rating=ratings.get(m.id);if(!rating)throw Error(`Player ${m.player.name} is not identified in the IPL rating catalogue.`);if(m.priceLakh!==null&&(!Number.isFinite(m.priceLakh)||m.priceLakh<=0))throw Error('Invalid purchase/contract cost.');return {id:m.id,isOverseas:m.isOverseas,rating,priceLakh:m.priceLakh};});
}
// Compare pooled team rates with the same season's IPL rates.
function teamImpact(members:Candidate[],dataset:RatingDataset,config:RatingConfig,batting:boolean){
 const ids=new Set(members.map(member=>member.id));
 const seasons=dataset.seasons.map(({year})=>{
  const league=dataset.records.filter(record=>record.year===year);
  const squad=league.filter(record=>ids.has(record.playerId));
  const sum=(rows:typeof league,key:keyof typeof league[number]['totals'])=>rows.reduce((total,row)=>total+row.totals[key],0);
  const balls=batting?'balls':'legalBalls',runs=batting?'runs':'conceded',wickets=batting?'outs':'wickets';
  const sample=sum(squad,balls),baseline=sum(league,balls);
  const leagueRuns=sum(league,runs),leagueWickets=sum(league,wickets);
  if(!sample||!baseline||!leagueRuns||!leagueWickets)return {year,value:null};
  const runImpact=sum(squad,runs)/sample/(leagueRuns/baseline);
  const wicketImpact=sum(squad,wickets)/sample/(leagueWickets/baseline);
  const relative=batting?runImpact-wicketImpact:wicketImpact-runImpact;
  const raw=Math.max(0,Math.min(100,50+50*relative));
  return {year,value:shrink(raw,sample,batting?config.sample.battingBalls:config.sample.bowlingBalls)};
 });
 const result=seasonWeighted(seasons,config);
 return {score:result.score,coverage:result.coverage};
}
function assessment(members:Candidate[],all:Candidate[],xiIds:string[],scope:'XI'|'SQUAD',valueCohort:number[],config:RatingConfig,rules:XIConstraints,dataset:RatingDataset){
 const bats=members.filter(p=>p.rating.battingOption),bowls=members.filter(p=>p.rating.bowlingOption);const baseBat=teamImpact(members,dataset,config,true),baseBowl=teamImpact(members,dataset,config,false),form=weighted(members,p=>p.form),experience=weighted(members,p=>p.experience);
 const phaseScore=(phase:Phase)=>{const b=weighted(bats,p=>p.phase[phase].batting),w=weighted(bowls,p=>p.phase[phase].bowling);return {score:mean([b.score,w.score].filter(known)),coverage:(b.coverage+w.coverage)/2};};
 const meet=(n:number,target:number)=>target>0?Math.min(1,n/target):1;const bw=config.balanceWeights;
 const balance=members.length?100*(bw.batting*meet(bats.length,rules.minBattingOptions)+bw.bowling*meet(bowls.length,rules.minBowlingOptions)+bw.keeper*meet(members.filter(m=>m.rating.keeper).length,rules.minKeepers)+bw.openers*meet(bats.filter(m=>m.rating.batRole==='OPENER').length,config.targets.openers)+bw.finishers*meet(bats.filter(m=>m.rating.batRole==='FINISHER').length,config.targets.finishers)):null;
 const classified=bowls.filter(m=>m.rating.style!=='UNKNOWN');const spinPace=classified.length?50*Math.min(1,classified.filter(m=>m.rating.style==='PACE').length/config.targets.pace)+50*Math.min(1,classified.filter(m=>m.rating.style==='SPIN').length/config.targets.spin):null;
 const bench=scope==='SQUAD'&&xiIds.length?all.filter(m=>!xiIds.includes(m.id)):[];const benchEvidence=bench.filter(p=>p.rating.matches>0);const backup=benchEvidence.length?100*(Math.min(1,benchEvidence.filter(p=>p.rating.battingOption).length/2)+Math.min(1,benchEvidence.filter(p=>p.rating.bowlingOption).length/2)+Math.min(1,benchEvidence.filter(p=>p.rating.keeper).length))/3:null;const benchCoverage=bench.length?benchEvidence.length/bench.length:1;const quantity=Math.min(100,bench.length/config.targets.bench*100);
 const depth=scope==='XI'||!xiIds.length?null:bench.length?mean([quantity,backup].filter(known)):0;
 const values=members.flatMap(m=>{const p=performance(m.rating);return !known(p)||!m.priceLakh?[]:[percentile(p/Math.sqrt(m.priceLakh),valueCohort)];}).filter(known);
 const value=mean(values);
 const defs=[['batting','Batting strength',baseBat,'Combined squad scoring and dismissal rates against the IPL season baseline.'],['bowling','Bowling strength',baseBowl,'Combined squad economy and wicket-taking rates against the IPL season baseline.'],['balance','Squad balance',{score:balance,coverage:members.length?1:0},'Configured keeper, batting, bowling, opener and finisher coverage; these balance targets are simulation assumptions.'],['form','Recent IPL form',form,'IPL contribution frequency with 2024/25/26 weights of 20/30/50; distinct from the rate-quality groups.'],['death','Death overs',phaseScore('DEATH'),'Verified scheduled overs 16–20; batting and bowling suitability shown separately per player.'],['depth','Squad depth',{score:depth,coverage:scope==='XI'?0:xiIds.length?bench.length?(.5+.5*benchCoverage):1:0},scope==='XI'?'Not applicable to Starting XI; its applicable 90 points are normalised to 100.':'Bench quantity (target five) and evidence-backed backup-role coverage outside the optimal XI; rate quality is not added a second time.'],['experience','IPL experience',experience,'Verified IPL appearances within 2025–2026 only; capped at 40. Not a full-career total.'],['powerplay','Powerplay performance',phaseScore('POWERPLAY'),'Verified scheduled overs 1–6; no inference from domestic or international matches.'],['spinPace','Spin/pace balance',{score:spinPace,coverage:bowls.length?classified.length/bowls.length:0},'Three pace and one spin option target; missing style classifications lower coverage.'],['value','Auction value',{score:value,coverage:members.length?values.length/members.length:0},'IPL role performance per square-root of published/verified acquisition cost; percentile against the roster cost cohort.']] as const;
 const components=defs.filter(([id])=>config.teamWeights[id]>0).map(([id,name,value,explanation])=>({id,name,weight:config.teamWeights[id],score:value.score,points:value.score===null?null:value.score*config.teamWeights[id]/100,coverage:Math.round(value.coverage*100),explanation}));
 const applicableWeight=scope==='XI'||!xiIds.length?100-config.teamWeights.depth:100;const assessedWeight=components.reduce((n,c)=>n+(c.score===null?0:c.weight),0);const hasPerformance=members.some(m=>known(performance(m.rating)));
 const total=hasPerformance&&assessedWeight?Math.round(components.reduce((n,c)=>n+(c.points??0),0)/assessedWeight*100):null;
 const sourceConfidence=members.length?members.reduce((n,p)=>n+p.rating.confidence,0)/members.length:0;
 const metricCoverage=components.reduce((n,c)=>n+c.weight*c.coverage/100,0)/applicableWeight;
 return {total,components,applicableWeight,assessedWeight,confidence:Math.round(sourceConfidence*metricCoverage),provisional:members.length<rules.size||assessedWeight<applicableWeight||metricCoverage<.95||sourceConfidence<70,players:members.length,covered:members.filter(m=>known(performance(m.rating))).length};
}
export function createRatingEngine(dataset:RatingDataset,contracts:Contract[]=[],config:RatingConfig=RATING_CONFIG){
 const ratings=playerRatings(dataset,config);const valueCohort=contracts.flatMap(c=>{const p=ratings.get(c.playerId);const score=p?performance(p):null;return known(score)&&c.salaryLakh>0?[score/Math.sqrt(c.salaryLakh)]:[];});
 return (session:SessionView)=>{
  const owned=ownedCandidates(session,ratings);const rules:XIConstraints={...config.xi,...session.rules.playingXI};const selection=selectLegalXI(owned,rules);const selected=owned.filter(c=>selection.ids.includes(c.id));
  const fullSquad=assessment(owned,owned,selection.ids,'SQUAD',valueCohort,config,rules,dataset);const startingXI=selection.status==='LEGAL'?assessment(selected,owned,selection.ids,'XI',valueCohort,config,rules,dataset):null;
  const weaknesses:string[]=[];if(selection.reason)weaknesses.push(selection.reason);if(selected.some(p=>!known(performance(p.rating))))weaknesses.push('The evaluated XI includes unrated players. A disclosed neutral prior of 50 is used only for selection utility, not as a player performance score.');if(!owned.some(p=>p.rating.keeper))weaknesses.push('No wicketkeeper in the owned squad.');
  for(const phase of ['POWERPLAY','DEATH'] as const){if(!owned.some(p=>p.rating.bowlingOption&&known(p.rating.phase[phase].bowling)))weaknesses.push(`No verified ${phase.toLowerCase()} bowling evidence.`);}
  if(owned.some(p=>p.rating.bowlingOption&&p.rating.style==='UNKNOWN'))weaknesses.push('Some bowling styles are unclassified; spin/pace balance is provisional.');
  if(fullSquad.covered<owned.length)weaknesses.push(`${owned.length-fullSquad.covered} owned players have no usable IPL performance sample; they are not assigned zero ability.`);
  for(const c of fullSquad.components)if(c.score!==null&&c.score<40&&c.coverage>=75)weaknesses.push(`${c.name} is below the model benchmark (${Math.round(c.score)}/100; ${c.coverage}% metric coverage).`);
  return {version:config.version,seasonWeights:config.seasonWeights,seasons:dataset.seasons,source:dataset.source,checkedAt:dataset.checkedAt,fullSquad,startingXI,selection:{...selection,players:selected.map(p=>({id:p.id,name:p.rating.name,isOverseas:p.isOverseas}))},players:owned.map(p=>({...p.rating,isOverseas:p.isOverseas,priceLakh:p.priceLakh})),weaknesses,excludedMatches:dataset.excludedMatches,provenance:{licence:dataset.licence,normalisation:'Role and season cohorts; incomplete cohorts stay unavailable.',selection:'Exact maximum additive quality utility, not a greedy choice or a proven match-winning XI.'}};
 };
}
export function rateSquad(session:SessionView,dataset:RatingDataset,contracts:Contract[]=[],config:RatingConfig=RATING_CONFIG){return createRatingEngine(dataset,contracts,config)(session);}
