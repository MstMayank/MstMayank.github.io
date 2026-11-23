/* Motion helpers for ed.css: reveal on scroll, count-up numbers, growing bars. */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Stagger: children of [data-stagger] get --i.
  document.querySelectorAll('[data-stagger]').forEach(box => [...box.children].forEach((c, i) => { c.style.setProperty('--i', i); if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', ''); }));
  document.querySelectorAll('.ed-bars-grow').forEach(box => [...box.querySelectorAll('i')].forEach((b, i) => b.style.setProperty('--i', i)));
  function countUp(el) {
    const text = el.textContent.trim();
    const m = text.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m || reduce) return;
    const target = parseFloat(m[2].replace(/,/g, '')), decimals = (m[2].split('.')[1] || '').length, comma = m[2].includes(',');
    const start = performance.now(), dur = 1100;
    const fmt = v => { const s = v.toFixed(decimals); return comma ? Number(s).toLocaleString('en-IN', {minimumFractionDigits: decimals, maximumFractionDigits: decimals}) : s; };
    const step = now => { const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3); el.textContent = m[1] + fmt(target * e) + m[3]; if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const show = el => {
    el.classList.add('in');
    if (el.matches('[data-count]')) countUp(el);
  };
  const targets = document.querySelectorAll('[data-reveal], .ed-bars-grow, [data-count]');
  if (reduce || !('IntersectionObserver' in window)) { targets.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), {threshold: .15, rootMargin: '0px 0px -40px 0px'});
  targets.forEach(el => io.observe(el));
})();
