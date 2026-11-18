import roster from './players.json';
import published from './mini-auction.json';
export type Player = {id:string;name:string;role:string;isOverseas:boolean;nationality:string;teamId:string;salary:number|null};
export type MiniAuction = {
  season:number;status:'pending'|'ready';revision:string;retentionsConfirmed:boolean;registrationsConfirmed:boolean;sources:string[];basePrices?:'simulation'|'official';
  teams:Record<string,{retained:Array<{id:string;salaryLakh:number}>;auctionPurseLakh:number}>;
  releasedPlayers:Array<{id:string;basePriceLakh:number}>;
  registeredPlayers:Array<{player:Player;basePriceLakh:number;uncapped:boolean}>;
};
export const miniAuction=published as MiniAuction;
export const MINI_PENDING='The mini-auction list is being updated. Please reload shortly.';
const teamIds=['csk','dc','gt','kkr','lsg','mi','pbks','rr','rcb','srh'];
export const players:Player[]=[...roster,...miniAuction.registeredPlayers.map(r=>r.player).filter(p=>!roster.some(r=>r.id===p.id))];
export function miniPlan(config:MiniAuction=miniAuction){
  if(config.status!=='ready'||!config.retentionsConfirmed)throw Error(MINI_PENDING);
  if(!config.registrationsConfirmed&&config.registeredPlayers.length)throw Error('Unconfirmed registrations cannot enter the auction.');
  if(config.season!==2027||!config.revision||!config.sources.length)throw Error('Verified mini-auction list metadata is required.');
  const catalog=new Map<string,Player>(roster.map(p=>[p.id,p]));
  for(const {player} of config.registeredPlayers){
    if(!player.id||!player.name||!player.nationality||typeof player.isOverseas!=='boolean'||!['BATTER','BOWLER','ALL_ROUNDER','WICKETKEEPER'].includes(player.role))throw Error('Invalid registered player profile.');
    if(catalog.has(player.id)&&catalog.get(player.id)!.name!==player.name)throw Error('Conflicting registered player identity.');
    catalog.set(player.id,player);
  }
  const squads:Record<string,Array<{id:string;price:number;retained:boolean}>>={},purses:Record<string,number>={},budgets:Record<string,number>={},held=new Set<string>(),prices:Record<string,number>={};
  const amount=(n:number,positive=false)=>Number.isSafeInteger(n)&&n>=(positive?1:0);
  for(const team of teamIds){
    const data=config.teams[team];
    if(!data||!amount(data.auctionPurseLakh)||data.retained.length>25)throw Error('Every franchise needs a verified retained squad and remaining purse.');
    squads[team]=data.retained.map(m=>{
      if(!catalog.has(m.id)||held.has(m.id)||!amount(m.salaryLakh,true))throw Error('Invalid or duplicate retained player.');
      held.add(m.id);return {id:m.id,price:m.salaryLakh,retained:true};
    });
    if(squads[team].filter(m=>catalog.get(m.id)!.isOverseas).length>8)throw Error('Retained overseas limit exceeded.');
    purses[team]=data.auctionPurseLakh;
    budgets[team]=data.auctionPurseLakh+squads[team].reduce((sum,m)=>sum+m.price,0);
  }
  const include=(id:string,price:number)=>{
    if(!catalog.has(id)||held.has(id)||!amount(price,true))throw Error('Auction pool contains an invalid or retained player.');
    if(prices[id]!==undefined&&prices[id]!==price)throw Error('Conflicting auction base prices.');
    prices[id]=price;
  };
  const released=new Set<string>(),registered=new Set<string>();
  for(const m of config.releasedPlayers){if(released.has(m.id))throw Error('Duplicate released player.');released.add(m.id);include(m.id,m.basePriceLakh);}
  for(const m of config.registeredPlayers){if(registered.has(m.player.id))throw Error('Duplicate registered player.');registered.add(m.player.id);include(m.player.id,m.basePriceLakh);}
  if(!Object.keys(prices).length)throw Error('The verified mini-auction pool is empty.');
  return {squads,purses,budgets,prices,catalog};
}
export const miniReady=(()=>{try{miniPlan();return true;}catch{return false;}})();

export const MINI_LIST_NOTE=miniAuction.registrationsConfirmed?'Released and registered players · '+(miniAuction.basePrices==='simulation'?'Simulation opening prices':'Published base prices'):'Released-player preview · Simulation opening prices · New registrations pending';
