import {findPlayer,money,teams,type Game} from './engine';

export async function auctionCard(game:Pick<Game,'teamId'|'squads'|'purses'>,rating:number|null):Promise<File>{
  const canvas=document.createElement('canvas');
  canvas.width=1080;canvas.height=1920;
  const context=canvas.getContext('2d');
  if(!context)throw Error('Image sharing is unavailable.');
  const c=context;
  const team=teams.find(t=>t.id===game.teamId)!;
  const gradient=c.createLinearGradient(0,0,1080,1920);
  gradient.addColorStop(0,'#182e25');gradient.addColorStop(1,'#07110e');
  c.fillStyle=gradient;c.fillRect(0,0,1080,1920);
  const glow=c.createRadialGradient(0,0,0,0,0,1100);
  glow.addColorStop(0,team.color+'88');glow.addColorStop(1,team.color+'00');
  c.fillStyle=glow;c.fillRect(0,0,1080,1920);
  function text(value:string,x:number,y:number,size:number,color='#f4f1e6',max=960){
    c.font='700 '+size+'px system-ui,sans-serif';c.fillStyle=color;c.fillText(value,x,y,max);
  }
  text('THE CRICKET SPACE',60,80,25,'#efc660');
  text('IPL 2027 · MY AUCTION SQUAD',60,136,22,'#abc3b3');
  text(team.id.toUpperCase(),60,290,116,team.color);
  text(team.name,60,352,34,team.color);
  if(rating!==null)text('SQUAD RATING '+rating.toFixed(1)+'/100',60,414,28,'#efc660');
  text('PURSE LEFT',60,485,19,'#abc3b3');
  text(money(game.purses[game.teamId]),60,540,43,'#efc660');
  const squad=game.squads[game.teamId];
  text(squad.length+' PLAYERS',630,485,19,'#abc3b3');
  text(squad.filter(m=>findPlayer(m.id).isOverseas).length+' OVERSEAS',630,533,28);
  c.fillStyle='#efc660';c.fillRect(60,586,960,2);
  const sorted=[...squad].sort((a,b)=>b.price-a.price||a.id.localeCompare(b.id));
  sorted.forEach((member,i)=>{
    const x=60+(i%2)*490,y=630+Math.floor(i/2)*85;
    c.fillStyle='#ffffff0b';c.fillRect(x,y,470,74);
    text(findPlayer(member.id).name,x+14,y+29,22,'#f4f1e6',440);
    text(money(member.price)+' · '+(member.retained?'Retained':'Auction buy'),x+14,y+57,17,team.color,440);
  });
  c.fillStyle='#efc660';c.fillRect(60,1812,960,2);
  text('YOUR TEAM. YOUR CALL.',60,1860,24,'#efc660');
  text('IPL FAN SIMULATION',60,1898,18,'#abc3b3');
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not create squad card.')),'image/png'));
  return new File([blob],team.id+'-auction-squad.png',{type:'image/png'});
}
