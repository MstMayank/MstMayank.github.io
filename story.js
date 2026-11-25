// "Six balls that made me": the homepage story as one living over.
// - Laptops and desktops: the section holds while you scroll or click any ball (0.1 to 0.6).
// - Phones (and reduced motion): a normal sideways swipe plus quick over-strip pills.
// - Each card plays its own interactive cricket artifact and connects directly to the 3D universe.
(() => {
  const sec = document.getElementById('about'), track = document.getElementById('over');
  if (!sec || !track) return;
  const stage = sec.querySelector('.over-stage');
  const cards = [...track.children];
  const dots = [...sec.querySelectorAll('.over-track .balls i')];
  const pills = [...sec.querySelectorAll('.over-pill')];
  const label = document.getElementById('over-label');
  const pitchStrip = sec.querySelector('.pitch-strip');
  const pitchTag = document.getElementById('pitch-tag');
  const pitchOut = document.getElementById('pitch-out');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)');
  let cur = -1, pinned = false, dist = 0;

  const PITCH_META = [
    { tag: '0.1 · Bouncer · Johannesburg', out: '125-run gap', bx: '36%', ex: '86%' },
    { tag: '0.2 · Good length · Seam', out: 'The Wall', bx: '56%', ex: '84%' },
    { tag: '0.3 · In the slot · Lofted', out: 'Six!', bx: '72%', ex: '92%' },
    { tag: '0.4 · Straight · Classic', out: '100 hundreds', bx: '62%', ex: '88%' },
    { tag: '0.5 · Yorker · 145 km/h', out: 'New era', bx: '82%', ex: '90%' },
    { tag: '0.6 · Full toss · Into orbit', out: 'Over complete', bx: '74%', ex: '94%' }
  ];

  // ---------- one-time animations per card ----------
  const countUp = (el, ms) => {
    const to = +el.dataset.to; if (reduce) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = now => { const t = Math.min(1, (now - t0) / ms), k = 1 - Math.pow(1 - t, 3); el.textContent = Math.round(to * k); if (t < 1) requestAnimationFrame(step); };
    el.textContent = 0; requestAnimationFrame(step);
  };

  // Bricks for the Wall, built once.
  const bricks = sec.querySelector('.wall .bricks');
  if (bricks) for (let r = 0; r < 7; r++) for (let c = 0; c < (r % 2 ? 7 : 6); c++) {
    const b = document.createElement('i'); b.style.setProperty('--r', r); b.style.setProperty('--c', c); if (r % 2) b.classList.add('off'); bricks.appendChild(b);
  }

  // Ball 2: interactive format selector on the Wall
  const wallReadout = document.getElementById('wall-readout');
  const wallChips = [...sec.querySelectorAll('.w-chip')];
  wallChips.forEach(btn => btn.addEventListener('click', () => {
    wallChips.forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    if (wallReadout) wallReadout.textContent = btn.dataset.wall || '';
  }));

  // Ball 3: Dhoni knock toggle
  const dhoniNote = document.getElementById('dhoni-note');
  const knockBtns = [...sec.querySelectorAll('.knock-btn')];
  const KNOCK_NOTES = {
    vizag: '2005 · Vizag · His breakthrough 148 against Pakistan',
    jaipur: '2005 · Jaipur · Unbeaten 183* chasing against Sri Lanka'
  };
  knockBtns.forEach(btn => btn.addEventListener('click', () => {
    knockBtns.forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    if (dhoniNote) dhoniNote.textContent = KNOCK_NOTES[btn.dataset.knock] || '';
  }));

  // Ball 4: 100 international centuries constellation (51 Test + 49 ODI)
  const centuryGrid = document.getElementById('century-grid');
  const sachinNote = document.getElementById('sachin-star-note');
  const SACHIN_KEYS = {
    0: '#1 · Maiden Test hundred · Old Trafford 1990',
    49: '#50 · Halfway to the century of centuries',
    86: '#87 · 200* vs South Africa · Gwalior 2010',
    99: '#100 · 100th international hundred · Mirpur 2012'
  };
  if (centuryGrid) {
    for (let k = 0; k < 100; k++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'c-tile' + (k >= 51 ? ' odi' : '') + (SACHIN_KEYS[k] ? ' key' : '') + (k === 99 ? ' on' : '');
      tile.setAttribute('aria-label', `Century ${k + 1} of 100 (${k < 51 ? 'Test' : 'ODI'})`);
      const show = () => {
        centuryGrid.querySelectorAll('.c-tile.on').forEach(el => el.classList.remove('on'));
        tile.classList.add('on');
        if (sachinNote) sachinNote.textContent = SACHIN_KEYS[k] || `Century #${k + 1} of 100 · ${k < 51 ? 'Test' : 'ODI'} · 34,357 Intl runs`;
      };
      tile.addEventListener('pointerenter', show);
      tile.addEventListener('click', show);
      centuryGrid.appendChild(tile);
    }
  }

  // Fly straight to a star in the 3D hero universe
  sec.querySelectorAll('[data-fly]').forEach(btn => {
    btn.addEventListener('click', () => {
      dispatchEvent(new CustomEvent('tcs:fly-slug', { detail: { slug: btn.dataset.fly } }));
    });
  });

  // Numbers show their real value until their ball is bowled, then count up from zero.
  function play(i) {
    const c = cards[i]; if (!c || c.classList.contains('play')) return;
    c.classList.add('play');
    c.querySelectorAll('[data-to]').forEach(el => countUp(el, i === 3 ? 1300 : 1100));
  }

  // ---------- the over tracker & pitch bar ----------
  function set(i) {
    if (i === cur) return;
    const prev = cur; cur = i;
    dots.forEach((d, j) => { d.classList.toggle('on', j <= i); d.classList.toggle('just', j === i && i > prev && !reduce); });
    pills.forEach((p, j) => {
      p.classList.toggle('on', j === i);
      p.classList.toggle('faced', j <= i);
      p.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    const pm = PITCH_META[i];
    if (pm && pitchStrip) {
      pitchStrip.style.setProperty('--bx', pm.bx);
      pitchStrip.style.setProperty('--ex', pm.ex);
      if (pitchTag) pitchTag.textContent = pm.tag;
      if (pitchOut) pitchOut.textContent = pm.out;
    }
    label.textContent = `Ball ${i + 1} of 6`;
    play(i);
    sec.classList.toggle('over-done', i === cards.length - 1);
  }

  // ---------- desktop: hold the section and slide the cards with the page scroll ----------
  function measure() {
    pinned = wide.matches && !reduce;
    sec.classList.toggle('pin', pinned);
    track.style.transform = '';
    if (!pinned) { sec.style.height = ''; return; }
    const last = cards[cards.length - 1], endSpace = parseFloat(getComputedStyle(track, '::after').flexBasis) || 0;
    dist = Math.max(0, last.offsetLeft + last.offsetWidth + endSpace - track.clientWidth);
    sec.style.height = (stage.offsetHeight + Math.max(dist, innerHeight * .34 * (cards.length - 1))) + 'px';
    onScroll();
  }
  function progress() {
    const top = sec.getBoundingClientRect().top, run = sec.offsetHeight - stage.offsetHeight;
    return run > 0 ? Math.min(1, Math.max(0, -top / run)) : 0;
  }
  let ticking = false;
  function onScroll() {
    if (!pinned) return;
    const p = progress();
    track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px, 0, 0)`;
    set(Math.min(cards.length - 1, Math.floor(p * cards.length * .999)));
  }
  addEventListener('scroll', () => { if (pinned && !ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });

  // ---------- phones: sideways swipe ----------
  const nearest = () => {
    if (track.scrollLeft > 0 && track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) return cards.length - 1;
    const x = track.scrollLeft + track.clientWidth * .35; let best = 0; cards.forEach((c, i) => { if (c.offsetLeft <= x) best = i; }); return best;
  };
  let hold = 0, swipeTick = false;
  track.addEventListener('scroll', () => { if (pinned || swipeTick) return; swipeTick = true; requestAnimationFrame(() => { swipeTick = false; if (performance.now() - hold > 700) set(nearest()); }); }, { passive: true });

  // ---------- jump, arrows and keys ----------
  function goTo(i) {
    const idx = Math.max(0, Math.min(cards.length - 1, i));
    if (pinned) {
      const run = sec.offsetHeight - stage.offsetHeight, top = sec.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + run * ((idx + .5) / cards.length), behavior: reduce ? 'auto' : 'smooth' });
    } else {
      track.scrollTo({ left: cards[idx].offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: reduce ? 'auto' : 'smooth' });
      hold = performance.now(); set(idx);
    }
  }
  function go(d) { goTo((cur < 0 ? 0 : cur) + d); }
  pills.forEach(p => p.addEventListener('click', () => goTo(+p.dataset.ball)));
  document.getElementById('over-prev').addEventListener('click', () => go(-1));
  document.getElementById('over-next').addEventListener('click', () => go(1));
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });

  // ---------- laptops: cards tilt slightly towards the mouse ----------
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) cards.forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(900px) rotateY(${(x * 4).toFixed(2)}deg) rotateX(${(-y * 3).toFixed(2)}deg)`;
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });

  if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { if (cur < 0) set(0); o.disconnect(); } }, { threshold: .2 }).observe(sec);
  else set(0);
  if (reduce) cards.forEach((c, i) => play(i));
  label.textContent = 'Ball 1 of 6';
  wide.addEventListener('change', measure);
  addEventListener('resize', () => { clearTimeout(measure.t); measure.t = setTimeout(measure, 150); });
  addEventListener('load', measure);
  measure();
})();
