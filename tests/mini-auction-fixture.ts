import {players,teams} from '../browser-auction/game/engine';
import type {MiniAuction} from '../browser-auction/game/mini-auction';
import sets from '../browser-auction/game/auction-sets.json';
export function miniFixture():MiniAuction{
  const held=teams.map(t=>players.find(p=>p.teamId===t.id&&p.salary!==null)!);
  const available=players.filter(p=>!held.some(m=>m.id===p.id));
  const chosen=[...available.slice(0,22),available.find(p=>sets.uncappedPlayerIds.includes(p.id))!];
  return {season:2027,status:'ready',revision:'test-only-confirmed-mini',retentionsConfirmed:true,registrationsConfirmed:true,sources:['https://example.test/fixture'],
    teams:Object.fromEntries(teams.map((t,i)=>[t.id,{retained:[{id:held[i].id,salaryLakh:held[i].salary!}],auctionPurseLakh:13000-held[i].salary!}])),
    releasedPlayers:[...new Set(chosen.map(p=>p.id))].map(id=>({id,basePriceLakh:100})),
    registeredPlayers:[{player:{id:'test-new-registered',name:'Registered Test Player',role:'WICKETKEEPER',nationality:'India',isOverseas:false,teamId:'',salary:null},basePriceLakh:30,uncapped:true}]};
}
