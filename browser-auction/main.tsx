import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import AuctionHome from '../components/ipl-auction/AuctionHome';
import FranchiseSelection from '../components/ipl-auction/FranchiseSelection';
import RetentionDashboard from '../components/ipl-auction/RetentionDashboard';
import {PlayerDetail} from '../components/ipl-auction/shared';
import Link from './navigation';
function App(){const [route,setRoute]=useState(location.hash.startsWith('#/')?location.hash.slice(1):'/');useEffect(()=>{const change=()=>{if(location.hash&&!location.hash.startsWith('#/'))return;setRoute(location.hash.slice(1)||'/');window.scrollTo(0,0);};addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);const u=new URL(route,'https://local.invalid');const parts=u.pathname.split('/').filter(Boolean);let page;
 if(parts[0]==='teams')page=<FranchiseSelection seasonId={u.searchParams.get('season')||'ipl-2027-custom'}/>;
 else if(parts[0]==='retention'&&parts[1])page=<RetentionDashboard key={parts[1]} sessionId={parts[1]}/>;
 else if(parts[0]==='players'&&parts[1])page=<PlayerDetail key={parts[1]} playerId={parts[1]} sessionId={u.searchParams.get('sessionId')||undefined}/>;
 else page=<AuctionHome/>;
 return <div className="auction-app"><header className="auction-nav"><a className="auction-brand" href="/">tcs<span>.</span></a><Link href="/ipl-auction">AUCTION ROOM <span className="beta">PHASE 01</span></Link><a className="back-home" href="/">← Cricket Space</a></header><main className="auction-shell"><p className="fine-print">Saved on this device · Only your latest game is kept. Clearing browser data removes it.</p>{page}</main><footer className="auction-footer"><span>THE CRICKET SPACE / FAN-BUILT, GAME-READY.</span><span>Custom simulation. Not affiliated with the IPL or BCCI.</span></footer></div>;
}
createRoot(document.getElementById('auction-root')!).render(<App/>);
