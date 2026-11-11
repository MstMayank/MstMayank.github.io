import {test}from 'node:test';
import assert from 'node:assert/strict';
import {shareSquadFile}from '../lib/ipl-auction/native-share';
const file=new File(['card'],'rcb-ipl-2027-squad.png',{type:'image/png'});
test('native image sharing is invoked during the click call, without waiting for rendering',async()=>{
 let called=false;let resolve!:()=>void;
 const pending=shareSquadFile(file,{canShare:data=>data.files?.[0]===file,share:data=>{called=true;assert.deepEqual(data.files,[file]);assert.equal(data.url,undefined);assert.equal(data.text,undefined);return new Promise<void>(r=>{resolve=r;});}});
 assert.equal(called,true);resolve();assert.equal(await pending,'');
});
test('unsupported browsers get a short message and no text/link sharing fallback',async()=>{
 let called=false;const message=await shareSquadFile(file,{canShare:()=>false,share:async()=>{called=true;}});assert.match(message,/not supported/);assert.equal(called,false);
 assert.match(await shareSquadFile(file,{}),/not supported/);
});
test('cancellation is quiet and sharing failures can be retried',async()=>{
 const adapter={canShare:()=>true,share:async()=>{throw Object.assign(new Error('cancel'),{name:'AbortError'});}};
 assert.equal(await shareSquadFile(file,adapter),'');
 assert.match(await shareSquadFile(file,{...adapter,share:async()=>{throw new Error('denied');}}),/again/);
});
