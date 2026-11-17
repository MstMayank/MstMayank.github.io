import {test} from 'node:test';
import assert from 'node:assert/strict';
import {start as engineStart,players,teams,canBid,placeBid,pass,tick,advance,computerBid,finishLot,validate as engineValidate,nextBid,findPlayer} from '../browser-auction/game/engine';

import {miniFixture} from './mini-auction-fixture';
const config=miniFixture();
const start=(team:string)=>engineStart(team,config);
const validate=(g:Parameters<typeof engineValidate>[0])=>engineValidate(g,config);

test('fresh auction has a unique pool, ten purses and starts paused',()=>{
  const g=start('rcb');
  assert.equal(g.paused,true);
  assert.equal(new Set(g.queue).size,Object.keys(g.entryPrices).length);
  assert.equal(Object.values(g.budgets).reduce((a,b)=>a+b,0),130000);
  assert.ok(validate(g));
  assert.equal(tick(g),g);
});
test('bid, counter, pass, sold and advance preserve budgets and ownership',()=>{
  let g={...start('rcb'),paused:false};
  g=placeBid(g,'rcb');
  assert.equal(g.leader,'rcb');
  assert.equal(placeBid(g,'rcb'),g);
  g=placeBid(g,'mi');
  assert.equal(g.leader,'mi');
  g=pass(g);
  assert.equal(canBid(g,'rcb'),false);
  const cost=g.bid,id=g.queue[0],opening=g.purses.mi,held=[...g.squads.mi];
  for(let i=0;i<8;i++)g=tick(g);
  assert.equal(g.stage,'SOLD');
  assert.equal(g.purses.mi,opening-cost);
  assert.deepEqual(g.squads.mi,[...held,{id,price:cost,retained:false}]);
  assert.ok(validate(g));
  assert.equal(tick(g),g);
  g=advance(g);
  assert.equal(g.index,1);assert.equal(g.bid,0);assert.equal(g.leader,null);
  assert.deepEqual(g.passed,[]);
});
test('minimum squad reserve and overseas limit block invalid bids',()=>{
  let g={...start('rcb'),paused:false};
  g.purses.rcb=500;
  assert.equal(canBid(g,'rcb'),false);
  g=start('rcb');g.paused=false;
  g.squads.rcb=players.filter(p=>p.isOverseas).slice(0,8).map(p=>({id:p.id,price:0,retained:true}));
  const overseas=players.find(p=>p.isOverseas&&!g.squads.rcb.some(m=>m.id===p.id))!;
  g.queue=[overseas.id];g.index=0;
  assert.equal(canBid(g,'rcb'),false);
  g.squads.rcb=players.slice(0,25).map(p=>({id:p.id,price:0,retained:true}));
  assert.equal(canBid(g,'rcb'),false);
});
test('retained roster excludes held players from the pool',()=>{
  const id=config.teams.rcb.retained[0].id;
  const g=start('rcb');
  assert.ok(g.squads.rcb.some(m=>m.id===id));
  assert.ok(!g.queue.includes(id));
  assert.ok(validate(g));
});
test('full simulated auction terminates with legal budgets and unique players',()=>{
  let g={...start('rcb'),paused:false},steps=0;
  while(g.stage!=='COMPLETE'&&steps++<25000){
    if(g.stage==='BIDDING'){
      if(canBid(g,'rcb')&&nextBid(g)<=(findPlayer(g.queue[g.index],g.registeredPlayers).salary??60))g=placeBid(g,'rcb');
      g=computerBid(g);g=tick(g);
    }else g=advance(g);
    assert.ok(validate(g),'valid state at step '+steps);
  }
  assert.equal(g.stage,'COMPLETE');
  for(const t of teams){
    assert.ok(g.purses[t.id]>=0);
    assert.ok(g.squads[t.id].length<=25);
    assert.ok(g.squads[t.id].filter(m=>findPlayer(m.id,g.registeredPlayers).isOverseas).length<=8);
  }
  assert.equal(g.history.length,g.queue.length);
});

test('passing can fast-forward the remaining bidding without buying for the user',()=>{
  const g=finishLot({...start('rcb'),paused:false});
  assert.ok(['SOLD','UNSOLD'].includes(g.stage));
  assert.notEqual(g.leader,'rcb');
  assert.equal(g.squads.rcb.length,config.teams.rcb.retained.length);
  assert.ok(validate(g));
});

test('fresh auctions progress through role sets without duplicate players',async()=>{
  const {auctionSet,auctionSets}=await import('../browser-auction/game/engine');
  const game=start('rcb');
  const order=game.queue.map(id=>auctionSets.indexOf(auctionSet(findPlayer(id,game.registeredPlayers))));
  assert.ok(order.every((value,index)=>index===0||value>=order[index-1]));
  assert.ok(order.includes(4),'verified uncapped set exists');
  assert.equal(new Set(game.queue).size,Object.keys(game.entryPrices).length);
});
