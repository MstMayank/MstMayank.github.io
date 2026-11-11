'use client';
import {useState} from 'react';
import type {SessionView} from '@/lib/ipl-auction/types';
import SquadRating from './SquadRating';
import SquadShare from './SquadShare';
export default function SquadTools({session,disabled}:{session:SessionView;disabled:boolean}){
 const [open,setOpen]=useState<'RATE'|'SHARE'|null>(null);
 return <section className="squad-tools" aria-label="Squad options"><div className="squad-tool-buttons"><button className="button secondary" disabled={disabled||!session.totals.retained} aria-expanded={open==='RATE'} aria-controls="squad-rate-panel" onClick={()=>setOpen(open==='RATE'?null:'RATE')}>Rate your squad <span aria-hidden="true">{open==='RATE'?'−':'+'}</span></button><button className="button secondary" disabled={disabled} aria-expanded={open==='SHARE'} aria-controls="squad-share-panel" onClick={()=>setOpen(open==='SHARE'?null:'SHARE')}>Share your squad <span aria-hidden="true">{open==='SHARE'?'−':'+'}</span></button></div>{open==='RATE'&&<div id="squad-rate-panel"><SquadRating session={session} disabled={disabled} autoRun/></div>}{open==='SHARE'&&<div id="squad-share-panel"><SquadShare session={session} disabled={disabled} compact/></div>}</section>;
}
