import type {SessionView} from '../lib/ipl-auction/types';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,SAVE_KEY,teams,players} from '../browser-auction/store';
function setup(){const values=new Map<string,string>();return {values,store:createStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}})};}
const start=(store:ReturnType<typeof createStore>,team='csk')=>store.request('/api/ipl-auction/sessions',{method:'POST',body:JSON.stringify({seasonId:'ipl-2027-custom',franchiseId:team})}) as Promise<SessionView>;
test('all ten squads and reference player stats are available',()=>{assert.equal(teams.length,10);assert.equal(players.length,274);assert.ok(players.find(p=>p.name.includes('Dhoni'))?.internationalStats.length);});
test('save, reload, undo, confirm and latest-only replacement',async()=>{const {store,values}=setup();let s=await start(store);const url='/api/ipl-auction/sessions/'+s.id;const id=s.squad[0].playerId;const salary=s.squad[0].previousSalaryLakh;assert.notEqual(salary,null);
 s=await store.request(url+'/retention',{method:'PATCH',body:JSON.stringify({playerId:id,action:'RETAIN',revision:s.revision})}) as SessionView;assert.equal(s.totals.remainingLakh,12000-salary!);
 const reloaded=createStore({getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}});assert.deepEqual((await reloaded.request(url) as SessionView).decisions,s.decisions);
 s=await store.request(url+'/retention',{method:'PATCH',body:JSON.stringify({playerId:id,action:'UNDO',revision:s.revision})}) as SessionView;assert.equal(s.totals.remainingLakh,12000);
 await assert.rejects(()=>store.request(url+'/confirm',{method:'POST',body:JSON.stringify({revision:s.revision})}),/every eligible/);
 for(const member of s.squad)s=await store.request(url+'/retention',{method:'PATCH',body:JSON.stringify({playerId:member.playerId,action:'RELEASE',revision:s.revision})}) as SessionView;
 s=await store.request(url+'/confirm',{method:'POST',body:JSON.stringify({revision:s.revision})}) as SessionView;assert.equal(s.state,'CONFIRMED');
 await assert.rejects(()=>store.request(url+'/retention',{method:'PATCH',body:JSON.stringify({playerId:id,action:'UNDO',revision:s.revision})}),/locked/);
 await assert.rejects(()=>start(store,'fake'),/Invalid/);assert.equal((await store.request(url) as SessionView).id,s.id);
 const fresh=await start(store,'mi');assert.notEqual(fresh.id,s.id);assert.equal(values.size,1);assert.ok(values.has(SAVE_KEY));await assert.rejects(()=>store.request(url),/no longer/);
});
test('stale revisions, corrupt saves and storage failure are reported',async()=>{const {store,values}=setup();const s=await start(store);await assert.rejects(()=>store.request('/api/ipl-auction/sessions/'+s.id+'/retention',{method:'PATCH',body:JSON.stringify({revision:99})}),/another tab/);values.set(SAVE_KEY,'bad');await assert.rejects(()=>store.request('/api/ipl-auction/sessions'),/cannot be read/);const blocked=createStore({getItem:()=>null,setItem:()=>{throw Error();}});await assert.rejects(()=>start(blocked),/Unable to save/);});
