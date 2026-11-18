import test from 'node:test';
import assert from 'node:assert/strict';
import {start,validate,players,nextBid,teams,computerBid,tick,advance,placeBid,canBid} from '../browser-auction/game/engine';
import {miniAuction,miniPlan,MINI_PENDING} from '../browser-auction/game/mini-auction';
import {miniFixture} from './mini-auction-fixture';
test('confirmed releases can start while new registrations are pending',()=>{
 const game=start('rcb');assert.ok(validate(game));assert.equal(miniAuction.registrationsConfirmed,false);
 assert.equal(Object.values(game.squads).flat().length,184);assert.equal(game.queue.length,86);
 assert.equal(game.purses.rcb,1415);assert.equal(game.purses.lsg,4745);
 const config=miniFixture();config.status='pending';assert.throws(()=>start('rcb',config),new RegExp(MINI_PENDING));
 config.status='ready';config.registrationsConfirmed=false;assert.throws(()=>start('rcb',config),/Unconfirmed registrations/);
 config.registeredPlayers=[];assert.ok(validate(start('rcb',config),config));
});
test('pool is exactly confirmed releases plus registrations, excluding locked retentions',()=>{
 const config=miniFixture(),game=start('rcb',config);
 const expected=new Set([...config.releasedPlayers.map(p=>p.id),...config.registeredPlayers.map(p=>p.player.id)]);
 assert.deepEqual(new Set(game.queue),expected);assert.ok(game.queue.length<players.length);
 for(const [team,data] of Object.entries(config.teams)){
  assert.equal(game.purses[team],data.auctionPurseLakh);
  for(const p of data.retained){assert.ok(!game.queue.includes(p.id));assert.ok(game.squads[team].some(m=>m.id===p.id&&m.retained&&m.price===p.salaryLakh));}
 }
 assert.ok(validate(game,config));
});
test('retained players and duplicate rights cannot enter the auction pool',()=>{
 const config=miniFixture();config.releasedPlayers.push({id:config.teams.rcb.retained[0].id,basePriceLakh:30});assert.throws(()=>miniPlan(config),/retained player/);
 const duplicate=miniFixture();duplicate.teams.mi.retained=duplicate.teams.rcb.retained;assert.throws(()=>miniPlan(duplicate),/duplicate retained/);
});
test('registered base prices and official opening purses are used directly',()=>{
 const config=miniFixture();config.teams.rcb.auctionPurseLakh=2345;
 const game=start('rcb',config);assert.equal(game.purses.rcb,2345);
 game.index=game.queue.indexOf('test-new-registered');assert.equal(nextBid(game),30);
});
test('old full-auction saves and stale mini lists are rejected',()=>{
 const config=miniFixture(),game=start('rcb',config);
 assert.equal(validate({...game,version:1} as never,config),false);
 assert.equal(validate({...game,poolRevision:'old'},config),false);
 const tampered=structuredClone(game);tampered.squads.rcb=[];tampered.purses.rcb=game.budgets.rcb;
 assert.equal(validate(tampered,config),false);
});

test('every franchise can complete the published released-player auction without invalid state',()=>{
 for(const team of teams){
  let g={...start(team.id),paused:false};
  const excluded=players.filter(p=>['Mahendra Singh Dhoni','Ajinkya Rahane','Travis Head','Mitchell Starc'].includes(p.name)).map(p=>p.id);
  assert.ok(excluded.every(id=>!g.queue.includes(id)));
  let steps=0;
  while(g.stage!=='COMPLETE'&&steps++<20000){
   if(g.stage==='BIDDING'){
    if(!g.leader&&canBid(g,team.id))g=placeBid(g,team.id);
    g=tick(computerBid(g));
   }else g=advance(g);
   assert.ok(validate(g),team.id+' step '+steps);
  }
  assert.equal(g.stage,'COMPLETE');assert.equal(g.history.length,86);
 }
});
