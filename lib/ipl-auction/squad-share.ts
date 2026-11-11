import type { SessionView } from './types';
export type ShareScope='ALL'|'RETAINED';
export const shareMoney=(lakh:number)=>`₹${(lakh/100).toLocaleString('en-IN',{maximumFractionDigits:2})} Cr`;
export function squadShareModel(session:SessionView,scope:ShareScope='ALL'){
 const players=session.squad.filter(m=>scope==='ALL'||session.decisions[m.playerId]==='RETAIN').map(m=>({name:m.player.name,role:m.player.role.replaceAll('_',' '),status:session.decisions[m.playerId]==='RETAIN'?'RETAINED':session.decisions[m.playerId]==='RELEASE'?'RELEASED':'UNDECIDED',costLakh:session.rules.costMode==='SALARY'&&session.decisions[m.playerId]==='RETAIN'?(m.salaryVerified?m.previousSalaryLakh:m.customSalaryLakh):null}));
 return {team:session.team.name,shortName:session.team.shortName,year:session.season.year,state:session.state==='CONFIRMED'?'CONFIRMED':'DRAFT',title:scope==='ALL'?'FULL SQUAD & DECISIONS':'MY RETAINED SQUAD',players,remainingLakh:session.totals.remainingLakh,spentLakh:session.totals.spentLakh,retained:session.totals.retained,released:session.totals.released,undecided:session.totals.undecided};
}
export type SquadShareModel=ReturnType<typeof squadShareModel>;
export function squadShareText(model:SquadShareModel){return [`THE CRICKET SPACE · IPL ${model.year}`,`${model.team} · ${model.title} · ${model.state}`,`Purse left: ${shareMoney(model.remainingLakh)} | Committed: ${shareMoney(model.spentLakh)}`,`${model.retained} retained · ${model.released} released · ${model.undecided} undecided`,'',...model.players.map((p,i)=>`${i+1}. ${p.name} — ${p.status}${p.costLakh!==null?' · '+shareMoney(p.costLakh):''}`),'','Fan-made simulation. 2026 baseline + confirmed 2027 trades; not official 2027 decisions.'].join('\n');}
export async function renderSquadCard(model:SquadShareModel){
 if(!model.players.length)throw new Error('Retain at least one player before sharing your squad.');
 await document.fonts.ready;
 const width=1080,rowHeight=94,rows=Math.ceil(model.players.length/2),height=Math.max(1920,400+rows*rowHeight+150);
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d');if(!c)throw new Error('Image generation is unavailable in this browser.');
 c.fillStyle='#07241a';c.fillRect(0,0,width,height);c.strokeStyle='#355b48';c.lineWidth=2;c.strokeRect(28,28,width-56,height-56);
 const text=(value:string,x:number,y:number,size:number,color='#f5f1df',bold=false)=>{c.fillStyle=color;c.font=`${bold?'700':'400'} ${size}px Arial, sans-serif`;c.fillText(value,x,y);};
 text('THE CRICKET SPACE',60,86,25,'#f6c453',true);text(`IPL ${model.year} / ${model.state}`,700,86,24,'#b4cbb9');
 text(`${model.shortName} · ${model.title}`,60,154,36,'#f5f1df',true);text(model.team,60,199,25,'#b4cbb9');
 c.fillStyle='#113b2b';c.fillRect(60,235,960,100);text('PURSE LEFT',82,266,18,'#b4cbb9');text(shareMoney(model.remainingLakh),82,310,34,'#f6c453',true);text(`${model.retained} retained · ${model.released} released`,450,275,23);text(`${model.undecided} undecided · ${shareMoney(model.spentLakh)} committed`,450,310,21,'#b4cbb9');
 model.players.forEach((p,i)=>{
  const col=i%2,row=Math.floor(i/2),x=60+col*490,y=375+row*rowHeight;
  c.fillStyle=i%4<2?'#0d3023':'#123729';c.fillRect(x,y,470,rowHeight-7);
  c.font='700 23px Arial, sans-serif';let line='';const lines:string[]=[];
  for(const word of p.name.split(' ')){const candidate=line?line+' '+word:word;if(c.measureText(candidate).width>435&&line){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);
  // Official reference names fit two lines; reduce font if an unusually long name needs more space.
  if(lines.length>2){text(p.name,x+15,y+31,18,'#f5f1df',true);}else lines.forEach((v,n)=>text(v,x+15,y+29+n*25,23,'#f5f1df',true));
  const statusColor=p.status==='RETAINED'?'#f6c453':p.status==='RELEASED'?'#edb1a1':'#b4cbb9';
  text(`${p.status}${p.costLakh!==null?' · '+shareMoney(p.costLakh):''}`,x+15,y+75,17,statusColor);
 });
 text('FAN SIMULATION · NOT OFFICIAL 2027 DECISIONS',60,height-92,21,'#f6c453',true);text('2026 baseline + confirmed 2027 trades · Snapshot of saved decisions',60,height-53,20,'#b4cbb9');
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not generate the squad image.')),'image/png'));
 return new File([blob],`${model.shortName.toLowerCase()}-ipl-${model.year}-squad.png`,{type:'image/png'});
}
