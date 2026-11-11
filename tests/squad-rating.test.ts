import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerRatings,rateSquad,type SeasonRecord} from '../lib/ipl-auction/rating';
import {createStore} from '../browser-auction/store';
import type {SessionView} from '../lib/ipl-auction/types';
import data from '../prisma/data/ipl-six-season-stats.json';
import roster from '../prisma/data/ipl-2026-reference-squads.json';
async function session(){const mem=new Map<string,string>();const store=createStore({getItem:k=>mem.get(k)??null,setItem:(k,v)=>{mem.set(k,v);}});return await store.request('/api/ipl-auction/sessions',{method:'POST',body:JSON.stringify({seasonId:'ipl-2027-custom',franchiseId:'csk'})}) as SessionView;}
test('six-season leaders and unique player-season provenance reconcile',()=>{
 const players=Object.values(roster.teams).flatMap(t=>t.players);const get=(name:string,year:number)=>data.records.find(r=>r.playerId===players.find(p=>p.name===name)!.id&&r.year===year)!;
 assert.equal(get('Ruturaj Gaikwad',2021).runs,635);assert.equal(get('Harshal Patel',2021).wickets,32);assert.equal(get('Jos Buttler',2022).runs,863);assert.equal(get('Yuzvendra Chahal',2022).wickets,27);assert.equal(get('Shubman Gill',2023).runs,890);assert.equal(get('Mohammad Shami',2023).wickets,28);
 assert.equal(new Set(data.records.map(r=>`${r.playerId}:${r.year}`)).size,data.records.length);
 for(const r of data.records){assert.ok(r.sourceUrl);assert.equal(r.runs,r.audit.runs);assert.equal(r.wickets,r.audit.wickets);}
});
test('missing samples stay unavailable, not zero ability',async()=>{const s=await session();s.decisions=Object.fromEntries(s.squad.map(m=>[m.playerId,'RETAIN']));const r=rateSquad(s,[]);assert.equal(r.total,null);assert.equal(r.confidence,0);assert.equal(r.components[0].score,null);assert.ok(r.provisional);});
test('recent performance gets more weight and meaningful samples outrank tiny samples',()=>{
 const record=(playerId:string,year:number,runs:number,balls:number):SeasonRecord=>({playerId,year,audit:{runs,balls,outs:10,wickets:0,conceded:0,legalBalls:0}});
 const r=playerRatings([record('recent',2021,100,100),record('recent',2026,300,100),record('older',2021,300,100),record('older',2026,100,100),record('tiny',2026,50,5)]);
 assert.ok(r.get('recent')!.bat!>r.get('older')!.bat!);assert.equal(r.get('tiny')!.bat,null);
});
test('all retained players count without XI or overseas cutoffs; released and pool stay excluded',async()=>{const s=await session();s.decisions=Object.fromEntries(s.squad.map(m=>[m.playerId,'RETAIN']));const released=s.squad[0];s.decisions[released.playerId]='RELEASE';for(const p of s.auctionPool??[])s.decisions[p.playerId]='RETAIN';const before=JSON.stringify(s);const r=rateSquad(s,data.records);assert.equal(r.retained,s.squad.length-1);assert.ok(!('xi' in r));assert.equal(JSON.stringify(s),before);assert.ok(r.total===null||r.total>=0&&r.total<=100);assert.deepEqual(r.components.map(c=>c.max),[30,20,20,15,10,5]);});
test('small core has no empty bench penalty; undo removes contributions',async()=>{const s=await session();assert.equal(rateSquad(s,data.records).retained,0);s.decisions[s.squad[0].playerId]='RETAIN';const r=rateSquad(s,data.records);assert.equal(r.retained,1);assert.ok(r.provisional);assert.ok(!r.components.some(c=>/bench|XI/.test(c.name)));delete s.decisions[s.squad[0].playerId];assert.equal(rateSquad(s,data.records).retained,0);});
test('franchise identity never changes scores and missing consistency is not zero',async()=>{const s=await session();s.decisions=Object.fromEntries(s.squad.map(m=>[m.playerId,'RETAIN']));const a=rateSquad(s,data.records);const b=rateSquad({...s,team:{...s.team,id:'rcb',name:'Royal Challengers Bengaluru'}},data.records);assert.deepEqual(a,b);assert.equal(a.components.find(c=>c.name==='Match consistency')!.score,null);assert.ok(a.assessedWeight<100);assert.ok(a.confidence<100);});
test('removing unavailable components rescales transparently and missing player data lowers confidence',async()=>{const s=await session();const p=s.squad[0];p.player.role='BATTER';s.squad=[p];s.decisions={[p.playerId]:'RETAIN'};const record:SeasonRecord={playerId:p.playerId,year:2026,audit:{runs:300,balls:200,outs:10,wickets:0,conceded:0,legalBalls:0}};const r=rateSquad(s,[record]);assert.equal(r.components.find(c=>c.name==='Bowling strength')!.score,null);const total=r.components.reduce((n,c)=>n+(c.score??0),0);assert.equal(r.total,Math.round(total/r.assessedWeight*100));const unknown={...p,playerId:'unknown',player:{...p.player,id:'unknown'}};const mixed=rateSquad({...s,squad:[p,unknown],decisions:{...s.decisions,unknown:'RETAIN'}},[record]);assert.ok(mixed.confidence<r.confidence);});
test('consistency uses real innings and reports unavailable below the sample threshold',async()=>{const s=await session();const p=s.squad[0];p.player.role='BATTER';s.squad=[p];s.decisions={[p.playerId]:'RETAIN'};const record:SeasonRecord={playerId:p.playerId,year:2026,audit:{runs:300,balls:200,outs:10,wickets:0,conceded:0,legalBalls:0}};const c={playerId:p.playerId,year:2026,battingInnings:10,battingSuccess:8,bowlingInnings:0,bowlingSuccess:0};assert.notEqual(rateSquad(s,[record],[c]).components[4].score,null);assert.equal(rateSquad(s,[record],[{...c,battingInnings:2,battingSuccess:2}]).components[4].score,null);});
test('common roster nicknames resolve to archived performance and match contributions',async()=>{
 const consistency=(await import('../prisma/data/ipl-rating-consistency.json')).default;
 const players=Object.values(roster.teams).flatMap(t=>t.players);
 for(const name of ['Pat Cummins','Phil Salt','Tim David','Bhuvneshwar Kumar','Ravindra Jadeja']){
  const p=players.find(p=>p.name===name)!;assert.ok(p);
  assert.ok(data.records.some(r=>r.playerId===p.id&&r.year<=2023),name+' historical performance');
  assert.ok(consistency.records.some(r=>r.playerId===p.id&&(r.battingInnings||r.bowlingInnings)),name+' consistency');
 }
});
