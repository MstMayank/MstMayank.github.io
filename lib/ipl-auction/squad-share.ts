import type { SessionView } from './types';
export type ShareScope='ALL'|'RETAINED'|'DECIDED';
export const shareMoney=(lakh:number)=>`₹${(lakh/100).toLocaleString('en-IN',{maximumFractionDigits:2})} Cr`;
export function squadShareModel(session:SessionView,scope:ShareScope='ALL'){
 const players=session.squad.filter(m=>scope==='ALL'||session.decisions[m.playerId]==='RETAIN'||(scope==='DECIDED'&&session.decisions[m.playerId]==='RELEASE')).map(m=>({name:m.player.name,role:m.player.role.replaceAll('_',' '),status:session.decisions[m.playerId]==='RETAIN'?'RETAINED':session.decisions[m.playerId]==='RELEASE'?'RELEASED':'UNDECIDED',costLakh:session.rules.costMode==='SALARY'&&session.decisions[m.playerId]==='RETAIN'?(m.salaryVerified?m.previousSalaryLakh:m.customSalaryLakh):null}));
 return {team:session.team.name,shortName:session.team.shortName,year:session.season.year,state:session.state==='CONFIRMED'?'CONFIRMED':'DRAFT',title:scope==='ALL'?'FULL SQUAD & DECISIONS':scope==='DECIDED'?'RETENTION DECISIONS':'MY RETAINED SQUAD',players,remainingLakh:session.totals.remainingLakh,spentLakh:session.totals.spentLakh,retained:session.totals.retained,released:session.totals.released,undecided:session.totals.undecided};
}
export type SquadShareModel=ReturnType<typeof squadShareModel>;
export function squadShareText(model:SquadShareModel){return [`THE CRICKET SPACE · IPL ${model.year}`,`${model.team} · ${model.title} · ${model.state}`,`Purse left: ${shareMoney(model.remainingLakh)} | Committed: ${shareMoney(model.spentLakh)}`,`${model.retained} retained · ${model.released} released · ${model.undecided} undecided`,'',...model.players.map((p,i)=>`${i+1}. ${p.name} — ${p.status}${p.costLakh!==null?' · '+shareMoney(p.costLakh):''}`),'','Fan-made simulation. 2026 baseline + confirmed 2027 trades; not official 2027 decisions.'].join('\n');}
export async function renderSquadCard(model:SquadShareModel){
 if(!model.players.length)throw new Error('Make a retention decision before sharing.');
 const groups=[
  {label:'Retained',color:'#7df4bd',players:model.players.filter(p=>p.status==='RETAINED')},
  {label:'Released',color:'#ffaca6',players:model.players.filter(p=>p.status==='RELEASED')},
 ];
 const undecided=model.players.filter(p=>p.status==='UNDECIDED');
 const width=1080,rowHeight=54,rows=Math.max(...groups.map(group=>group.players.length));
 const height=Math.max(1350,490+rows*rowHeight+undecided.length*42);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d');if(!c)throw new Error('Image generation is unavailable in this browser.');
 const background=c.createLinearGradient(0,0,width,height);
 background.addColorStop(0,'#184635');background.addColorStop(.48,'#0b1819');background.addColorStop(1,'#171721');
 c.fillStyle=background;c.fillRect(0,0,width,height);
 const text=(value:string,x:number,y:number,size:number,color='#f5f5f0',bold=false,maxWidth=960)=>{
  c.fillStyle=color;c.font=`${bold?'700':'400'} ${size}px system-ui, sans-serif`;c.fillText(value,x,y,maxWidth);
 };
 const tile=(x:number,y:number,w:number,h:number,color:string)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 text('THE CRICKET SPACE',52,68,24,'#ecc876',true);
 text(`IPL ${model.year}  /  ${model.state}`,740,68,22,'#c6d2cc',true,288);
 text(model.shortName,52,171,94,'#fff',true);
 text(model.team,54,220,30,'#d2ddd7',true);
 tile(52,251,976,66,'#ffffff12');
 text(`PURSE LEFT  ${shareMoney(model.remainingLakh)}`,72,294,26,'#ecc876',true,450);
 text(`${model.undecided} undecided`,770,294,23,'#d2ddd7',false,235);
 groups.forEach((group,col)=>{
  const x=52+col*500;
  tile(x,344,476,4,group.color);
  text(`${group.label.toUpperCase()}  /  ${group.players.length}`,x+12,385,25,group.color,true);
  if(!group.players.length)text('None yet',x+12,432,22,'#c6d2cc');
  group.players.forEach((player,index)=>{
   const y=400+index*rowHeight;
   tile(x,y,476,rowHeight-5,index%2?'#ffffff09':'#ffffff13');
   const hasPrice=player.costLakh!==null;
   text(player.name,x+13,y+32,24,'#f5f5f0',true,hasPrice?310:450);
   if(hasPrice)text(shareMoney(player.costLakh!),x+333,y+32,21,group.color,false,130);
  });
 });
 undecided.forEach((player,index)=>text(`${player.name} · Undecided`,64,430+rows*rowHeight+index*42,22));
 text('FAN SIMULATION  /  IPL RETENTION',52,height-28,20,'#ecc876',true);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not generate the squad image.')),'image/png'));
 return new File([blob],`${model.shortName.toLowerCase()}-ipl-${model.year}-squad.png`,{type:'image/png'});
}
