import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import StaticImage from '../image';
import {teams,findPlayer,nextBid,canBid,money,type Game} from './engine';
import './room.css';

const API='https://cricketspace-auction-rooms.aridtulip16.chatgpt.site';
const SAVE='tcs-multiplayer-last-v1';
type Credentials={code:string;token:string};
type Snapshot={code:string;version:number;hostId:string;me:string;serverNow:number;members:Array<{id:string;name:string;teamId:string}>;game:Game|null};
const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
function restore():Credentials|null{
  try{const invite=new URLSearchParams(location.search).get('room')?.toUpperCase();const value=JSON.parse(localStorage.getItem(SAVE)||'null');if(invite&&invite!==value?.code)return null;return /^[A-F0-9]{10}$/.test(value?.code)&&/^[a-f0-9]{64}$/.test(value?.token)?value:null;}catch{return null;}
}
function Logo({id}:{id:string}){return <StaticImage src={'/ipl-auction/logos/'+id+'.png'} width="44" height="44" alt={id.toUpperCase()}/>;}
async function request(path:string,body:unknown,token?:string,signal?:AbortSignal){
  const controller=new AbortController();
  const cancel=()=>controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(cancel,7000);
  try{
  const response=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'The room could not be reached.');
  return data;
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
function App(){
  const [credentials,setCredentials]=useState<Credentials|null>(restore),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [name,setName]=useState(''),[code,setCode]=useState(new URLSearchParams(location.search).get('room')||''),[selected,setSelected]=useState('rcb');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false),[notice,setNotice]=useState('');
  const latest=useRef<Snapshot|null>(null),inFlight=useRef(false);
  const receive=useCallback((value:Snapshot)=>{
    if(latest.current?.code===value.code&&latest.current.version>value.version)return;
    latest.current=value;setSnapshot(value);setConnected(true);
  },[]);
  useEffect(()=>{
    if(!credentials)return;
    const controller=new AbortController();
    let stopped=false,timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{
        const value=await request('/rooms/'+credentials!.code,undefined,credentials!.token,controller.signal);
        if(!stopped)receive(value);
      }catch(e){if(!stopped){setConnected(false);setError((e as Error).message);}}
      if(!stopped)timer=setTimeout(poll,1000);
    }
    void poll();
    return()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[credentials,receive]);
  async function enter(join:boolean){
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');
    try{
      const cleanCode=code.trim().toUpperCase();
      if(join&&!/^[A-F0-9]{10}$/.test(cleanCode))throw Error('Enter the 10-character room code.');
      let pending:{code:string;token:string}|null=null;
      try{pending=JSON.parse(localStorage.getItem(SAVE+'-pending')||'null');}catch{}
      const token=pending?.code===cleanCode&&/^[a-f0-9]{64}$/.test(pending.token)?pending.token:nonce()+nonce();
      localStorage.setItem(SAVE+'-pending',JSON.stringify({code:cleanCode,token}));
      const result=await request(join?'/rooms/'+cleanCode+'/join':'/rooms',{name,teamId:selected,token});
      const saved={code:result.snapshot.code,token:result.token};
      localStorage.setItem(SAVE,JSON.stringify(saved));localStorage.removeItem(SAVE+'-pending');
      latest.current=null;setCredentials(saved);receive(result.snapshot);
      history.replaceState(null,'',location.pathname+'?room='+saved.code);
    }catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}
  }
  async function act(action:string,teamId?:string){
    if(inFlight.current||!credentials||!snapshot)return;
    inFlight.current=true;setBusy(true);setError('');setNotice('');
    const game=snapshot.game;
    const command={action,nonce:nonce(),...(teamId?{teamId}:{}),...(game&&game.stage!=='COMPLETE'?{lotId:game.queue[game.index],price:nextBid(game)}:{})};
    try{receive(await request('/rooms/'+credentials.code+'/actions',command,credentials.token));}
    catch(e){setError((e as Error).message);}
    finally{inFlight.current=false;setBusy(false);}
  }
  async function invite(){
    if(!credentials)return;
    const link=location.origin+location.pathname+'?room='+credentials.code;
    try{await navigator.clipboard.writeText(link);setNotice('Invite link copied. Send it to your friends.');}catch{setNotice('Room code: '+credentials.code);}
  }
  function leave(){
    setCredentials(null);latest.current=null;setSnapshot(null);
    history.replaceState(null,'',location.pathname);
  }
  const me=snapshot?.members.find(m=>m.id===snapshot.me);
  const host=snapshot?.hostId===snapshot?.me;
  const game=snapshot?.game;
  const player=game&&game.stage!=='COMPLETE'?findPlayer(game.queue[game.index]):null;
  const team=teams.find(t=>t.id===(me?.teamId||selected))!;
  return <div className="room" style={{'--team':team.color} as React.CSSProperties}>
    <header className="room-nav"><a href="/">THE CRICKET <span>SPACE</span></a><a href="play.html">Single player ↗</a></header>
    <main><div className="room-heading"><div><span className="eyebrow">IPL 2027 · FRIENDS EDITION</span><h1>MULTIPLAYER ROOM<span>.</span></h1></div><span className="live-label"><i/>{credentials?(connected?'CONNECTED':'RECONNECTING'):'2–10 PLAYERS'}</span></div>
      {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
      {!credentials?<section className="setup"><div><h2>Bring your rivals.</h2><p>Create a room, send the code and choose your franchises. Unclaimed teams are controlled by the computer.</p></div>
        <label className="mp-label">Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="Name or nickname" autoComplete="nickname"/></label>
        <div className="team-picker">{teams.map(t=><button key={t.id} aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}><Logo id={t.id}/>{t.id.toUpperCase()}</button>)}</div>
        <div className="controls"><button className="primary" disabled={busy||!name.trim()} onClick={()=>void enter(false)}>Create room ↗</button></div>
        <div className="mp-join"><label className="mp-label">Have an invite?<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={10} placeholder="10-character room code" autoCapitalize="characters" spellCheck={false}/></label><button disabled={busy||!name.trim()} onClick={()=>void enter(true)}>Join room →</button></div>
        {restore()&&<button onClick={()=>setCredentials(restore())}>Resume saved room ↗</button>}<p className="muted">No account required. Keep this browser’s room save to reconnect. Rooms expire after 24 hours.</p>
      </section>:!snapshot?<section className="setup"><p>Reconnecting to your room…</p><button onClick={leave}>Back</button></section>:<>
        <div className="mp-invite"><div><span className="eyebrow">ROOM CODE</span><strong>{snapshot.code}</strong></div><button onClick={()=>void invite()}>Copy invite link ↗</button><button className="small" onClick={leave}>Back</button></div>
        {!game?<section className="setup"><div><h2>Choose your seat.</h2><p>{snapshot.members.length}/10 friends joined. {host?'Start when everyone is ready.':'Waiting for the host to start.'}</p></div>
          <div className="team-picker">{teams.map(t=>{const member=snapshot.members.find(m=>m.teamId===t.id);return <button key={t.id} disabled={busy||!connected||!!member&&member.id!==snapshot.me} aria-pressed={me?.teamId===t.id} onClick={()=>void act('TEAM',t.id)}><Logo id={t.id}/>{t.id.toUpperCase()}<small>{member?.name||'Computer / available'}</small></button>;})}</div>
          {host&&<button className="primary" disabled={busy||!connected||snapshot.members.length<2} onClick={()=>void act('START')}>Start auction · {snapshot.members.length} players →</button>}
        </section>:<><div className="auction-layout">
          <section className={'player-stage '+(game.stage==='SOLD'?'sold-stage':'')}>
            <div className="stage-top"><span>LOT {Math.min(game.index+1,game.queue.length)} / {game.queue.length}</span>{host&&<button className="small" disabled={busy||!connected||game.stage==='COMPLETE'} onClick={()=>void act(game.paused?'RESUME':'PAUSE')}>{game.paused?'▶ Resume':'Ⅱ Pause'}</button>}</div>
            {player?<><div className="player-art" aria-hidden="true"><strong>{player.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</strong><span>{player.role.replaceAll('_',' ')}</span></div><h2>{player.name}</h2><p className="player-meta">{player.nationality} · {player.role.replaceAll('_',' ')}</p>
              <div className="bid-display"><span>{game.leader?'CURRENT BID':'OPENING PRICE'}</span><strong>{money(game.leader?game.bid:nextBid(game))}</strong><div>{game.leader?<><Logo id={game.leader}/>{game.leader.toUpperCase()} LEADS</>:'Raise your paddle'}</div></div>
              {game.stage==='BIDDING'?<><div className={'timer '+(game.seconds<=3?'urgent':'')}><span>{game.paused?'Host paused the clock':game.seconds<=2?'Going twice…':game.seconds<=4?'Going once…':'Bidding open'}</span><b>{game.seconds}s</b><progress max="10" value={game.seconds}/></div><div className="bid-actions"><button className="primary" disabled={busy||!connected||game.paused||!canBid(game,game.teamId)} onClick={()=>void act('BID')}>{game.leader===game.teamId?'You lead':game.passed.includes(game.teamId)?'Passed':'BID '+money(nextBid(game))} ↑</button><button disabled={busy||!connected||game.paused||game.leader===game.teamId||game.passed.includes(game.teamId)} onClick={()=>void act('PASS')}>Pass</button></div></>:<div className="sale-result"><strong>{game.stage==='SOLD'?'SOLD!':'UNSOLD'}</strong><p>{game.message}</p>{host?<button className="primary" disabled={busy||!connected} onClick={()=>void act('NEXT')}>Next player →</button>:<p>Waiting for the host to bring in the next player.</p>}</div>}
            </>:<div className="finish"><h2>Auction complete.</h2><p>Your squad has {game.squads[game.teamId].length} players.</p></div>}
            <p className="auction-call" role="status">{game.message}</p>
          </section>
          <aside className="team-board"><div className="section-label"><h2>The room</h2><span>{snapshot.members.length} friends</span></div>{teams.map(t=>{const human=snapshot.members.find(m=>m.teamId===t.id);return <div key={t.id} className={'franchise '+(game.leader===t.id?'leading':'')} style={{'--franchise':t.color} as React.CSSProperties}><Logo id={t.id}/><div><b>{t.id.toUpperCase()} {t.id===game.teamId&&<small>YOU</small>}</b><span>{human?.name||'Computer'} · {game.squads[t.id].length}/25</span></div><strong>{money(game.purses[t.id])}</strong></div>;})}</aside>
        </div><section className="your-desk"><div className="desk-heading"><Logo id={game.teamId}/><div><span className="eyebrow">YOUR FRANCHISE</span><h2>{team.name}</h2></div><div className="desk-budget"><span>PURSE LEFT</span><strong>{money(game.purses[game.teamId])}</strong></div></div><div className="desk-list">{game.squads[game.teamId].length?game.squads[game.teamId].map(m=><div key={m.id}><b>{findPlayer(m.id).name}</b><strong>{money(m.price)}</strong></div>):<p>Your first signing is waiting.</p>}</div></section></>}
      </>}
      <p className="footnote">Private invite room · Server-validated bids · Fresh ₹130 Cr auction · Simulation base prices · Saves reconnect on this browser.</p>
    </main>
  </div>;
}
createRoot(document.getElementById('auction-root')!).render(<App/>);
