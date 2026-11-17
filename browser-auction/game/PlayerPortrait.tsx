import React,{useState} from 'react';
import StaticImage from '../image';
import {playerPortrait} from './portraits';

export function PlayerPortrait({player,orbit=false}:{player:{name:string;role:string};orbit?:boolean}){
  const source=playerPortrait(player.name);
  const [failedSource,setFailedSource]=useState('');
  return <div className="player-art">
    {orbit&&<div className="orbit" aria-hidden="true"/>}
    {source&&failedSource!==source
      ?<StaticImage className="auction-portrait" src={source} alt={`${player.name} AI portrait`} width="180" height="180" onError={()=>setFailedSource(source)}/>
      :<><strong aria-hidden="true">{player.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</strong><span>{player.role.replaceAll('_',' ')}</span></>}
  </div>;
}
