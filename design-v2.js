
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
  const day=document.getElementById('otd-d');
  if(day) {
    const moments={
  '11-12': {
    date: '2023-11-12',
    title: 'KL Rahul hits India’s fastest World Cup hundred',
    summary: 'KL Rahul scored 102 off 62 balls against the Netherlands in Bengaluru, setting the record for the fastest men’s ODI World Cup century by an Indian. India won by 160 runs.'
  },
  '11-11': {
    date: '1994-11-11',
    title: 'Sanju Samson is born',
    summary: 'Indian wicketkeeper-batter Sanju Samson was born on 11 November 1994.'
  },
  '11-10': {
    date: '1991-11-10',
    title: 'South Africa Returns to International Cricket',
    summary: 'After more than 21 years away, South Africa returned to international cricket in their first-ever ODI, against India at Eden Gardens, Kolkata. India won by three wickets.'
  },
  '04-18': {
    date: '2008-04-18',
    title: 'McCullum’s 158* opens the IPL',
    url: 'https://www.iplt20.com/news/article/ipl-has-changed-the-way-the-game-is-played-mccullum'
  }
};
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
    day.textContent=parts.day;
    document.getElementById('otd-m').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',month:'long'}).format(new Date());
    const container=document.getElementById('otd-b');
    const moment=moments[parts.month+'-'+parts.day];
    const label=document.createElement('span'); label.className='live';label.textContent='Today in cricket';
    const heading=document.createElement('h3');heading.className='D';
    const text=document.createElement('p');
    if(moment) {
      const year=document.createElement('span');year.className='yr D';year.textContent=moment.date.slice(0,4);
      heading.textContent=moment.title;text.textContent=moment.summary || '';
      container.replaceChildren(label,year,heading,text);
    } else {
      heading.textContent='A new day. More cricket.';
      text.textContent='A cricket history moment for this date will appear here when published.';
      container.replaceChildren(label,heading,text);
    }
  }
})();
