
(() => {
  // Theme: a sun/moon button in the header. No saved choice = follow the phone or computer setting.
  const root = document.documentElement;
  const systemLight = matchMedia('(prefers-color-scheme: light)');
  const current = () => root.getAttribute('data-theme') || (systemLight.matches ? 'light' : 'dark');
  const bar = document.querySelector('.site-nav .bar');
  if (bar && !bar.querySelector('.theme-toggle')) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'theme-toggle';
    const paint = () => {
      const light = current() === 'light';
      button.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
      button.title = button.getAttribute('aria-label');
      button.innerHTML = light
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.8v2.6M12 19.6v2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M1.8 12h2.6M19.6 12h2.6M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8"/></svg>';
    };
    button.addEventListener('click', () => {
      const next = current() === 'light' ? 'dark' : 'light';
      root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 400);
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('tcs-theme', next); } catch (e) {}
      paint();
      document.dispatchEvent(new CustomEvent('tcs-theme', {detail: next}));
    });
    systemLight.addEventListener?.('change', paint);
    paint();
    bar.insertBefore(button, bar.querySelector('.nav-toggle') || bar.lastElementChild);
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = document.querySelector('.nav-toggle');
  const links = document.getElementById('site-links');
  if (toggle) { toggle.textContent = '☰'; toggle.setAttribute('aria-label','Navigation'); }
  function closeMenu() {
    links?.classList.remove('open');
    toggle?.setAttribute('aria-expanded','false');
    document.body.classList.remove('menu-open');
  }
  toggle?.addEventListener('click', () => {
    const open = !links.classList.contains('open');
    links.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent = open ? '×' : '☰';
    document.body.classList.toggle('menu-open', open);
  });
  // Mark the current section in the header (one shared header on every page).
  const here = location.pathname.replace(/\/index\.html$/, '/').split('/').pop() || '';
  links?.querySelectorAll('a').forEach(link => {
    const target = new URL(link.href, location.href);
    if (!target.hash && target.pathname.split('/').pop() === here && here) link.setAttribute('aria-current', 'page');
  });
  matchMedia('(min-width: 961px)').addEventListener?.('change', event => { if (event.matches) closeMenu(); });
  links?.querySelectorAll('a').forEach(link => link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event => {
    if(event.key==='Escape' && links?.classList.contains('open')) {
      closeMenu();
      toggle.focus();
    }
  });
  document.addEventListener('click',event => {
    if(links?.classList.contains('open') && !links.contains(event.target) && !toggle.contains(event.target)) closeMenu();
  });
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
