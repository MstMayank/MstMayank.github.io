import test from 'node:test';
import assert from 'node:assert/strict';
import {bidLimit,fairValue,valueReport,strategyFor,STRATEGIES,TEAM_STRATEGY} from '../browser-auction/game/strategy';
import {start,computerBid,tick,advance,canBid,nextBid,auctionReport,teams,type Game} from '../browser-auction/game/engine';

const player=(id:string,role='BATTER',salary:number|null=null)=>({id,name:id,role,isOverseas:false,nationality:'India',teamId:'',salary});
const data={star:{quality:60,matches:28},thin:{quality:60,matches:2},poor:{quality:42,matches:30},none:{quality:50,matches:0}};
const ctx={base:100,purse:5000,squadSize:15,sameRole:2,uncapped:false,lotsLeft:40};

test('fair value: quality raises it, thin evidence is discounted, never below base', () => {
  assert.equal(fairValue(player('star'),100,data),200,'10 points above average with full trust doubles it');
  assert.ok(fairValue(player('thin'),100,data)<110,'two matches barely moves it');
  assert.equal(fairValue(player('poor'),100,data),100,'floored at base price');
  assert.equal(fairValue(player('none',undefined,300),100,data),300,'anchored on last salary');
});

test('strategies differ: star-chasers pay most for proven players, value hunters never exceed fair value', () => {
  const star=bidLimit('star',player('star'),ctx,data),value=bidLimit('value',player('star'),ctx,data),balanced=bidLimit('balanced',player('star'),ctx,data);
  assert.ok(star>balanced&&balanced>=value,`${star} > ${balanced} >= ${value}`);
  assert.ok(value<=fairValue(player('star'),100,data));
  const youth=bidLimit('youth',player('none'),{...ctx,uncapped:true},data),others=bidLimit('star',player('none'),{...ctx,uncapped:true},data);
  assert.ok(youth>others,'youth builders back uncapped players');
});

test('needs and caps: short roles are worth more, one player never takes the whole purse', () => {
  const short=bidLimit('balanced',player('star','BOWLER'),{...ctx,sameRole:0},data),covered=bidLimit('balanced',player('star','BOWLER'),{...ctx,sameRole:9},data);
  assert.ok(short>covered);
  assert.ok(bidLimit('star',player('star'),{...ctx,purse:300},data)<=300*STRATEGIES.star.capShare);
});

test('late in the auction a short squad still bids the base price', () => {
  const limit=bidLimit('value',player('poor'),{...ctx,purse:2000,squadSize:14,lotsLeft:6},data);
  assert.ok(limit>=100);
});

test('every franchise has a strategy', () => {
  for(const t of teams) assert.ok(STRATEGIES[strategyFor(t.id)],t.id);
  assert.equal(Object.keys(TEAM_STRATEGY).length,10);
});

test('a full simulated auction stays legal and produces a value report', () => {
  let g:Game={...start('rcb'),paused:false};
  for(let step=0;step<200000&&g.stage!=='COMPLETE';step++){
    if(g.stage==='BIDDING'){
      if(g.leader)assert.ok(g.bid<=g.purses[g.leader]);
      g=tick(computerBid(g,[]));
    } else g=advance(g);
  }
  assert.equal(g.stage,'COMPLETE');
  for(const t of teams){assert.ok(g.purses[t.id]>=0);assert.ok(g.squads[t.id].length<=25);}
  const report=auctionReport(g,3);
  assert.ok(report.rows.length>0);
  assert.ok(report.bargains[0].ratio<=report.overpays[0].ratio);
});

test('report helper ranks bargains and overpays', () => {
  const r=valueReport([{id:'star',teamId:'mi',price:100},{id:'poor',teamId:'kkr',price:400},{id:'x',teamId:null,price:0}],id=>player(id),()=>100,5);
  assert.equal(r.rows.length,2);
  assert.equal(r.overpays[0].id,'poor');
});
