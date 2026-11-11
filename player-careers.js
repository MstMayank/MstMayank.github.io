/* The Cricket Space · free, source-labelled player records. No API keys or paid services. */
(() => {
 'use strict';
 let indexPromise=null,recordsPromise=null,mounted=false;
 const clean=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const text=(tag,value,className)=>{const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;};
 async function json(url){const response=await fetch(url);if(!response.ok)throw new Error('Download failed');return response.json();}
 function sourceLink(url,label){const a=text('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 const fmt=value=>value===null||value===undefined||value===''?'—':typeof value==='number'?value.toLocaleString('en-IN',{maximumFractionDigits:2}):String(value);
 window.TCSPlayerCareers={mount};
 async function mount(host,initialPlayer){
  if(mounted)return;mounted=true;
  host.replaceChildren();host.append(text('div','PLAYER PROFILES','eyebrow'),text('h2','One player. Every format.'));
  host.append(text('p','Search by first name, surname or initials. Choose a player to see their published career records.','hint'));
  const field=text('div','','career-search');const label=text('label','Player name');label.htmlFor='career-player-search';
  const input=document.createElement('input');input.id='career-player-search';input.type='search';input.placeholder='e.g. Sachin Tendulkar, Harmanpreet Kaur';input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','career-player-options');
  const clear=text('button','Clear');clear.type='button';const suggestions=text('div','','career-suggestions');suggestions.id='career-player-options';suggestions.hidden=true;
  const line=text('p','Loading player catalogue…','hint');line.setAttribute('role','status');
  const result=text('div','','career-profile');result.id='career-profile';const tools=text('div','','career-profile-tools');tools.hidden=true;
  const share=text('button','Copy player link ↗');share.type='button';const linkInput=document.createElement('input');linkInput.readOnly=true;linkInput.hidden=true;linkInput.setAttribute('aria-label','Player profile link');const shareStatus=text('p','');shareStatus.setAttribute('role','status');tools.append(share,linkInput,shareStatus);
  const searchRow=text('div','','career-search-row');searchRow.append(input,clear);field.append(label,searchRow,suggestions);host.append(field,line,tools,result);
  const credit=document.createElement('details');credit.className='career-data-notes';credit.append(text('summary','About these records'));
  credit.append(text('p','This is a free, stored-data service. Names in the catalogue do not guarantee that full career statistics are available. Published record lists have eligibility thresholds. Missing data is never converted to zero.'));
  credit.append(text('p','First-class totals include Tests; List A totals include ODIs. Do not add these categories together. IPL is kept separate from all T20 cricket.'));
  credit.append(text('p','Some career snapshots are dated 6 October 2025, others were verified in November 2026. Each result shows its own source and date. A source access date is not a guarantee that statistics include the latest match.'));
  const credits=text('p','Sources: ');credits.append(sourceLink('https://stats.acscricket.com/Records/index.html','ACS published records'),' · ',sourceLink('https://pkg.robjhyndman.com/weird/reference/cricket_batting.html','weird Test snapshots'),' · ',sourceLink('https://github.com/robjhyndman/cricketdata','cricketdata player names'),' · ',sourceLink('https://cricsheet.org/','Cricsheet'),' · ',sourceLink('player-career-sources.txt','Data credits / licences'));credit.append(credits);host.appendChild(credit);
  let catalogue=[],queryResults=[],shown=20,selected=null,selectionNumber=0;
  function close(){suggestions.hidden=true;input.setAttribute('aria-expanded','false');}
  function reset(){selectionNumber++;selected=null;result.replaceChildren();tools.hidden=true;shareStatus.textContent='';linkInput.hidden=true;close();}
  function show(){
   const q=clean(input.value);suggestions.replaceChildren();if(!q){close();return;}
   queryResults=catalogue.filter(p=>p.keys.some(key=>key.includes(q))).sort((a,b)=>{
    const score=p=>p.keys.some(k=>k===q)?0:p.keys.some(k=>k.startsWith(q))?1:2;return score(a)-score(b)||a.name.localeCompare(b.name);
   });
   suggestions.hidden=false;input.setAttribute('aria-expanded','true');
   if(!queryResults.length){suggestions.append(text('p','No matching player in the catalogue. Try a surname or initials.'));return;}
   for(const p of queryResults.slice(0,shown)){
    const b=text('button',p.name+(p.country?' · '+p.country:''));b.type='button';b.setAttribute('aria-label',p.name+(p.country?', '+p.country:''));b.addEventListener('click',()=>select(p));suggestions.appendChild(b);
   }
   if(queryResults.length>shown){const more=text('button','Show more ('+(queryResults.length-shown)+' remaining)');more.type='button';more.addEventListener('click',()=>{shown+=30;show();});suggestions.appendChild(more);}
  }
  function metrics(parent,values){const dl=document.createElement('dl');dl.className='career-metrics';for(const [label,value] of values){const item=document.createElement('div');item.append(text('dt',label),text('dd',fmt(value)));dl.appendChild(item);}parent.appendChild(dl);}
  async function select(player){
   const request=++selectionNumber;selected=player;input.value=player.name;close();tools.hidden=true;result.replaceChildren(text('p','Loading stored records…','hint'));
   try{
    if(!recordsPromise)recordsPromise=json('player-career-data.json?v=1').catch(e=>{recordsPromise=null;throw e;});
    const records=await recordsPromise;if(request!==selectionNumber)return;
    const profile=records.players[player.id];result.replaceChildren();
    const title=text('header','','career-profile-heading');title.append(text('h3',player.name),text('p',[player.country,player.gender==='female'?'Women':player.gender==='male'?'Men':''].filter(Boolean).join(' · '),'hint'));result.appendChild(title);
    const formats=[['Test','Test'],['ODI','ODI'],['T20I','T20I'],['FC','First-class'],['List A','List A'],['IPL','IPL']];
    const found=formats.filter(([key])=>profile?.formats?.[key]);line.textContent=found.length+' of 6 formats have stored records. Check source dates and coverage below.';
    const grid=text('div','','career-format-grid');result.appendChild(grid);
    for(const [key,label] of formats){
     const record=profile?.formats?.[key];const card=text('section','','career-format-card');card.dataset.format=key;card.append(text('h4',label));
     if(!record){card.append(text('p','Unavailable','career-availability'),text('p','A verified career record is not available in our free sources yet. This does not mean the player never played this format.','hint'));grid.appendChild(card);continue;}
     card.append(text('p',record.status==='archive'?'Archived matches':record.status==='career_snapshot'?'Career snapshot':'Published career record','career-availability'));
     if(record.batting){const b=record.batting;metrics(card,[['Matches',b.matches],['Innings',b.innings],['Runs',b.runs],['Highest score',b.highest],['Average',b.average],['Strike rate',b.strikeRate],['100s / 50s',b.hundreds!==undefined||b.fifties!==undefined?fmt(b.hundreds)+' / '+fmt(b.fifties):null],['Not out',b.notOuts]]);}
     else card.append(text('p','Batting totals unavailable.','hint'));
     if(record.bowling){const bowl=record.bowling;const detail=document.createElement('details');detail.append(text('summary','Bowling statistics'));metrics(detail,[['Wickets',bowl.wickets],['Balls bowled',bowl.balls],['Runs conceded',bowl.conceded],['Average',bowl.average],['Economy',bowl.economy],['Best figures',bowl.best]]);if(record.bowlingSource)detail.append(sourceLink(record.bowlingSource,'Bowling source ↗'),text('p','Source update date not published.','hint'));card.appendChild(detail);}
     else card.append(text('p','Bowling statistics unavailable.','hint'));
     card.append(text('p',record.asOf?'Record date / coverage: '+record.asOf:'Source update date not published.','career-source-date'));
     if(record.accessed)card.append(text('p','Source accessed: '+record.accessed,'career-source-date'));
     if(record.note)card.append(text('p',record.note,'hint'));
     if(record.source)card.append(sourceLink(record.source,'Record source ↗'));
     grid.appendChild(card);
    }
    tools.hidden=false;shareStatus.textContent='';
   }catch(error){if(request!==selectionNumber)return;result.replaceChildren(text('p','Player records could not load. Your selection has not been replaced with zero statistics.','hint'));const retry=text('button','Retry records');retry.type='button';retry.addEventListener('click',()=>select(player));result.appendChild(retry);}
  }
  input.addEventListener('input',()=>{reset();shown=20;show();});input.addEventListener('focus',()=>{if(!selected&&input.value)show();});
  input.addEventListener('keydown',event=>{if(event.key==='Escape')close();if(event.key==='ArrowDown'){event.preventDefault();if(suggestions.hidden)show();suggestions.querySelector('button')?.focus();}if(event.key==='Enter'&&!suggestions.hidden&&queryResults.length){event.preventDefault();select(queryResults[0]);}});
  suggestions.addEventListener('keydown',event=>{if(event.key==='Escape'){close();input.focus();}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=[...suggestions.querySelectorAll('button')],i=buttons.indexOf(document.activeElement),next=i+(event.key==='ArrowDown'?1:-1);if(next<0)input.focus();else buttons[Math.min(next,buttons.length-1)]?.focus();}});
  document.addEventListener('click',event=>{if(!field.contains(event.target))close();});
  clear.addEventListener('click',()=>{reset();input.value='';line.textContent=catalogue.length.toLocaleString('en-IN')+' searchable player names. Select a player to view available records.';});
  share.addEventListener('click',async()=>{if(!selected)return;const url=new URL('player-battle.html',location.href);url.searchParams.set('competition','international');url.searchParams.set('view','careers');url.searchParams.set('player',selected.id);try{await navigator.clipboard.writeText(url.href);shareStatus.textContent='Player link copied.';}catch{linkInput.value=url.href;linkInput.hidden=false;linkInput.focus();linkInput.select();shareStatus.textContent='Copy the selected player link.';}});
  try{
   if(!indexPromise)indexPromise=json('player-career-index.json?v=1').catch(e=>{indexPromise=null;throw e;});const index=await indexPromise;
   catalogue=index.players.map(([id,name,country,gender,aliases])=>({id,name,country,gender,keys:[name,...aliases].map(clean)}));
   input.disabled=false;line.textContent=catalogue.length.toLocaleString('en-IN')+' searchable player names. Select a player to view available records.';
   if(initialPlayer){const player=catalogue.find(p=>p.id===initialPlayer);if(player)await select(player);else line.textContent='This player link is not in the stored catalogue. Search for the player by name.';}
  }catch{input.disabled=true;line.textContent='The player catalogue could not load.';const retry=text('button','Retry catalogue');retry.type='button';retry.addEventListener('click',()=>{mounted=false;mount(host,initialPlayer);});host.appendChild(retry);}
 }
})();
