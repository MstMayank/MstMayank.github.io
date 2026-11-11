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
test('XI has no more than four overseas; released and pool players never contribute',async()=>{const s=await session();s.decisions=Object.fromEntries(s.squad.map(m=>[m.playerId,'RETAIN']));const released=s.squad[0];s.decisions[released.playerId]='RELEASE';const before=JSON.stringify(s);const r=rateSquad(s,data.records);assert.ok(r.xi.length<=11);assert.ok(r.xi.filter(m=>m.isOverseas).length<=4);assert.ok(!r.xi.some(m=>m.playerId===released.playerId));assert.ok(r.xi.every(m=>!s.auctionPool?.some(p=>p.playerId===m.playerId)));assert.equal(JSON.stringify(s),before);assert.ok(r.total===null||r.total>=0&&r.total<=100);});
test('empty and incomplete cores remain provisional and undo removes contribution',async()=>{const s=await session();assert.equal(rateSquad(s,data.records).retained,0);s.decisions[s.squad[0].playerId]='RETAIN';const r=rateSquad(s,data.records);assert.equal(r.retained,1);assert.ok(r.provisional);assert.ok(r.gaps.some(x=>x.includes('/11')));delete s.decisions[s.squad[0].playerId];assert.equal(rateSquad(s,data.records).retained,0);});
