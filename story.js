// "Six balls that made me": the homepage story as one over.
// - Laptops and desktops: the section holds while you scroll and the six cards slide past, one ball each.
// - Phones (and reduced motion): a normal sideways swipe.
// - Each card plays its own small animation once, the first time it becomes the current ball.
// - The over tracker bowls a ball into each dot; ball six knocks the bails off.
(() => {
  const sec = document.getElementById('about'), track = document.getElementById('over');
  if (!sec || !track) return;
  const stage = sec.querySelector('.over-stage');
  const cards = [...track.children];
  const dots = [...sec.querySelectorAll('.over-track .balls i')];
  const label = document.getElementById('over-label');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)');
  let cur = -1, pinned = false, dist = 0;

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
  // Numbers show their real value until their ball is bowled, then count up from zero.
  function play(i) {
    const c = cards[i]; if (!c || c.classList.contains('play')) return;
    c.classList.add('play');
    c.querySelectorAll('[data-to]').forEach(el => countUp(el, i === 3 ? 1300 : 1100));
  }

  // ---------- the over tracker ----------
  function set(i) {
    if (i === cur) return;
    const prev = cur; cur = i;
    dots.forEach((d, j) => { d.classList.toggle('on', j <= i); d.classList.toggle('just', j === i && i > prev && !reduce); });
    label.textContent = `Ball ${i + 1} of 6`;
    play(i);
    if (i === cards.length - 1) sec.classList.add('over-done');
  }

  // ---------- desktop: hold the section and slide the cards with the page scroll ----------
  function measure() {
    pinned = wide.matches && !reduce;
    sec.classList.toggle('pin', pinned);
    track.style.transform = '';
    if (!pinned) { sec.style.height = ''; return; }
    // Measure to the end of the last card plus the end space, so the last card always slides fully into view.
    const last = cards[cards.length - 1], endSpace = parseFloat(getComputedStyle(track, '::after').flexBasis) || 0;
    dist = Math.max(0, last.offsetLeft + last.offsetWidth + endSpace - track.clientWidth);
    // Each ball gets about a third of a screen of scrolling, so it never flies past.
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

  // ---------- arrows and keys ----------
  function go(d) {
    const i = Math.max(0, Math.min(cards.length - 1, cur + d));
    if (pinned) {
      const run = sec.offsetHeight - stage.offsetHeight, top = sec.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + run * ((i + .5) / cards.length), behavior: reduce ? 'auto' : 'smooth' });
    } else {
      track.scrollTo({ left: cards[i].offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: reduce ? 'auto' : 'smooth' });
      hold = performance.now(); set(i);
    }
  }
  document.getElementById('over-prev').addEventListener('click', () => go(-1));
  document.getElementById('over-next').addEventListener('click', () => go(1));
  track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });

  // ---------- laptops: cards tilt a little towards the mouse ----------
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) cards.forEach(c => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(900px) rotateY(${(x * 7).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });

  // The first ball plays when the section first comes into view.
  if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { if (cur < 0) set(0); o.disconnect(); } }, { threshold: .25 }).observe(sec);
  else set(0);
  if (reduce) cards.forEach((c, i) => play(i));
  label.textContent = 'Ball 1 of 6';
  wide.addEventListener('change', measure);
  addEventListener('resize', () => { clearTimeout(measure.t); measure.t = setTimeout(measure, 150); });
  addEventListener('load', measure);
  measure();
})();
