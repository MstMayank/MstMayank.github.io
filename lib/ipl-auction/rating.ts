import type {SessionView} from './types';
export type SeasonRecord={playerId:string;year:number;audit:{runs:number;balls:number;outs:number;wickets:number;conceded:number;legalBalls:number}};
export type RatedPlayer={id:string;bat:number|null;bowl:number|null;balls:number;legalBalls:number};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const percentile=(value:number,cohort:number[],lower=false)=>{const rank=cohort.filter(x=>lower?x>value:x<value).length+cohort.filter(x=>x===value).length/2;return cohort.length?rank/cohort.length*100:50;};
export function playerRatings(records:SeasonRecord[]):Map<string,RatedPlayer>{
 const sums=new Map<string,{runs:number;balls:number;outs:number;wickets:number;conceded:number;legalBalls:number}>();
 for(const r of records){if(r.year<2021||r.year>2026)continue;const s=sums.get(r.playerId)??{runs:0,balls:0,outs:0,wickets:0,conceded:0,legalBalls:0};const weight=r.year-2020;for(const k of Object.keys(s) as Array<keyof typeof s>)s[k]+=r.audit[k]*weight/6;sums.set(r.playerId,s);}
 const bats=[...sums.values()].filter(s=>s.balls>=60),bowls=[...sums.values()].filter(s=>s.legalBalls>=60);
 return new Map([...sums].map(([id,s])=>[id,{id,balls:s.balls,legalBalls:s.legalBalls,bat:s.balls<60?null:percentile(s.runs/s.balls,bats.map(x=>x.runs/x.balls))*.55+percentile(s.runs/Math.max(1,s.outs),bats.map(x=>x.runs/Math.max(1,x.outs)))*.45,bowl:s.legalBalls<60?null:percentile(s.conceded/s.legalBalls,bowls.map(x=>x.conceded/x.legalBalls),true)*.5+percentile(s.wickets/s.legalBalls,bowls.map(x=>x.wickets/x.legalBalls))*.5}]));
}
export function rateSquad(session:SessionView,records:SeasonRecord[]){
 const members=session.squad.filter(m=>session.decisions[m.playerId]==='RETAIN');const ratings=playerRatings(records);
 const quality=(m:typeof members[number])=>Math.max(ratings.get(m.playerId)?.bat??0,ratings.get(m.playerId)?.bowl??0);
 const ranked=[...members].sort((a,b)=>quality(b)-quality(a)||a.playerId.localeCompare(b.playerId));
 const xi:typeof members=[];const add=(m:typeof members[number])=>{if(xi.length>=11||xi.some(x=>x.playerId===m.playerId)||m.isOverseas&&xi.filter(x=>x.isOverseas).length>=4)return;xi.push(m);};
 const isBowl=(m:typeof members[number])=>['BOWLER','ALL_ROUNDER'].includes(m.player.role)||(ratings.get(m.playerId)?.legalBalls??0)>=120;const isAllRound=(m:typeof members[number])=>m.player.role==='ALL_ROUNDER'||(ratings.get(m.playerId)?.balls??0)>=300&&(ratings.get(m.playerId)?.legalBalls??0)>=120;const isBat=(m:typeof members[number])=>m.player.role!=='BOWLER';
 ranked.filter(m=>m.player.role==='WICKETKEEPER').slice(0,1).forEach(add);
 ranked.filter(isBowl).forEach(m=>{if(xi.filter(isBowl).length<5)add(m);});ranked.filter(isBat).forEach(add);ranked.forEach(add);
 const batting=xi.filter(isBat).map(m=>ratings.get(m.playerId)?.bat).filter((x):x is number=>x!=null);
 const bowling=xi.filter(isBowl).map(m=>ratings.get(m.playerId)?.bowl).filter((x):x is number=>x!=null);
 const components=[{name:'Batting',max:25,score:mean(batting)===null?null:mean(batting)!*.25},{name:'Bowling',max:25,score:mean(bowling)===null?null:mean(bowling)!*.25},{name:'XI balance',max:20,score:10*Math.min(1,xi.filter(isBat).length/6)+10*Math.min(1,xi.filter(isBowl).length/5)},{name:'All-round options',max:10,score:Math.min(10,xi.filter(isAllRound).length*5)},{name:'Wicketkeeper',max:10,score:xi.some(m=>m.player.role==='WICKETKEEPER')?10:0},{name:'Bench depth',max:10,score:Math.min(10,Math.max(0,members.length-xi.length)/7*10)}];
 const covered=members.filter(m=>{const r=ratings.get(m.playerId);return r?.bat!=null||r?.bowl!=null;}).length;
 const batTotal=xi.filter(isBat).length,bowlTotal=xi.filter(isBowl).length;
 const sample=mean(xi.map(m=>{const r=ratings.get(m.playerId);return Math.min(1,Math.max((r?.balls??0)/300,(r?.legalBalls??0)/120));}))??0;
 const gaps:string[]=[];if(xi.length<11)gaps.push(`Only ${xi.length}/11 players fit an XI with at most four overseas players.`);if(!xi.some(m=>m.player.role==='WICKETKEEPER'))gaps.push('No wicketkeeper in the suggested XI.');if(bowlTotal<5)gaps.push('Fewer than five bowling options.');if(batting.length<batTotal||bowling.length<bowlTotal)gaps.push('Some XI players lack enough archived IPL deliveries; performance components use only rated players.');
 const total=components.some(c=>c.score===null)?null:Math.round(components.reduce((n,c)=>n+c.score!,0));
 return {total,components,xi,retained:members.length,covered,confidence:Math.round(sample*100),provisional:xi.length<11||sample<.7||batting.length<batTotal||bowling.length<bowlTotal,gaps,battingRated:batting.length,batTotal,bowlingRated:bowling.length,bowlTotal};
}
