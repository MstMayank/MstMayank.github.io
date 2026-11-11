import React from 'react';
export const hrefFor=(href:string)=>href.startsWith('/ipl-auction')?'/ipl-auction/#'+(href.slice('/ipl-auction'.length)||'/'):href;
export default function Link({href,children,...props}:React.AnchorHTMLAttributes<HTMLAnchorElement> & {href:string}){return <a {...props} href={hrefFor(href)}>{children}</a>;}
export function useRouter(){return {push:(href:string)=>{window.location.hash=hrefFor(href).split('#')[1]||'/';}};}
export function Image(props:React.ImgHTMLAttributes<HTMLImageElement>&{unoptimized?:boolean}){const imageProps={...props};delete imageProps.unoptimized;
 // Static Pages has no Next image optimizer; this displays a generated local PNG.
 // eslint-disable-next-line @next/next/no-img-element
 return <img {...imageProps} alt={props.alt||''}/>;}
