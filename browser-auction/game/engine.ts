import {players,miniAuction,miniPlan,type Player,type MiniAuction} from './mini-auction';
export {players,type Player} from './mini-auction';
import setData from './auction-sets.json';

const uncappedIds=new Set([...setData.uncappedPlayerIds,...miniAuction.registeredPlayers.filter(r=>r.uncapped).map(r=>r.player.id)]);
export const auctionSets=['Wicketkeepers','Batters','All-rounders','Bowlers','Uncapped players'] as const;
export function auctionSet(player:Player):typeof auctionSets[number]{
  if(uncappedIds.has(player.id))return 'Uncapped players';
  if(player.role==='WICKETKEEPER')return 'Wicketkeepers';
  if(player.role==='ALL_ROUNDER')return 'All-rounders';
  if(player.role==='BOWLER')return 'Bowlers';
  return 'Batters';
}
export const teams = [
  ['csk','Chennai Super Kings','#f5cf4d'],['dc','Delhi Capitals','#499dff'],
  ['gt','Gujarat Titans','#a7bfff'],['kkr','Kolkata Knight Riders','#be94ff'],
  ['lsg','Lucknow Super Giants','#50d5c6'],['mi','Mumbai Indians','#509fff'],
  ['pbks','Punjab Kings','#ff686e'],['rr','Rajasthan Royals','#f78ac5'],
  ['rcb','Royal Challengers Bengaluru','#f35961'],['srh','Sunrisers Hyderabad','#ff9e45']
].map(([id,name,color])=>({id,name,color}));
export type Member = {id:string; price:number; retained:boolean};
export type Game = {
  version:2; mode:'MINI'; poolRevision:string; budgets:Record<string,number>;entryPrices:Record<string,number>;registeredPlayers:Player[]; revision:number; teamId:string; squads:Record<string,Member[]>;
  purses:Record<string,number>; queue:string[]; index:number; bid:number;
  leader:string|null; passed:string[]; seconds:number;
  stage:'BIDDING'|'SOLD'|'UNSOLD'|'COMPLETE'; paused:boolean;
  history:Array<{id:string;teamId:string|null;price:number}>; message:string;
};
export const KEY='tcs-mini-auction-v2';
export const findPlayer=(id:string,registered:Player[]=[])=>players.find(p=>p.id===id)??registered.find(p=>p.id===id)!;
export const basePrice=(g:Game,p:Player)=>g.entryPrices[p.id];
export const increment=(bid:number)=>bid<200?10:bid<500?20:25;
export const nextBid=(g:Game)=>g.leader?g.bid+increment(g.bid):g.entryPrices[g.queue[g.index]];
export function canBid(g:Game,teamId:string,price=nextBid(g)){
  const squad=g.squads[teamId];
  if(g.stage!=='BIDDING'||g.leader===teamId||g.passed.includes(teamId)||squad.length>=25)return false;
  const overseas=squad.filter(m=>findPlayer(m.id,g.registeredPlayers).isOverseas).length;
  if(findPlayer(g.queue[g.index],g.registeredPlayers).isOverseas&&overseas>=8)return false;
  const reserve=Math.max(0,18-squad.length-1)*30;
  return price<=g.purses[teamId]-reserve;
}
export function start(teamId:string,config:MiniAuction=miniAuction):Game{
  if(!teams.some(t=>t.id===teamId))throw Error('Choose a valid team.');
  const {squads,purses,budgets,prices,catalog}=miniPlan(config);
  const queue=Object.keys(prices).sort((a,b)=>auctionSets.indexOf(auctionSet(catalog.get(a)!))-auctionSets.indexOf(auctionSet(catalog.get(b)!))||prices[b]-prices[a]||a.localeCompare(b));
  return {version:2,mode:'MINI',poolRevision:config.revision,budgets,entryPrices:prices,registeredPlayers:config.registeredPlayers.map(r=>r.player),revision:0,teamId,squads,purses,queue,index:0,bid:0,leader:null,passed:[],seconds:10,stage:'BIDDING',paused:true,history:[],message:'Retained squads are locked. Start bidding when you’re ready.'};
}

