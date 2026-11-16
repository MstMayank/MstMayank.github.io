import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {start,teams,findPlayer,KEY,money,canBid,nextBid,placeBid,pass,finishLot,tick,advance,computerBid,validate,type Game} from './engine';
import {auctionCard} from './share';
import StaticImage from '../image';
import './room.css';

function read():Game|null {
  const raw=localStorage.getItem(KEY);
  if(!raw)return null;
  const saved=JSON.parse(raw);
  if(!validate(saved))throw Error('The saved auction could not be loaded. Start a new auction.');
  return {...saved,paused:true};
}
function Logo({id}:{id:string}){
  return <StaticImage src={'/ipl-auction/logos/'+id+'.png'} alt={id.toUpperCase()} width="48" height="48"/>;
}
function restore(){
  try {
    const game=read();
    const saved=JSON.parse(localStorage.getItem('tcs-auction-latest-v1')||'null');
    const retention=saved?.state==='CONFIRMED'?{teamId:saved.teamId as string,ids:Object.keys(saved.decisions).filter(id=>saved.decisions[id]==='RETAIN')}:null;
    return {game,retention,error:''};
  }catch(e){return {game:null,retention:null,error:(e as Error).message};}
}
function App(){
  const [initial]=useState(restore);
  const [game,setGame]=useState<Game|null>(initial.game),[error,setError]=useState(initial.error),[selected,setSelected]=useState('rcb');
  const [assessment,setAssessment]=useState<{key:string;overallRating:number;tier:string}|null>(null);
  const [tab,setTab]=useState('squad'),[sound,setSound]=useState(false),[notice,setNotice]=useState('');
  const retention=initial.retention;
  const ratingKey=JSON.stringify(game?{teamId:game.teamId,members:game.squads[game.teamId]}:null);
  const rating=assessment?.key===ratingKey?assessment:null;
  const [card,setCard]=useState<{key:string;file:File}|null>(null);
  const cardKey=JSON.stringify([ratingKey,game?.purses[game.teamId],rating?.overallRating??null]);
  useEffect(()=>{
    if(!navigator.canShare)return;
    let active=true;
    const data=JSON.parse(cardKey) as [string,number,number|null];
    const request=JSON.parse(data[0]) as {teamId:string;members:Game['squads'][string]}|null;
    if(!request?.members.length)return;
    const snapshot={teamId:request.teamId,squads:{[request.teamId]:request.members},purses:{[request.teamId]:data[1]}};
    auctionCard(snapshot,data[2]).then(file=>{if(active)setCard({key:cardKey,file});}).catch(()=>{});
    return()=>{active=false;};
  },[cardKey]);
  const audio=useRef<AudioContext|null>(null),previousStage=useRef('');
  const owner=useRef(crypto.randomUUID());
  const leaseKey=KEY+'-owner';
  useEffect(()=>{
    const sync=(e:StorageEvent)=>{if(e.key===KEY)try{setGame(read());setNotice('Auction updated in another tab. Resume here to take control.');}catch(err){setError((err as Error).message);}};
    addEventListener('storage',sync);
    return()=>removeEventListener('storage',sync);
  },[]);
  const update=useCallback((action:(g:Game)=>Game)=>{
    try{
      setGame(current=>{
        if(!current)return current;
        try{
          const lease=JSON.parse(localStorage.getItem(leaseKey)||'null');
          if(!current.paused&&lease&&lease.owner!==owner.current&&lease.expires>Date.now())return {...current,paused:true};
          const next=action(current);
          if(next===current)return current;
          if(!validate(next))throw Error('Could not validate this auction action.');
          localStorage.setItem(KEY,JSON.stringify(next));
          if(!next.paused)localStorage.setItem(leaseKey,JSON.stringify({owner:owner.current,expires:Date.now()+4000}));
          return next;
        }catch(e){setError((e as Error).message);return {...current,paused:true};}
      });
    }catch(e){setError((e as Error).message);}
  },[leaseKey]);
  useEffect(()=>{
    const request=JSON.parse(ratingKey) as {teamId:string;members:Game['squads'][string]}|null;
    if(!request?.members.length)return;
    let active=true;
    const ratingModule='./chunks/squad-rating-data-VNOJQCWV.js';
    import(/* webpackIgnore: true */ ratingModule).then(module=>{
      const report=module.buildRating({
        team:{id:request.teamId},squad:[],decisions:{},
        ratingPurchases:request.members.map(m=>({player:findPlayer(m.id),isOverseas:findPlayer(m.id).isOverseas,priceLakh:m.price,salaryVerified:false}))
      });
      if(active)setAssessment({key:ratingKey,overallRating:report.overallRating,tier:report.tier});
    }).catch(()=>{if(active)setAssessment(null);});
    return()=>{active=false;};
  },[ratingKey]);
  function begin(teamId:string,ids:string[]=[]){
    try{
      const lease=JSON.parse(localStorage.getItem(leaseKey)||'null');
      if(lease?.owner!==owner.current&&lease?.expires>Date.now())throw Error('Pause the auction in your other tab before starting a new game.');
      const fresh=start(teamId,ids);
      localStorage.setItem(KEY,JSON.stringify(fresh));
      setGame(fresh);setError('');setNotice('');
    }catch(e){setError((e as Error).message);}
  }
  function toggle(){
    if(!game)return;
    try{
      const lease=JSON.parse(localStorage.getItem(leaseKey)||'null');
      if(game.paused&&lease?.owner!==owner.current&&lease?.expires>Date.now())throw Error('Your auction is running in another tab. Pause it there first.');
      localStorage.setItem(leaseKey,JSON.stringify({owner:owner.current,expires:game.paused?Date.now()+4000:0}));
      update(g=>({...g,paused:!g.paused,revision:g.revision+1}));
      if(sound){audio.current??=new AudioContext();void audio.current.resume();}
    }catch(e){setError((e as Error).message);}
  }
  useEffect(()=>{
    const interval=setInterval(()=>update(g=>{
      if(document.hidden||g.paused||g.stage!=='BIDDING')return g;
      const next=tick(g);
      return next.stage==='BIDDING'&&next.seconds%2===0?computerBid(next):next;
    }),1000);
    const hidden=()=>{if(document.hidden)update(g=>g.paused?g:{...g,paused:true,revision:g.revision+1});};
    document.addEventListener('visibilitychange',hidden);
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',hidden);};
  },[update]);
  useEffect(()=>{
    if(game?.stage==='SOLD'&&previousStage.current!=='SOLD'&&sound&&audio.current){
      const ctx=audio.current,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='triangle';osc.frequency.setValueAtTime(440,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(80,ctx.currentTime+.18);
      gain.gain.setValueAtTime(.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.25);
      osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25);
    }
    previousStage.current=game?.stage||'';
  },[game?.stage,sound]);
  async function share(){
    if(!game)return;
    const text=teams.find(t=>t.id===game.teamId)!.name+' · My auction squad\n'+game.squads[game.teamId].map(m=>findPlayer(m.id).name+' — '+money(m.price)).join('\n')+'\nPurse left '+money(game.purses[game.teamId]);
    try{const image=card?.key===cardKey?card.file:null;
      if(image&&navigator.share&&navigator.canShare?.({files:[image]}))await navigator.share({title:'My IPL auction squad',files:[image]});
      else if(navigator.share)await navigator.share({title:'My IPL auction squad',text});else{await navigator.clipboard.writeText(text);setNotice('Squad copied.');}}catch(e){if((e as Error).name!=='AbortError')setNotice('Sharing could not open. Please try again.');}
  }
  const team=teams.find(t=>t.id===(game?.teamId||selected))!;
  const player=game&&game.stage!=='COMPLETE'?findPlayer(game.queue[game.index]):null;
  const squad=game?.squads[game.teamId]||[];
  return <div className="room" style={{'--team':team.color} as React.CSSProperties}>
    <header className="room-nav"><a href="/">THE CRICKET <span>SPACE</span></a><a href="/ipl-auction/#/teams">Retention room ↗</a></header>
    <main>
      <div className="room-heading"><div><span className="eyebrow">IPL 2027 · FAN SIMULATION</span><h1>THE AUCTION ROOM<span>.</span></h1></div><span className="live-label"><i/> {game?.paused?'PAUSED':'SINGLE PLAYER'}</span></div>
      {error&&<p className="alert" role="alert">{error}</p>}
      {notice&&<p className="notice" role="status">{notice}</p>}
      {!game?<section className="setup">
        <div><span className="eyebrow">TAKE YOUR SEAT</span><h2>Your team. Your bid.</h2><p>Outbid nine computer franchises. Build an 18–25 player squad with up to eight overseas players.</p><p className="muted">₹130 Cr purse · Simulation base prices · Saves on this browser</p></div>
        <div className="team-picker">{teams.map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}><Logo id={t.id}/>{t.id.toUpperCase()}</button>)}</div>
        <button className="primary" onClick={()=>begin(selected)}>Start fresh auction ↗</button>
        {retention&&<button onClick={()=>begin(retention.teamId,retention.ids)}>Continue {retention.teamId.toUpperCase()} retained squad ↗</button>}
      </section>:<>
        <div className="auction-layout">
          <section className={'player-stage '+(game.stage==='SOLD'?'sold-stage':'')}>
            <div className="stage-top"><span>LOT {Math.min(game.index+1,game.queue.length)} / {game.queue.length}</span><div className="stage-controls"><button className="small" disabled={game.stage==='COMPLETE'} onClick={toggle}>{game.paused?'▶ Start bidding':'Ⅱ Pause'}</button><button className="small" aria-pressed={sound} onClick={()=>{setSound(!sound);if(!sound){audio.current??=new AudioContext();void audio.current.resume();}}}>Sound {sound?'on':'off'}</button></div></div>
            {player?<><div className="player-art" aria-hidden="true"><div className="orbit"/><strong>{player.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</strong><span>{player.role.replaceAll('_',' ')}</span></div>
              <h2>{player.name}</h2><p className="player-meta">{player.nationality} <span>·</span> {player.isOverseas?'Overseas':'Indian'} <span>·</span> Base {money(nextBid({...game,leader:null}))}</p>
              <div className="bid-display"><span>{game.leader?'CURRENT BID':'OPENING PRICE'}</span><strong>{money(game.leader?game.bid:nextBid(game))}</strong><div>{game.leader?<><Logo id={game.leader}/>{game.leader.toUpperCase()} LEADS</>:'Waiting for the first paddle'}</div></div>
              {game.stage==='BIDDING'?<><div className={'timer '+(game.seconds<=3?'urgent':'')}><span>{game.paused?'Ready when you are':game.seconds<=2?'Going twice…':game.seconds<=4?'Going once…':'Bidding open'}</span><b>{game.seconds}s</b><progress max="10" value={game.seconds}/></div>
                <div className="bid-actions"><button className="primary" disabled={game.paused||!canBid(game,game.teamId)} onClick={()=>update(g=>placeBid(g,g.teamId))}>{game.leader===game.teamId?'You lead':game.passed.includes(game.teamId)?'Passed':'BID '+money(nextBid(game))} ↑</button><button disabled={game.paused||game.leader===game.teamId||game.passed.includes(game.teamId)} onClick={()=>update(pass)}>Pass</button></div>
                {game.passed.includes(game.teamId)&&<button className="small skip-lot" disabled={game.paused} onClick={()=>update(finishLot)}>Fast-forward this lot →</button>}
                {!canBid(game,game.teamId)&&game.leader!==game.teamId&&!game.passed.includes(game.teamId)&&<p className="muted">Purse reserve or squad limit reached for this player.</p>}
              </>:<div className="sale-result" aria-live="assertive"><strong>{game.stage==='SOLD'?'SOLD!':'UNSOLD'}</strong><p>{game.message}</p><button className="primary" onClick={()=>update(advance)}>Next player →</button></div>}
            </>:<div className="finish"><span className="eyebrow">HAMMER DOWN</span><h2>Auction complete.</h2><p>You built a squad of {squad.length} players.</p>{squad.length<18&&<p>Your squad is short of the 18-player target.</p>}<button className="primary" onClick={share}>Share your squad ↗</button></div>}
            <p className="auction-call" role="status">{game.message}</p>
          </section>
          <aside className="team-board"><div className="section-label"><h2>The room</h2><span>10 franchises</span></div>{teams.map(t=><div key={t.id} className={'franchise '+(game.leader===t.id?'leading':'')} style={{'--franchise':t.color} as React.CSSProperties}><Logo id={t.id}/><div><b>{t.id.toUpperCase()} {t.id===game.teamId&&<small>YOU</small>}</b><span>{game.squads[t.id].length}/25 players</span></div><strong>{money(game.purses[t.id])}</strong>{game.leader===t.id&&<i/>}</div>)}</aside>
        </div>
        <section className="your-desk"><div className="desk-heading"><Logo id={game.teamId}/><div><span className="eyebrow">YOUR FRANCHISE</span><h2>{team.name}</h2></div><div className="desk-budget"><span>PURSE LEFT</span><strong>{money(game.purses[game.teamId])}</strong></div></div>
          <div className="squad-status"><span>{squad.length}/25 players · {squad.filter(m=>findPlayer(m.id).isOverseas).length}/8 overseas</span>{rating&&<strong>Squad rating {rating.overallRating.toFixed(1)}/100 · {rating.tier}{squad.length<11?' · Incomplete squad':''}</strong>}</div><div className="controls"><button className="primary" disabled={game.stage==='COMPLETE'} onClick={toggle}>{game.paused?'▶ Start / resume':'Ⅱ Pause auction'}</button><button onClick={share}>Share squad ↗</button><button onClick={()=>{if(confirm('Replace this auction and start again?')){update(g=>({...g,paused:true}));setGame(null);}}}>New game</button></div>
          <nav className="desk-tabs" aria-label="Auction information">{['squad','queue','results'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='squad'?'Your squad ('+squad.length+')':t==='queue'?'Coming up':'Auction results'}</button>)}</nav>
          <div className="desk-list">{tab==='squad'?squad.length?squad.map(m=><div key={m.id}><span><b>{findPlayer(m.id).name}</b><small>{findPlayer(m.id).role.replaceAll('_',' ')} · {m.retained?'Retained':'Won at auction'}</small></span><strong>{money(m.price)}</strong></div>):<p>Your first signing is waiting. Raise your paddle.</p>:tab==='queue'?game.queue.slice(game.index+1,game.index+11).map(id=><div key={id}><b>{findPlayer(id).name}</b><span>{findPlayer(id).role.replaceAll('_',' ')}</span></div>):game.history.length?game.history.slice().reverse().map(h=><div key={h.id}><b>{findPlayer(h.id).name}</b><span>{h.teamId?h.teamId.toUpperCase()+' · '+money(h.price):'Unsold'}</span></div>):<p>The hammer has yet to fall.</p>}</div>
        </section>
      </>}
      <p className="footnote">Custom simulation · Base prices and computer bids are game assumptions. Progress saves on this device. Retention and auction saves are separate.</p>
    </main>
  </div>;
}
createRoot(document.getElementById('auction-root')!).render(<App/>);
