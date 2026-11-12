import type { SessionView } from './types';
export type ShareScope='ALL'|'RETAINED'|'DECIDED';
export const shareMoney=(lakh:number)=>`₹${(lakh/100).toLocaleString('en-IN',{maximumFractionDigits:2})} Cr`;
export function squadShareModel(session:SessionView,scope:ShareScope='ALL'){
 const players=session.squad.filter(m=>scope==='ALL'||session.decisions[m.playerId]==='RETAIN'||(scope==='DECIDED'&&session.decisions[m.playerId]==='RELEASE')).map(m=>({name:m.player.name,role:m.player.role.replaceAll('_',' '),status:session.decisions[m.playerId]==='RETAIN'?'RETAINED':session.decisions[m.playerId]==='RELEASE'?'RELEASED':'UNDECIDED',costLakh:session.rules.costMode==='SALARY'&&session.decisions[m.playerId]==='RETAIN'?(m.salaryVerified?m.previousSalaryLakh:m.customSalaryLakh):null}));
 return {team:session.team.name,teamColor:session.team.color,shortName:session.team.shortName,year:session.season.year,state:session.state==='CONFIRMED'?'CONFIRMED':'DRAFT',title:scope==='ALL'?'FULL SQUAD & DECISIONS':scope==='DECIDED'?'RETENTION DECISIONS':'MY RETAINED SQUAD',players,remainingLakh:session.totals.remainingLakh,spentLakh:session.totals.spentLakh,retained:session.totals.retained,released:session.totals.released,undecided:session.totals.undecided};
}
export type SquadShareModel=ReturnType<typeof squadShareModel>;
export function squadShareText(model:SquadShareModel){return [`THE CRICKET SPACE · IPL ${model.year}`,`${model.team} · ${model.title} · ${model.state}`,`Purse left: ${shareMoney(model.remainingLakh)} | Committed: ${shareMoney(model.spentLakh)}`,`${model.retained} retained · ${model.released} released · ${model.undecided} undecided`,'',...model.players.map((p,i)=>`${i+1}. ${p.name} — ${p.status}${p.costLakh!==null?' · '+shareMoney(p.costLakh):''}`),'','Fan-made simulation. 2026 baseline + confirmed 2027 trades; not official 2027 decisions.'].join('\n');}
export async function renderSquadCard(model:SquadShareModel,rating:number|null=null){
 if(!model.players.length)throw new Error('Make a retention decision before sharing.');
 const retained=model.players.filter(p=>p.status==='RETAINED').sort((a,b)=>(b.costLakh??0)-(a.costLakh??0));
 const featured=retained.slice(0,4), others=retained.slice(4);
 const released=model.players.filter(p=>p.status==='RELEASED');
 const width=1080;
 const featuredTop=478, featuredHeight=182;
 const listTop=678, rowStride=58, rowHeight=47;
 const retainedBottom=others.length
  ? listTop+(Math.ceil(others.length/2)-1)*rowStride+rowHeight
  : featured.length ? featuredTop+featuredHeight : 508;
 // Canvas text uses a baseline. Leave room above it for the heading itself.
 const releasedY=retainedBottom+28+36;
 const height=releasedY+128+Math.max(1,Math.ceil(released.length/3))*55;
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');
 if(!context)throw new Error('Image generation is unavailable in this browser.');
 const c=context;
 const accent=model.shortName==='SRH'?'#ff7a1a':/^#[a-f0-9]{6}$/i.test(model.teamColor)?model.teamColor:'#e8c468';
 const shade=model.shortName==='SRH'?'#c4400a':accent+'99';
 const bg=c.createLinearGradient(0,0,width,height);
 bg.addColorStop(0,'#12281f');bg.addColorStop(.55,'#0a1511');bg.addColorStop(1,'#070e0c');
 c.fillStyle=bg;c.fillRect(0,0,width,height);
 const glow=c.createRadialGradient(35,15,0,35,15,820);
 glow.addColorStop(0,accent+'63');glow.addColorStop(1,accent+'00');
 c.fillStyle=glow;c.fillRect(0,0,width,height);
 const gold='#e8c468',green='#7df4bd',red='#ffc0ba',muted='#b4c7bd';
 function text(value:string,x:number,y:number,size:number,color:string|CanvasGradient='#f2f5f1',maxWidth=970){
  c.fillStyle=color;c.font=`700 ${size}px system-ui, sans-serif`;c.fillText(value,x,y,maxWidth);
 }
 function panel(x:number,y:number,w:number,h:number,fill:string|CanvasGradient,border:string,r=18){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();c.fillStyle=fill;c.fill();
  c.strokeStyle=border;c.lineWidth=2;c.stroke();
 }
 const title=c.createLinearGradient(56,82,420,241);
 title.addColorStop(0,'#fff3dc');title.addColorStop(.47,accent);title.addColorStop(1,shade);
 text('THE CRICKET SPACE',48,57,24,gold);
 panel(750,26,282,46,'#0004',model.state==='CONFIRMED'?green:gold,21);
 text(model.state==='CONFIRMED'?'RETENTIONS LOCKED':'RETENTION DRAFT',770,56,21,model.state==='CONFIRMED'?green:gold,242);
 text(model.shortName,42,217,155,title,630);
 text('RETENTION',850,141,21,muted,180);
 text(String(model.year),850,204,58,'#f2f5f1',180);
 text(model.team,48,267,33,accent,rating===null?970:640);
 if(rating!==null){
  panel(704,226,328,54,'#111b17',accent,14);
  c.textAlign='center';
  text(`Squad rating · ${rating}/100`,868,261,25,'#f2f5f1',296);
  c.textAlign='left';
 }
 const tiles=[['Purse left',shareMoney(model.remainingLakh),370],['Retention cost',shareMoney(model.spentLakh),292],['Undecided',String(model.undecided),292]] as const;
 let x=48;
 for(const [label,value,w] of tiles){
  panel(x,297,w,105,label==='Purse left'?'#e8c4681a':'#0004',label==='Purse left'?'#e8c46888':'#ffffff24');
  text(label,x+18,333,21,muted,w-36);text(value,x+18,381,37,label==='Purse left'?gold:'#f2f5f1',w-36);
  x+=w+15;
 }
 text(`Retained  ·  ${retained.length} players`,48,457,36,green);
 if(!featured.length)text('None yet',48,502,23,muted);
 featured.forEach((p,i)=>{
  const x=48+i*249;
  panel(x,featuredTop,237,featuredHeight,'#22c55e17','#22c55e65');
  const avatar=c.createLinearGradient(x+90,493,x+146,558);
  avatar.addColorStop(0,accent);avatar.addColorStop(1,shade);
  panel(x+84,493,69,69,avatar,'#ffffff36',34);
  c.textAlign='center';
  text(p.name.split(/\s+/).map(n=>n[0]).filter(Boolean).filter((_,j,a)=>j===0||j===a.length-1).join(''),x+118,537,27);
  text(p.name,x+118,601,23,'#f2f5f1',209);
  if(p.costLakh!==null)text(shareMoney(p.costLakh),x+118,638,26,gold,209);
  c.textAlign='left';
 });
 others.forEach((p,i)=>{
  const x=48+(i%2)*499,y=listTop+Math.floor(i/2)*rowStride;
  panel(x,y,485,rowHeight,'#ffffff0b','#ffffff18',12);
  text(p.name,x+13,y+31,22,'#f2f5f1',p.costLakh===null?455:330);
  if(p.costLakh!==null)text(shareMoney(p.costLakh),x+354,y+31,21,green,118);
 });
 text(`Released  ·  ${released.length} players`,48,releasedY,36,red);
 if(!released.length)text('None yet',48,releasedY+49,23,muted);
 released.forEach((p,i)=>{
  const x=48+(i%3)*332,y=releasedY+22+Math.floor(i/3)*55;
  panel(x,y,318,44,'#ef44441b','#ef444466',22);
  text(p.name,x+14,y+29,22,red,290);
 });
 c.fillStyle='#ffffff24';c.fillRect(48,height-62,984,1);
 text('THE CRICKET SPACE  /  IPL FAN SIMULATION',48,height-26,20,gold);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not generate the squad image.')),'image/png'));
 return new File([blob],`${model.shortName.toLowerCase()}-ipl-${model.year}-squad.png`,{type:'image/png'});
}
