// "Six balls that made me": full-stage floodlit stadium theater with live canvas pitch & ball physics.
(() => {
  const sec = document.getElementById('about'), stage = document.getElementById('over');
  if (!sec || !stage) return;
  const scenes = [...stage.querySelectorAll('.ball-scene')];
  const dots = [...sec.querySelectorAll('.over-track .balls i')];
  const pills = [...sec.querySelectorAll('.over-pill')];
  const label = document.getElementById('over-label');
  const prevBtn = document.getElementById('over-prev');
  const nextBtn = document.getElementById('over-next');
  const canvas = document.getElementById('story-canvas');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const BALL_CODES = ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6'];
  let cur = 0;
  let animT = 1;
  let animStart = 0;
  let raf = 0;
  let sixBurst = 0;
  let wallImpact = 0;

  // ---------- Count-up numbers ----------
  const countUp = (el, ms) => {
    const to = +el.dataset.to;
    if (!to || reduce) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      const k = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * k);
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = 0;
    requestAnimationFrame(step);
  };

  // ---------- Ball 2: Build masonry bricks ----------
  const wallEl = document.getElementById('the-wall');
  const bricks = sec.querySelector('.wall .bricks');
  if (bricks) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < (r % 2 ? 7 : 6); c++) {
        const b = document.createElement('i');
        b.style.setProperty('--r', r);
        b.style.setProperty('--c', c);
        if (r % 2) b.classList.add('off');
        bricks.appendChild(b);
      }
    }
  }
  const wallReadout = document.getElementById('wall-readout');
  const wallChips = [...sec.querySelectorAll('.w-chip')];
  wallChips.forEach(btn => btn.addEventListener('click', () => {
    wallChips.forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    if (wallReadout) wallReadout.textContent = btn.dataset.wall || '';
  }));
  const testWallBtn = document.getElementById('test-wall-btn');
  if (testWallBtn) testWallBtn.addEventListener('click', () => {
    wallImpact = performance.now();
    triggerDelivery();
    if (wallEl && !reduce) {
      wallEl.classList.remove('hit');
      void wallEl.offsetWidth;
      wallEl.classList.add('hit');
    }
  });

  // ---------- Ball 1: Replay delivery ----------
  const replayBtn = document.getElementById('replay-delivery');
  if (replayBtn) replayBtn.addEventListener('click', () => triggerDelivery());

  // ---------- Ball 3: Dhoni knocks & Six launch ----------
  const dhoniNote = document.getElementById('dhoni-note');
  const knockBtns = [...sec.querySelectorAll('.knock-btn')];
  const sixBadge = document.getElementById('six-badge');
  const KNOCK_NOTES = {
    vizag: '2005 · Vizag · His breakthrough 148 against Pakistan',
    jaipur: '2005 · Jaipur · Unbeaten 183* chasing against Sri Lanka'
  };
  knockBtns.forEach(btn => btn.addEventListener('click', () => {
    knockBtns.forEach(x => x.classList.remove('on'));
    btn.classList.add('on');
    if (dhoniNote) dhoniNote.textContent = KNOCK_NOTES[btn.dataset.knock] || '';
    launchSix();
  }));
  const launchSixBtn = document.getElementById('launch-six-btn');
  if (launchSixBtn) launchSixBtn.addEventListener('click', launchSix);
  function launchSix() {
    sixBurst = performance.now();
    triggerDelivery();
    if (sixBadge && !reduce) {
      sixBadge.classList.remove('pop');
      void sixBadge.offsetWidth;
      sixBadge.classList.add('pop');
      setTimeout(() => sixBadge.classList.remove('pop'), 400);
    }
  }

  // ---------- Ball 4: 100 Centuries Star Grid (51 Test + 49 ODI) ----------
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

  // ---------- Fly to 3D hero star ----------
  sec.querySelectorAll('[data-fly]').forEach(btn => {
    btn.addEventListener('click', () => {
      dispatchEvent(new CustomEvent('tcs:fly-slug', { detail: { slug: btn.dataset.fly } }));
    });
  });

  // ---------- Live Stadium & 22-Yard Pitch Canvas ----------
  let cw = 0, ch = 0, dpr = 1;
  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: ((i * 137.5) % 100) / 100,
    y: ((i * 53.7) % 62) / 100,
    r: (i % 4 === 0) ? 1.8 : 1.0,
    gold: i % 9 === 0
  }));

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    cw = Math.max(1, Math.round(rect.width));
    ch = Math.max(1, Math.round(rect.height));
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    drawArena(performance.now());
  }

  function triggerDelivery() {
    if (reduce) { animT = 1; drawArena(performance.now()); return; }
    animStart = performance.now();
    animT = 0;
    startLoop();
  }

  function startLoop() {
    if (raf || reduce) return;
    const tick = now => {
      raf = 0;
      if (animT < 1) {
        animT = Math.min(1, (now - animStart) / 880);
      }
      drawArena(now);
      const stillBursting = (now - sixBurst < 1200) || (now - wallImpact < 650);
      if (animT < 1 || stillBursting) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
  }

  function drawArena(now) {
    if (!canvas || !cw || !ch) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Subtle night cosmos stars
    stars.forEach(s => {
      ctx.fillStyle = s.gold ? 'rgba(243, 183, 63, 0.35)' : 'rgba(244, 239, 228, 0.22)';
      ctx.beginPath();
      ctx.arc(s.x * cw, s.y * ch, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stadium boundary arc
    ctx.strokeStyle = 'rgba(34, 42, 54, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cw * 0.54, ch * 0.96, cw * 0.48, ch * 0.36, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // 22-yard perspective pitch strip running down-right behind the visual stage
    const farX = cw * 0.52, farY = ch * 0.16;
    const nearX = cw * 0.56, nearY = ch * 0.96;
    const farW = 28, nearW = 148;

    ctx.fillStyle = 'rgba(14, 17, 23, 0.65)';
    ctx.strokeStyle = 'rgba(56, 67, 84, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(farX - farW, farY);
    ctx.lineTo(farX + farW, farY);
    ctx.lineTo(nearX + nearW, nearY);
    ctx.lineTo(nearX - nearW, nearY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Popping creases
    ctx.strokeStyle = 'rgba(244, 239, 228, 0.18)';
    ctx.beginPath();
    ctx.moveTo(nearX - nearW * 0.72, nearY - 34);
    ctx.lineTo(nearX + nearW * 0.72, nearY - 34);
    ctx.stroke();

    // Stumps at far & near ends (shatter on Ball 0.1)
    const shatter = (cur === 0 && animT > 0.75) ? (animT - 0.75) * 4 : 0;
    ctx.strokeStyle = cur === 0 ? 'rgba(255, 107, 91, 0.75)' : 'rgba(243, 183, 63, 0.45)';
    ctx.lineWidth = 2.5;
    [-12, 0, 12].forEach((dx, idx) => {
      const tilt = shatter * (idx - 1) * 0.65;
      const sx = nearX + dx + shatter * (idx - 1) * 14;
      const sy = nearY - 34 - shatter * (idx === 1 ? 10 : 4);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -28);
      ctx.stroke();
      ctx.restore();
    });

    // Live delivery trajectory down the pitch
    const ease = 1 - Math.pow(1 - animT, 3);
    const bounceFrac = [0.42, 0.58, 0.72, 0.62, 0.84, 0.75][cur];
    const swingPx = [-14, 10, 4, -4, 18, 0][cur];
    const bx = farX + (nearX - farX) * bounceFrac;
    const by = farY + (nearY - farY) * bounceFrac;
    const endX = nearX + swingPx;
    const endY = nearY - 40;

    const px = ease < 0.62 ? farX + (bx - farX) * (ease / 0.62) : bx + (endX - bx) * ((ease - 0.62) / 0.38);
    const py = ease < 0.62 ? farY + (by - farY) * (ease / 0.62) : by + (endY - by) * ((ease - 0.62) / 0.38);

    ctx.strokeStyle = cur === 0 ? 'rgba(255, 107, 91, 0.75)' : 'rgba(243, 183, 63, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(farX, farY);
    if (ease <= 0.62) ctx.lineTo(px, py);
    else { ctx.lineTo(bx, by); ctx.lineTo(px, py); }
    ctx.stroke();

    // Red leather cricket ball
    const r = 4 + ease * 6;
    ctx.fillStyle = '#d9483b';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f4efe4';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.7, -0.6, 0.6);
    ctx.stroke();

    // Ball 3 (Dhoni) or Ball 5 (Yuvi 6x6): soaring six arcs across the night sky
    if (cur === 2 || cur === 4) {
      const arcs = cur === 4 ? 6 : 1;
      const burstP = (cur === 2 && now - sixBurst < 1200) ? (now - sixBurst) / 1200 : ease;
      for (let a = 0; a < arcs; a++) {
        const tx = cw * (cur === 4 ? (0.14 + a * 0.14) : 0.88);
        const ty = ch * (cur === 4 ? (0.14 + (a % 2) * 0.08) : 0.12);
        const cx = (endX + tx) / 2;
        const cy = ch * 0.04;
        ctx.strokeStyle = a % 2 === 0 ? 'rgba(243, 183, 63, 0.42)' : 'rgba(124, 196, 240, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.quadraticCurveTo(cx, cy, tx, ty);
        ctx.stroke();

        if (cur === 2 && burstP > 0 && burstP < 1) {
          const u = burstP;
          const sx = (1 - u) * (1 - u) * endX + 2 * (1 - u) * u * cx + u * u * tx;
          const sy = (1 - u) * (1 - u) * endY + 2 * (1 - u) * u * cy + u * u * ty;
          ctx.fillStyle = '#f3b73f';
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ---------- Scene switching ----------
  function showBall(idx, skipAnim = false) {
    const i = ((idx % scenes.length) + scenes.length) % scenes.length;
    const prev = cur;
    cur = i;

    scenes.forEach((s, j) => {
      const on = j === i;
      s.classList.toggle('active', on);
      if (on && !s.dataset.counted) {
        s.dataset.counted = '1';
        s.querySelectorAll('[data-to]').forEach(el => countUp(el, 950));
      }
    });

    dots.forEach((d, j) => {
      d.classList.toggle('on', j <= i);
      d.classList.toggle('just', j === i && i > prev && !reduce);
    });

    pills.forEach((p, j) => {
      p.classList.toggle('on', j === i);
      p.classList.toggle('faced', j <= i);
      p.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });

    label.textContent = `Ball ${i + 1} of ${scenes.length}`;
    sec.classList.toggle('over-done', i === scenes.length - 1);
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.textContent = i === scenes.length - 1 ? 'Restart over ↺' : `Bowl ${BALL_CODES[i + 1]} →`;

    if (skipAnim) {
      animT = 1;
      drawArena(performance.now());
    } else {
      triggerDelivery();
    }
  }

  pills.forEach(p => p.addEventListener('click', () => showBall(+p.dataset.ball)));
  if (prevBtn) prevBtn.addEventListener('click', () => { if (cur > 0) showBall(cur - 1); });
  if (nextBtn) nextBtn.addEventListener('click', () => showBall(cur < scenes.length - 1 ? cur + 1 : 0));
  stage.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && cur < scenes.length - 1) { e.preventDefault(); showBall(cur + 1); }
    if (e.key === 'ArrowLeft' && cur > 0) { e.preventDefault(); showBall(cur - 1); }
  });

  // Trigger delivery when scrolling into #about for the first time
  let playedIntro = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es, o) => {
      if (es[0].isIntersecting && !playedIntro) {
        playedIntro = true;
        showBall(0, false);
        o.disconnect();
      }
    }, { threshold: 0.2 }).observe(sec);
  }

  addEventListener('resize', () => {
    clearTimeout(resizeCanvas.t);
    resizeCanvas.t = setTimeout(resizeCanvas, 120);
  });

  resizeCanvas();
  showBall(0, true);
})();
