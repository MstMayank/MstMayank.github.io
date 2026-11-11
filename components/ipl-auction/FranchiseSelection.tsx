'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api,ErrorBox,Loading,Notice,TeamCard } from './shared';
import type { Team,SessionView } from '@/lib/ipl-auction/types';
export default function FranchiseSelection({seasonId}:{seasonId:string}){const router=useRouter();const [teams,setTeams]=useState<Team[]|null>(null),[error,setError]=useState(''),[creating,setCreating]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;api<Team[]>(`/api/ipl-auction/teams?seasonId=${encodeURIComponent(seasonId)}`).then(rows=>active&&setTeams(rows)).catch(e=>active&&setError(e.message));return()=>{active=false;};},[seasonId,retry]);
 async function select(team:Team){if(creating)return;setCreating(team.id);setError('');try{const session=await api<SessionView>('/api/ipl-auction/sessions',{method:'POST',body:JSON.stringify({seasonId,franchiseId:team.id})});router.push(`/ipl-auction/retention/${session.id}`);}catch(e){setError((e as Error).message);setCreating('');}}
 return <><Link className="crumb" href="/ipl-auction">← Auction room</Link><div className="page-heading"><span className="eyebrow">01 / TAKE THE HOT SEAT</span><h1>Choose your<br/><em>colours.</em></h1><p>One franchise. Real players from official 2026 season rosters. Starting a new game replaces your previous saved game.</p></div><Notice/>{error&&<ErrorBox message={error} retry={()=>{setError('');setRetry(r=>r+1);}}/>}{!teams&&!error?<Loading/>:teams?.length===0?<div className="surface">No squads are available for this season.</div>:<div className="team-grid">{teams?.map(t=><TeamCard key={t.id} team={t} busy={!!creating} select={()=>select(t)}/>)}</div>}{creating&&<p role="status" className="saving-notice">Preparing your {teams?.find(t=>t.id===creating)?.shortName} room…</p>}<p className="fine-print">2026 season rosters include in-season replacements, so some lists exceed 25 players. This is a historical reference pool for your simulation, not a confirmed 2027 squad.</p></>;
}
