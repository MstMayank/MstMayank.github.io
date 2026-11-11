import {applyDecision,calculate,confirmRetentions,PUBLISHED_SALARY_RULES} from '../lib/ipl-auction/engine';
import type {Action} from '../lib/ipl-auction/engine';
import type {SessionView,Player,Team} from '../lib/ipl-auction/types';
import roster from '../prisma/data/ipl-2026-reference-squads.json';
import salaries from '../prisma/data/ipl-salary-references.json';
import replacements from '../prisma/data/ipl-2026-replacements.json';
import trades from '../prisma/data/ipl-2027-confirmed-trades.json';
const tradeById=new Map(trades.rows.map(row=>[row.playerId,row]));
const rosterFor=(teamId:string)=>Object.entries(roster.teams).flatMap(([originalTeam,team])=>team.players.filter(p=>(tradeById.get(p.id)?.toTeamId??originalTeam)===teamId));
const replacementIds=new Set(replacements.rows.map(row=>row.playerId));
export const SAVE_KEY='tcs-auction-latest-v1';
const updatedAt=roster.verifiedAt+'T00:00:00Z';
const season={id:'ipl-2027-custom',year:2027,name:'IPL 2027 · Custom simulation',isSimulation:true};
const definitions=[['csk','Chennai Super Kings','CSK','Chennai','#f6ca46'],['dc','Delhi Capitals','DC','Delhi','#539cff'],['gt','Gujarat Titans','GT','Ahmedabad','#9eaeff'],['kkr','Kolkata Knight Riders','KKR','Kolkata','#b591ff'],['lsg','Lucknow Super Giants','LSG','Lucknow','#42d1cb'],['mi','Mumbai Indians','MI','Mumbai','#4caaff'],['pbks','Punjab Kings','PBKS','Mullanpur','#ff7979'],['rr','Rajasthan Royals','RR','Jaipur','#f291cf'],['rcb','Royal Challengers Bengaluru','RCB','Bengaluru','#f36b6d'],['srh','Sunrisers Hyderabad','SRH','Hyderabad','#ffad5a']];
export const teams:Team[]=definitions.map(([id,name,shortName,city,color])=>({id,name,shortName,city,color,squadCount:rosterFor(id).filter(p=>!replacementIds.has(p.id)).length,replacementCount:replacements.rows.filter(row=>row.teamId===id).length}));
export const players:Player[]=Object.values(roster.teams).flatMap(team=>team.players.map(p=>({...p,isDemo:false,updatedAt,source:{name:'Official IPL 2026 reference roster, including replacements',url:team.sourceUrl,isDemo:false,updatedAt},iplStats:[],domesticStats:[],internationalStats:[]})));

