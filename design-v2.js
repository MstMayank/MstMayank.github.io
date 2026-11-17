
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('site-links');
  function closeMenu() {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
  }
  toggle?.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
  });
  links?.querySelectorAll('a').forEach(link => link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event => { if(event.key==='Escape') closeMenu(); });
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent=new Date().getFullYear(); });
  document.querySelectorAll('[data-split]').forEach(heading => {
    let index=0;
    heading.querySelectorAll('.ln').forEach(line => {
      const text=line.textContent;
      line.setAttribute('aria-label',text);
      line.replaceChildren(...Array.from(text,char => {
        const span=document.createElement('span');
        span.className='ch';
        span.setAttribute('aria-hidden','true');
        span.style.setProperty('--i',index++);
        span.textContent=char===' ' ? ' ' : char;
        return span;
      }));
    });
  });
  const reveals=document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries => entries.forEach(entry => {
      if(entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    }),{threshold:.1});
    reveals.forEach(element => observer.observe(element));
  } else reveals.forEach(element => element.classList.add('in'));
  const progress=document.getElementById('prog');
  const ball=document.getElementById('ball');
  const marquee=document.getElementById('mq');
  function scrollEffects() {
    const total=document.documentElement.scrollHeight-innerHeight;
    if(progress)progress.style.width=(total>0 ? scrollY/total*100 : 0)+'%';
    if(!reduced) {
      if(ball)ball.style.transform='rotate('+scrollY*.25+'deg)';
      if(marquee)marquee.style.transform='translateX('+(-scrollY*.3)+'px)';
    }
  }
  addEventListener('scroll',scrollEffects,{passive:true});
  scrollEffects();
  if(!reduced && matchMedia('(pointer:fine)').matches) addEventListener('pointermove',event => {
    const spot=document.getElementById('spot');
    if(spot){spot.style.setProperty('--x',event.clientX+'px');spot.style.setProperty('--y',event.clientY+'px');}
    const panel=event.target.closest('.pnl');
    if(panel) { const rect=panel.getBoundingClientRect();panel.style.setProperty('--mx',event.clientX-rect.left+'px');panel.style.setProperty('--my',event.clientY-rect.top+'px'); }
  },{passive:true});
  const form=document.getElementById('idea-form');
  form?.addEventListener('submit',event => {
    event.preventDefault();
    const idea=document.getElementById('idea').value.trim();
    if(!idea)return;
    location.href='mailto:infocricketspace@gmail.com?subject='+encodeURIComponent('Project idea for The Cricket Space')+'&body='+encodeURIComponent(idea);
    document.getElementById('idea-status').textContent='Your email app will open with your idea ready to send.';
  });
})();
