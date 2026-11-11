import type {SessionView} from './types';
export type SeasonRecord={playerId:string;year:number;audit:{runs:number;balls:number;outs:number;wickets:number;conceded:number;legalBalls:number}};
export type ConsistencyRecord={playerId:string;year:number;battingInnings:number;battingSuccess:number;bowlingInnings:number;bowlingSuccess:number};
export type Contract={playerId:string;salaryLakh:number;role:string};
export type RatedPlayer={id:string;bat:number|null;bowl:number|null;balls:number;legalBalls:number};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const known=(x:number|null|undefined):x is number=>x!=null;
const percentile=(value:number,cohort:number[],lower=false)=>{const rank=cohort.filter(x=>lower?x>value:x<value).length+cohort.filter(x=>x===value).length/2;return cohort.length?rank/cohort.length*100:50;};
export function playerRatings(records:SeasonRecord[],recent=false):Map<string,RatedPlayer>{
 const sums=new Map<string,{runs:number;balls:number;outs:number;wickets:number;conceded:number;legalBalls:number}>();
 for(const r of records){if(r.year<(recent?2025:2021)||r.year>2026)continue;const s=sums.get(r.playerId)??{runs:0,balls:0,outs:0,wickets:0,conceded:0,legalBalls:0};const weight=recent?(r.year===2026?1:.5):(r.year-2020)/6;for(const k of Object.keys(s) as Array<keyof typeof s>)s[k]+=r.audit[k]*weight;sums.set(r.playerId,s);}
 const bats=[...sums.values()].filter(s=>s.balls>=60),bowls=[...sums.values()].filter(s=>s.legalBalls>=60);
 return new Map([...sums].map(([id,s])=>[id,{id,balls:s.balls,legalBalls:s.legalBalls,bat:s.balls<60?null:percentile(s.runs/s.balls,bats.map(x=>x.runs/x.balls))*.55+percentile(s.runs/Math.max(1,s.outs),bats.map(x=>x.runs/Math.max(1,x.outs)))*.45,bowl:s.legalBalls<60?null:percentile(s.conceded/s.legalBalls,bowls.map(x=>x.conceded/x.legalBalls),true)*.5+percentile(s.wickets/s.legalBalls,bowls.map(x=>x.wickets/x.legalBalls))*.5}]));
}
const quality=(r:RatedPlayer|undefined,role:string)=>role==='BOWLER'?r?.bowl??null:role==='ALL_ROUNDER'?mean([r?.bat,r?.bowl].filter(known)):r?.bat??null;
function consistencyRatings(records:ConsistencyRecord[]){
 const sums=new Map<string,{battingInnings:number;battingSuccess:number;bowlingInnings:number;bowlingSuccess:number}>();
 for(const r of records){if(r.year<2021||r.year>2026)continue;const s=sums.get(r.playerId)??{battingInnings:0,battingSuccess:0,bowlingInnings:0,bowlingSuccess:0};for(const k of Object.keys(s) as Array<keyof typeof s>)s[k]+=r[k]*(r.year-2020)/6;sums.set(r.playerId,s);}
 const bat=[...sums.values()].filter(x=>x.battingInnings>=8).map(x=>(x.battingSuccess+2)/(x.battingInnings+4));const bowl=[...sums.values()].filter(x=>x.bowlingInnings>=8).map(x=>(x.bowlingSuccess+2)/(x.bowlingInnings+4));
 return new Map([...sums].map(([id,s])=>[id,{id,balls:0,legalBalls:0,bat:s.battingInnings<8?null:percentile((s.battingSuccess+2)/(s.battingInnings+4),bat),bowl:s.bowlingInnings<8?null:percentile((s.bowlingSuccess+2)/(s.bowlingInnings+4),bowl)}]));
}
export function rateSquad(session:SessionView,records:SeasonRecord[],consistency:ConsistencyRecord[]=[],contracts:Contract[]=[]){
 const members=session.squad.filter(m=>m.eligible&&session.decisions[m.playerId]==='RETAIN');const ratings=playerRatings(records),recent=playerRatings(records,true),consistent=consistencyRatings(consistency);
 const isBowl=(m:typeof members[number])=>['BOWLER','ALL_ROUNDER'].includes(m.player.role)||(ratings.get(m.playerId)?.legalBalls??0)>=120;const isBat=(m:typeof members[number])=>m.player.role!=='BOWLER';
 const bats=members.filter(isBat),bowls=members.filter(isBowl);
 const batting=bats.map(m=>ratings.get(m.playerId)?.bat).filter(known),bowling=bowls.map(m=>ratings.get(m.playerId)?.bowl).filter(known);
 const recentScores=members.map(m=>quality(recent.get(m.playerId),m.player.role)).filter(known);
 const consistencyScores=members.map(m=>quality(consistent.get(m.playerId),m.player.role)).filter(known);
 const cohort=contracts.length?contracts:session.squad.filter(m=>m.salaryVerified&&m.previousSalaryLakh!=null).map(m=>({playerId:m.playerId,salaryLakh:m.previousSalaryLakh!,role:m.player.role}));
 const valueRatios=cohort.flatMap(c=>{const q=quality(ratings.get(c.playerId),c.role);return q===null||c.salaryLakh<=0?[]:[q/Math.sqrt(c.salaryLakh)];});
 const valueScores=members.flatMap(m=>{const q=quality(ratings.get(m.playerId),m.player.role);return q===null||!m.salaryVerified||!m.previousSalaryLakh||m.previousSalaryLakh<=0?[]:[percentile(q/Math.sqrt(m.previousSalaryLakh),valueRatios)];});
 const roleScore=members.length?6*Math.min(1,bats.length/Math.max(1,Math.ceil(members.length*.5)))+6*Math.min(1,bowls.length/Math.max(1,Math.ceil(members.length*.4)))+(members.some(m=>m.player.role==='WICKETKEEPER')?3:0):null;
 const component=(name:string,max:number,values:number[])=>({name,max,score:mean(values)===null?null:mean(values)!*max/100});
 const components=[component('Recent IPL form',30,recentScores),component('Batting strength',20,batting),component('Bowling strength',20,bowling),{name:'Role coverage',max:15,score:roleScore},component('Match consistency',10,consistencyScores),component('Value for money',5,valueScores)];
 const performanceCovered=members.filter(m=>quality(ratings.get(m.playerId),m.player.role)!==null).length;
 const assessedWeight=components.reduce((n,c)=>n+(c.score===null?0:c.max),0);
 const total=!performanceCovered?null:Math.round(components.reduce((n,c)=>n+(c.score??0),0)/assessedWeight*100);
 const sample=mean(members.map(m=>{const r=ratings.get(m.playerId);return Math.min(1,Math.max((r?.balls??0)/300,(r?.legalBalls??0)/120));}))??0;
 const coverage=members.length?performanceCovered/members.length:0;
 const disciplineCoverage=bats.length+bowls.length?(batting.length+bowling.length)/(bats.length+bowls.length):0;
 const confidence=Math.round(sample*Math.min(coverage,disciplineCoverage)*assessedWeight);
 const gaps:string[]=[];
 if(members.length&&!members.some(m=>m.player.role==='WICKETKEEPER'))gaps.push('No wicketkeeper in your retained core.');
 if(!bowls.length&&members.length)gaps.push('No bowling options in your retained core.');
 if(batting.length<bats.length||bowling.length<bowls.length)gaps.push('Some retained players lack enough archived deliveries. Missing samples reduce confidence, not player ability.');
 if(assessedWeight<100&&members.length)gaps.push(`Available components cover ${assessedWeight}/100 of the model. Overall score is rescaled over those components; unavailable components are not scored zero.`);
 return {total,components,retained:members.length,covered:performanceCovered,confidence,assessedWeight,provisional:members.length<3||confidence<70||assessedWeight<100||coverage<1||disciplineCoverage<1,gaps,battingRated:batting.length,batTotal:bats.length,bowlingRated:bowling.length,bowlTotal:bowls.length,recentRated:recentScores.length,consistencyRated:consistencyScores.length,valueRated:valueScores.length};
}