export function placeBid(g:Game,teamId:string):Game{
  const price=nextBid(g);
  if(g.paused||!canBid(g,teamId,price))return g;
  return {...g,revision:g.revision+1,bid:price,leader:teamId,seconds:8,message:teamId.toUpperCase()+' raises to '+money(price)};
}
export function pass(g:Game):Game{
  if(g.stage!=='BIDDING'||g.paused||g.leader===g.teamId)return g;
  return {...g,revision:g.revision+1,passed:[...new Set([...g.passed,g.teamId])],message:'You passed on this player.'};
}
function settle(g:Game):Game{
  const id=g.queue[g.index];
  const sold=!!g.leader;
  const squads={...g.squads},purses={...g.purses};
  if(g.leader){
    if(!canAffordSale(g,g.leader))throw Error('Invalid winning bid.');
    squads[g.leader]=[...squads[g.leader],{id,price:g.bid,retained:false}];
    purses[g.leader]-=g.bid;
  }
  return {...g,squads,purses,seconds:0,stage:sold?'SOLD':'UNSOLD',revision:g.revision+1,
    history:[...g.history,{id,teamId:g.leader,price:sold?g.bid:0}],
    message:sold?findPlayer(id,g.registeredPlayers).name+' sold to '+g.leader!.toUpperCase()+'!':findPlayer(id,g.registeredPlayers).name+' goes unsold.'};
}
function canAffordSale(g:Game,t:string){
  return g.bid<=g.purses[t]&&g.squads[t].length<25&&!Object.values(g.squads).flat().some(m=>m.id===g.queue[g.index]);
}
export function tick(g:Game):Game{
  if(g.paused||g.stage!=='BIDDING')return g;
  if(g.seconds<=1)return settle(g);
  return {...g,seconds:g.seconds-1,revision:g.revision+1};
}
export function advance(g:Game):Game{
  if(!['SOLD','UNSOLD'].includes(g.stage))return g;
  const index=g.index+1;
  return {...g,index,bid:0,leader:null,passed:[],seconds:10,stage:index>=g.queue.length?'COMPLETE':'BIDDING',revision:g.revision+1,message:index>=g.queue.length?'Auction complete. Your squad is ready.':'A new player enters the room.'};
}
export function computerBid(g:Game,humanTeams:string[]=[g.teamId]):Game{
  if(g.paused||g.stage!=='BIDDING')return g;
  const p=findPlayer(g.queue[g.index],g.registeredPlayers),price=nextBid(g);
  const candidates=teams.filter(t=>!humanTeams.includes(t.id)&&canBid(g,t.id,price)).map(t=>{
    const sameRole=g.squads[t.id].filter(m=>findPlayer(m.id,g.registeredPlayers).role===p.role).length;
    const target=p.role==='WICKETKEEPER'?2:p.role==='BOWLER'?7:5;
    const need=Math.max(.55,1.35-sameRole/target);
    const value=Math.max(basePrice(g,p),p.salary??60)*need;
    const budgetCap=g.purses[t.id]*(g.squads[t.id].length<10?.25:.4);
    return {id:t.id,limit:Math.min(value,budgetCap),need};
  }).filter(t=>t.limit>=price).sort((a,b)=>b.need-a.need||b.limit-a.limit);
  if(!candidates.length)return g;
  // A stable rotating choice makes different franchises compete without random prices.
  const chosen=candidates[(g.history.length+g.seconds)%Math.min(3,candidates.length)];
  return placeBid(g,chosen.id);
}
export const money=(lakh:number)=>'₹'+(lakh/100).toLocaleString('en-IN',{maximumFractionDigits:2})+' Cr';
export function validate(g:Game,config:MiniAuction=miniAuction):boolean{
  let plan:ReturnType<typeof miniPlan>;
  try{plan=miniPlan(config);}catch{return false;}
  if(g?.mode!=='MINI'||g.poolRevision!==config.revision||JSON.stringify(g.entryPrices)!==JSON.stringify(plan.prices)||JSON.stringify(g.registeredPlayers)!==JSON.stringify(config.registeredPlayers.map(r=>r.player)))return false;
  if(!Array.isArray(g.queue)||g.queue.length!==Object.keys(plan.prices).length||g.queue.some(id=>plan.prices[id]===undefined))return false;
  if(g?.version!==2||!teams.some(t=>t.id===g.teamId)||!Number.isInteger(g.revision)||!Array.isArray(g.queue)||!Number.isInteger(g.index)||g.index<0||g.index>g.queue.length)return false;
  const known=new Set(plan.catalog.keys()),ids:string[]=[];
  if(!Number.isSafeInteger(g.bid)||g.bid<0||typeof g.paused!=='boolean'||!Array.isArray(g.passed)||g.passed.some(id=>!teams.some(t=>t.id===id)))return false;
  if(g.leader!==null&&!teams.some(t=>t.id===g.leader))return false;
  if(!Array.isArray(g.history)||g.history.some(h=>!known.has(h.id)||!Number.isSafeInteger(h.price)||h.price<0||(h.teamId!==null&&!teams.some(t=>t.id===h.teamId))))return false;
  if(g.queue.some(id=>!known.has(id))||new Set(g.queue).size!==g.queue.length)return false;
  if(!['BIDDING','SOLD','UNSOLD','COMPLETE'].includes(g.stage)||!Number.isFinite(g.seconds)||g.seconds<0||g.seconds>10)return false;
  if(g.stage!=='COMPLETE'&&g.index>=g.queue.length)return false;
  for(const t of teams){
    const squad=g.squads?.[t.id],purse=g.purses?.[t.id];
    if(!Array.isArray(squad)||squad.length>25||!Number.isSafeInteger(purse)||purse<0)return false;
    if(squad.some(m=>!known.has(m.id)||!Number.isSafeInteger(m.price)||m.price<0))return false;
    if(g.budgets?.[t.id]!==plan.budgets[t.id]||squad.reduce((n,m)=>n+m.price,0)+purse!==plan.budgets[t.id])return false;
    if(plan.squads[t.id].some(m=>!squad.some(member=>member.id===m.id&&member.retained===true&&member.price===m.price)))return false;
    if(squad.some(m=>m.retained?!plan.squads[t.id].some(expected=>expected.id===m.id&&expected.price===m.price):plan.prices[m.id]===undefined))return false;
    if(squad.filter(m=>findPlayer(m.id,g.registeredPlayers).isOverseas).length>8)return false;
    ids.push(...squad.map(m=>m.id));
  }
  return new Set(ids).size===ids.length;
}

export function finishLot(game:Game):Game {
  if(game.paused||game.stage!=='BIDDING'||game.leader===game.teamId)return game;
  let current=pass(game);
  for(let step=0;step<5000&&current.stage==='BIDDING';step++){
    current=tick(computerBid(current));
  }
  return current;
}
