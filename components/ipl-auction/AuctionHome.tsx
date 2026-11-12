'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { api,ErrorBox,Loading,money,Notice,TeamLogo } from './shared';
import type { Rules } from '@/lib/ipl-auction/engine';
import type { Team } from '@/lib/ipl-auction/types';
type Season={id:string;name:string;year:number;rules:Array<{name:string;config:Rules}>};
type Saved={id:string;state:string;updatedAt:string;team:Team;season:{name:string}};
export default function AuctionHome(){const [seasons,setSeasons]=useState<Season[]|null>(null),[saved,setSaved]=useState<Saved[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;api<Season[]>('/api/ipl-auction/seasons').then(data=>active&&setSeasons(data)).catch(e=>active&&setError(e.message));fetch('/api/ipl-auction/sessions',{cache:'no-store'}).then(r=>r.ok?r.json():[]).then(data=>active&&setSaved(data)).catch(()=>{});return()=>{active=false;};},[retry]);
 const firstSeason=seasons?.[0];
 const campaignHref=firstSeason?`/ipl-auction/teams?season=${encodeURIComponent(firstSeason.id)}`:null;
 return <div className="mock-squad-home">
  <nav aria-label="Auction home"><a className="brand" href="/">THE CRICKET <b>SPACE</b></a><span className="saved"><i className="dot" aria-hidden="true"/>Saved on this device</span></nav>
  <header className="hero">
   <h1>IPL Mock <span>Squad</span></h1>
   <p className="lead">10 franchises. One chair with your name on it. Retain your core, release the rest, then win the room.</p>
   <div className="row">{campaignHref&&<Link className="btn" href={campaignHref}>Start a campaign</Link>}<a className="btn ghost" href="#war">Resume saved game</a></div>
  </header>
  <details className="note"><summary>Simulation, not a prediction <i>Tap to read</i></summary><Notice/></details>
  <section id="campaign">
   <div className="head"><h2>The season starts here.</h2><span className="pill">Retention phase</span></div>
   {error?<ErrorBox message={error} retry={()=>{setError('');setRetry(r=>r+1);}}/>:!seasons?<Loading/>:seasons.length===0?<div className="surface">No simulation seasons are available yet.</div>:seasons.map(s=>
    <Link className="camp" key={s.id} href={`/ipl-auction/teams?season=${encodeURIComponent(s.id)}`}>
     <div className="tag">Custom simulation · 2026 baseline + confirmed 2027 trades</div>
     <h3>{s.name}</h3><p>10 franchises. One chair with your name on it.</p>
     <div className="chips"><span className="chip">{money(s.rules[0]?.config.purseLakh||0)} starting purse</span><span className="chip">{s.rules[0]?.config.costMode==='SALARY'?'Salary-based · no retention-count cap':`Up to ${s.rules[0]?.config.maxRetentions} retentions`}</span><span className="chip">Save &amp; resume</span></div>
     <div className="teams" aria-label="Franchises">{franchiseChips.map(([label,color])=><span key={label} className="tm" style={{background:color}}>{label}</span>)}</div>
     <span className="go" aria-hidden="true">↗</span>
    </Link>)}
  </section>
  <section className="war" id="war">
   <div className="head"><h2>Your war room</h2></div>
   {saved.map(s=><div key={s.id} className="empty"><div className="team-logo-title"><TeamLogo team={s.team}/><div><strong>{s.team.name}</strong><span>{s.season.name} · {s.state==='CONFIRMED'?'Locked retentions':'In progress'}</span></div></div><Link className="btn" href={`/ipl-auction/retention/${s.id}`}>Resume simulation</Link></div>)}
   {saved.length===0&&<div className="empty"><div><strong>No saved game yet</strong><span>Start a campaign and your latest game will appear here. Only the latest game is kept on this device.</span></div>{campaignHref&&<Link className="btn" href={campaignHref}>Start a campaign</Link>}</div>}
  </section>
 </div>;
}
const franchiseChips=[['CSK','#a77900'],['MI','#1f6fd1'],['RCB','#b3121d'],['KKR','#5b2a86'],['GT','#27406e'],['LSG','#087996'],['RR','#c72b61'],['SRH','#b84020'],['PBKS','#d11f2e'],['DC','#2a63c9']];
