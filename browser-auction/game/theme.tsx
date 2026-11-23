import {useEffect,useState} from 'react';

// Light/dark switch shared with the rest of the site (localStorage "tcs-theme").
// With no saved choice the page follows the device setting.
const light=()=>document.documentElement.getAttribute('data-theme')!=='dark';

export function ThemeToggle(){
  const [isLight,setLight]=useState(light);
  useEffect(()=>{const m=matchMedia('(prefers-color-scheme: light)');const f=()=>setLight(light());m.addEventListener?.('change',f);return()=>m.removeEventListener?.('change',f);},[]);
  const label=isLight?'Switch to dark theme':'Switch to light theme';
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={()=>{
    const next=isLight?'dark':'light';
    document.documentElement.setAttribute('data-theme',next);
    try{localStorage.setItem('tcs-theme',next);}catch{}
    setLight(next==='light');
  }}>{isLight
    ?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>
    :<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.6M12 19.6v2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M1.8 12h2.6M19.6 12h2.6M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>}</button>;
}