type Save={version:1;rosterVersion?:2|3;rosterUpdated?:boolean;tradeUpdated?:boolean;id:string;teamId:string;state:'RETENTION'|'CONFIRMED';revision:number;createdAt:string;updatedAt:string;confirmedAt:string|null;decisions:Record<string,Action>};
export type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export function createStore(storage:StorageLike){
 function view(saved:Save):SessionView{
  const team=teams.find(t=>t.id===saved.teamId);if(!team)throw Error('Saved franchise is unavailable.');
  const members=rosterFor(team.id).map(p=>{const salary=salaries.rows.find(s=>s.playerId===p.id),trade=tradeById.get(p.id);return {playerId:p.id,eligible:!replacementIds.has(p.id),isOverseas:p.isOverseas,previousSalaryLakh:trade?.salaryLakh??salary?.salaryLakh??null,salaryVerified:!!(trade||salary),contractYear:trade?2027:2026,customSalaryLakh:null,player:players.find(player=>player.id===p.id)!};});
  const squad=members.filter(m=>m.eligible),auctionPool=members.filter(m=>!m.eligible);
  return {...saved,expiresAt:'',season,team,squad,auctionPool,rules:PUBLISHED_SALARY_RULES,totals:calculate(PUBLISHED_SALARY_RULES,squad,saved.decisions)};
 }
 function read():Save|null{let raw;try{raw=storage.getItem(SAVE_KEY);}catch{throw Error('Browser storage is blocked. Allow site storage to save your team.');}if(!raw)return null;try{const s=JSON.parse(raw);if(s.version!==1||!/^local-[a-z0-9-]+$/.test(s.id)||!Number.isSafeInteger(s.revision)||s.revision<0||!['RETENTION','CONFIRMED'].includes(s.state)||!s.decisions||typeof s.decisions!=='object'||Array.isArray(s.decisions))throw Error();if(s.rosterVersion!==3){const removed=Object.keys(s.decisions).filter(id=>replacementIds.has(id)||(tradeById.has(id)&&tradeById.get(id)!.toTeamId!==s.teamId));for(const id of removed)delete s.decisions[id];const affected=trades.rows.some(t=>t.fromTeamId===s.teamId||t.toTeamId===s.teamId);if((removed.length||affected)&&s.state==='CONFIRMED'){s.state='RETENTION';s.confirmedAt=null;}s.rosterUpdated=s.rosterUpdated||s.rosterVersion!==2;s.tradeUpdated=affected;s.rosterVersion=3;s.revision++;view(s);storage.setItem(SAVE_KEY,JSON.stringify(s));}view(s);return s;}catch{throw Error('This browser save cannot be read. Start a new simulation to replace it.');}}
 function write(s:Save){try{storage.setItem(SAVE_KEY,JSON.stringify(s));}catch{throw Error('Unable to save in this browser. Free some storage or allow site storage, then retry.');}return view(s);}
 return {async request(path:string,init:RequestInit={}){
  const u=new URL(path,'https://local.invalid');const route=u.pathname.replace('/api/ipl-auction','');const method=init.method||'GET';const body=init.body?JSON.parse(String(init.body)):{};
  if(route==='/seasons'&&method==='GET')return [{...season,rules:[{name:'Published contract simulation',config:PUBLISHED_SALARY_RULES}]}];
  if(route==='/teams'&&method==='GET')return teams;
  if(route==='/players'&&method==='GET'){const found=players.filter(p=>!u.searchParams.get('playerId')||p.id===u.searchParams.get('playerId'));const {withStats}=await import('./player-stats');return found.map(withStats);}
  if(route==='/sessions'&&method==='GET'){const saved=read();return saved?[view(saved)]:[];}
  if(route==='/sessions'&&method==='POST'){
   if(body.seasonId!==season.id||!teams.some(t=>t.id===body.franchiseId))throw Error('Invalid season or franchise.');
   const now=new Date().toISOString();const id='local-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');return write({version:1,rosterVersion:3,id,teamId:body.franchiseId,state:'RETENTION',revision:0,createdAt:now,updatedAt:now,confirmedAt:null,decisions:{}});
  }
  const match=route.match(/^\/sessions\/([^/]+)(?:\/(retention|confirm))?$/);if(!match)throw Error('Unknown auction action.');
  const saved=read();if(!saved||saved.id!==match[1])throw Error('This game is no longer saved. Open the auction room to start or resume your latest team.');
  if(!match[2]&&method==='GET')return view(saved);
  if(body.revision!==saved.revision)throw Error('Your game changed in another tab. Refresh to load the latest decisions.');
  const current=view(saved);const next={...saved,revision:saved.revision+1,updatedAt:new Date().toISOString()};
  if(match[2]==='retention'&&method==='PATCH'){
   if(!['RETAIN','RELEASE','UNDO'].includes(body.action))throw Error('Invalid decision.');
   next.decisions=applyDecision(current.rules,current.squad,saved.decisions,body.playerId,body.action,saved.state);
  }else if(match[2]==='confirm'&&method==='POST'){
   confirmRetentions(current.rules,current.squad,saved.decisions,saved.state);next.state='CONFIRMED';next.confirmedAt=next.updatedAt;
  }else throw Error('Unsupported action.');
  return write(next);
 }};
}
let store:ReturnType<typeof createStore>|undefined;
export async function localApi<T>(url:string,init?:RequestInit):Promise<T>{try{store??=createStore(window.localStorage);}catch{throw Error("Browser storage is blocked. Allow site storage to save your team.");}return await store.request(url,init) as T;}
export async function localFetch(url:string,init?:RequestInit){try{return new Response(JSON.stringify(await localApi(url,init)),{status:200});}catch(e){return new Response(JSON.stringify({error:(e as Error).message}),{status:400});}}
