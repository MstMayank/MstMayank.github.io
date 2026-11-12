'use client';
import {useEffect,useMemo,useState} from 'react';
import type {SessionView}from '@/lib/ipl-auction/types';
import {renderSquadCard,squadShareModel}from '@/lib/ipl-auction/squad-share';
import {shareSquadFile}from '@/lib/ipl-auction/native-share';
export default function SquadShare({session,disabled}:{session:SessionView;disabled:boolean}){
 const model=useMemo(()=>squadShareModel(session,'DECIDED'),[session]);
 const signature=JSON.stringify(model);
 const [prepared,setPrepared]=useState<{signature:string;file:File}|null>(null),[generationError,setGenerationError]=useState(''),[status,setStatus]=useState(''),[sharing,setSharing]=useState(false);
 // Prepare privately so the eventual click can invoke native sharing synchronously.
 // No canvas/image preview, object URL, or download link is attached to the page.
 useEffect(()=>{let active=true;
  async function prepare(){try{if(!navigator.share||!navigator.canShare)throw new Error('Image sharing is not supported by this browser.');if(!model.players.length)return;const rating=model.retained?await import('@/browser-auction/squad-rating-data').then(({buildRating})=>buildRating(session).overallRating):null;const file=await renderSquadCard(model,rating);if(active){setPrepared({signature,file});setGenerationError('');}}catch(error){if(active)setGenerationError((error as Error).message);}}
  void prepare();return()=>{active=false;};
 },[model,session,signature]);
 const file=prepared?.signature===signature?prepared.file:null;
 const preparing=model.players.length>0&&!file&&!generationError;
 async function share(){if(generationError){setStatus(generationError);return;}if(!file)return;setSharing(true);setStatus('');const message=await shareSquadFile(file);setStatus(message);setSharing(false);}
 return <><button className="button secondary" disabled={disabled||preparing||sharing||!model.players.length} aria-busy={preparing||sharing} onClick={()=>void share()}>{sharing?'Opening share menu…':preparing?'Preparing squad card…':'Share your squad'} <span aria-hidden="true">↗</span></button>{status&&<p className="squad-share-status" role="status">{status}</p>}</>;
}
