// The Cricket Space: the 3D universe on the homepage.
// A red cricket-ball planet, four ball moons that are the site's doors, and a galaxy with one star
// per real player (player/galaxy.json, written by scripts/build-player-pages.py).
// Without WebGL nothing here runs and the doors stay as plain buttons.
import * as THREE from '/vendor/three-0.170.0.module.min.js';

const root = document.documentElement;
const box = document.getElementById('universe');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => innerWidth < 761;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}

if (box && renderer) start();

function start() {
  root.classList.add('gl');
  const W = () => box.clientWidth, H = () => box.clientHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  // Name appears letter by letter.
  const nm = box.querySelector('h1'), txt = nm.textContent; nm.textContent = ''; nm.setAttribute('aria-label', txt);
  [...txt].forEach((c, i) => { const s = document.createElement('span'); s.textContent = c === ' ' ? ' ' : c; s.style.animationDelay = (still ? 0 : 0.6 + i * 0.05) + 's'; s.setAttribute('aria-hidden', 'true'); nm.appendChild(s); });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080d');
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 5000);
  const homeFor = () => small() ? new THREE.Vector3(0, 130, 290) : new THREE.Vector3(0, 88, 196);
  let home = homeFor();
  camera.position.set(0, 220, 1400);

  scene.add(new THREE.AmbientLight('#8fa0b0', 0.55));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.4); sun.position.set(-60, 50, 80); scene.add(sun);

  // Leather, seam and stitches, drawn on a canvas.
  function ballTexture(base, dark, stitch, opts = {}) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 9000; i++) { x.fillStyle = Math.random() < .5 ? dark : 'rgba(255,255,255,.05)'; x.globalAlpha = Math.random() * .25; x.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2); }
    x.globalAlpha = 1;
    if (opts.tennis) {
      x.strokeStyle = stitch; x.lineWidth = 14; x.beginPath();
      for (let u = 0; u <= 1024; u += 4) { const v = 256 + Math.sin(u / 1024 * Math.PI * 4) * 120; u ? x.lineTo(u, v) : x.moveTo(u, v); }
      x.stroke();
    } else {
      [-1, 1].forEach(side => {
        const at = u => 256 + Math.sin(u / 1024 * Math.PI * 2) * 150 + side * 9;
        x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.beginPath();
        for (let u = 0; u <= 1024; u += 4) { u ? x.lineTo(u, at(u)) : x.moveTo(u, at(u)); }
        x.stroke();
        x.strokeStyle = stitch; x.lineWidth = 3;
        for (let u = 0; u <= 1024; u += 11) { const v = at(u); x.beginPath(); x.moveTo(u - 3, v - side * 2); x.lineTo(u + 3, v + side * 10); x.stroke(); }
      });
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  // The home planet: a giant red cricket ball.
  const planet = new THREE.Mesh(new THREE.SphereGeometry(20, 96, 64), new THREE.MeshStandardMaterial({ map: ballTexture('#b8291f', 'rgba(40,0,0,.6)', '#f3e3c8'), roughness: .55 }));
  planet.rotation.z = 0.35; scene.add(planet);

  // Four moons, each a different ball. Same order as the door links.
  const moonDefs = [
    ['#ece7da', 'rgba(120,110,90,.4)', '#b03a2e', {}],
    ['#e0477a', 'rgba(90,10,40,.5)', '#fff1f5', {}],
    ['#c9d232', 'rgba(70,80,0,.4)', '#fbfbf1', { tennis: true }],
    ['#7a2f27', 'rgba(20,5,0,.6)', '#d9c7a8', {}]
  ];
  const moons = moonDefs.map(([b, d, s, o], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4, 48, 32), new THREE.MeshStandardMaterial({ map: ballTexture(b, d, s, o), roughness: o.tennis ? .95 : .5 }));
    m.userData.a = i * Math.PI / 2 + .4; scene.add(m); return m;
  });
  const ORBIT_R = 38;
  const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * Math.PI) * ORBIT_R, 0, Math.sin(i / 64 * Math.PI) * ORBIT_R))),
    new THREE.LineDashedMaterial({ color: '#f1ede2', transparent: true, opacity: .25, dashSize: 1.4, gapSize: 1.2 }));
  orbit.computeLineDistances(); scene.add(orbit);

  // Far background stars.
  {
    const n = small() ? 2500 : 5000, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 900 + Math.random() * 1600, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#c9d0d6', size: 1.6, sizeAttenuation: false, transparent: true, opacity: .7 })));
  }

  // The galaxy: one star per real player. [name, slug, league, matches, runs, wickets]
  const galaxy = new THREE.Group(); scene.add(galaxy);
  let players = [], starPoints = null;
  const COLORS = { bat: new THREE.Color('#f1ede2'), bowl: new THREE.Color('#ff7c68'), all: new THREE.Color('#f5c518'), wpl: new THREE.Color('#ff9ab8') };
  const roleOf = p => p[2] === 'WPL' ? 'wpl' : (p[4] >= 800 && p[5] >= 40) ? 'all' : (p[5] * 25 > p[4]) ? 'bowl' : 'bat';
  const fmt = n => n.toLocaleString('en-IN');
  fetch('/player/galaxy.json').then(r => r.json()).then(list => {
    players = list;
    const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    list.forEach((p, i) => {
      // Biggest careers sit nearest the planet; two spiral arms wind outwards.
      const r = 58 + Math.sqrt(i) * 5.4 + rnd() * 6, th = (i % 2) * Math.PI + r * 0.045 + (rnd() - .5) * .6;
      pos.set([Math.cos(th) * r, (rnd() - .5) * (3 + r * .05), Math.sin(th) * r], i * 3);
      const c = COLORS[roleOf(p)]; col.set([c.r, c.g, c.b], i * 3);
      size[i] = 2.2 + Math.log2(1 + p[3]) * 1.15;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    starPoints = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { scale: { value: renderer.getPixelRatio() * H() / 2 }, hi: { value: -1 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; varying float vH; uniform float scale; uniform float hi;
        void main(){ vC = color; vH = float(gl_VertexID) == hi ? 1.0 : 0.0; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * scale / -mv.z * .36, 2.5, 20.0) * (vH > .5 ? 2.2 : 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vH; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard;
        float a = smoothstep(.5, .12, r); vec3 c = mix(vC, vec3(1.0), smoothstep(.22, .0, r) * .6); if (vH > .5 && r > .38) c = vec3(.96, .77, .09);
        gl_FragColor = vec4(c, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    galaxy.add(starPoints);
    const dl = document.getElementById('names');
    list.slice(0, 400).forEach(p => { const o = document.createElement('option'); o.value = p[0]; dl.appendChild(o); });
  }).catch(() => {});

  // Camera: fly in, then drag to look around.
  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, flying = null, introDone = false, pinned = -1;
  const look = new THREE.Vector3();
  const ease = t => 1 - Math.pow(1 - t, 3);
  function flyTo(pos, target, ms, after) { flying = { from: camera.position.clone(), fromLook: look.clone(), to: pos, toLook: target, t0: performance.now(), ms: still ? 1 : ms, after }; }
  flyTo(home.clone(), new THREE.Vector3(), 3600, () => { introDone = true; root.classList.add('tcs-ready'); });

  const cv = renderer.domElement;
  let down = null;
  cv.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, yaw: tYaw, pitch: tPitch, moved: false, type: e.pointerType }; });
  addEventListener('pointermove', e => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) { down.moved = true; cv.classList.add('dragging'); unpin(); }
      tYaw = down.yaw + dx * 0.005;
      if (down.type === 'mouse') tPitch = Math.max(-0.5, Math.min(0.6, down.pitch + dy * 0.003)); // on touch, vertical moves scroll the page
    }
  });
  cv.addEventListener('pointermove', e => hover(e));
  addEventListener('pointerup', e => { cv.classList.remove('dragging'); if (down && !down.moved && e.target === cv) click(e); down = null; });
  cv.addEventListener('pointercancel', () => { down = null; cv.classList.remove('dragging'); });

  // Hover and click on stars.
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 1.6;
  const mouse = new THREE.Vector2(), tip = document.getElementById('tip');
  function pick(e) {
    if (!starPoints || !introDone) return -1;
    const r = cv.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObject(starPoints); return hits.length ? hits[0].index : -1;
  }
  function showTip(i, x, y) {
    const p = players[i], role = { bat: 'Batter', bowl: 'Bowler', all: 'All-rounder', wpl: 'WPL' }[roleOf(p)];
    const line = p[5] * 25 > p[4] ? `${fmt(p[5])} ${p[2]} wickets · ${p[3]} matches` : `${fmt(p[4])} ${p[2]} runs · ${p[3]} matches`;
    tip.innerHTML = '<b></b><span></span><em></em>';
    tip.querySelector('b').textContent = p[0]; tip.querySelector('span').textContent = line; tip.querySelector('em').textContent = role + ' · click to open';
    tip.style.left = Math.min(x, innerWidth - 280) + 'px'; tip.style.top = Math.min(y, innerHeight - 110) + 'px'; tip.classList.add('on');
  }
  function hover(e) {
    if (down && down.moved) return;
    const i = pick(e); cv.classList.toggle('pointing', i >= 0);
    if (i >= 0) showTip(i, e.clientX, e.clientY); else if (pinned < 0) tip.classList.remove('on');
    if (starPoints) starPoints.material.uniforms.hi.value = i >= 0 ? i : pinned;
  }
  function click(e) { const i = pick(e); if (i >= 0) location.href = '/player/' + players[i][1] + '.html'; }
  function unpin() { if (pinned < 0) return; pinned = -1; root.classList.remove('tcs-pinned'); tip.classList.remove('on'); if (starPoints) starPoints.material.uniforms.hi.value = -1; flyTo(rotated(), new THREE.Vector3(), 1200); }

  // The moons are doors: the camera dives in, then the page opens.
  const links = [...box.querySelectorAll('.moon')];
  links.forEach((a, i) => a.addEventListener('click', e => {
    if (still || !introDone || e.metaKey || e.ctrlKey || e.shiftKey || a.getAttribute('href').startsWith('#')) return;
    e.preventDefault();
    const m = moons[i].position.clone(), dir = m.clone().sub(camera.position).normalize();
    flyTo(m.clone().sub(dir.multiplyScalar(7)), m, 1000, () => { location.href = a.href; });
  }));

  // Find a player: fly to their star.
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '');
  const msg = document.getElementById('find-msg');
  document.getElementById('find').addEventListener('submit', e => {
    e.preventDefault();
    const q = norm(document.getElementById('q').value.trim());
    if (!q || !players.length || !starPoints) return;
    let i = players.findIndex(p => norm(p[0]) === q);
    if (i < 0) i = players.findIndex(p => norm(p[0]).split(' ').includes(q));
    if (i < 0) i = players.findIndex(p => norm(p[0]).includes(q));
    if (i < 0) { msg.textContent = 'No star by that name yet. Try a surname, like Kohli.'; return; }
    pinned = i; root.classList.add('tcs-pinned'); starPoints.material.uniforms.hi.value = i;
    galaxy.updateMatrixWorld();
    const star = new THREE.Vector3().fromBufferAttribute(starPoints.geometry.attributes.position, i).applyMatrix4(galaxy.matrixWorld);
    const out = star.clone().setY(star.y + 6).add(star.clone().setY(0).normalize().multiplyScalar(18));
    flyTo(out, star, 1800, () => { const v = star.clone().project(camera), r = cv.getBoundingClientRect(); showTip(i, r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height); });
    msg.textContent = ''; const a = document.createElement('a'); a.href = '/player/' + players[i][1] + '.html'; a.textContent = `Open ${players[i][0]}’s page →`; msg.appendChild(a);
  });
  document.getElementById('q').addEventListener('input', unpin);

  const rotated = () => { const p = home.clone(); p.applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch); p.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw); return p; };

  // Only draw while the universe is on screen and the tab is visible.
  let onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) loop(); }).observe(box);
  let raf = 0, last = performance.now();
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (!still) planet.rotation.y += dt * .08;
    moons.forEach((m, i) => { if (!still) m.userData.a += dt * .05; m.position.set(Math.cos(m.userData.a) * ORBIT_R, Math.sin(m.userData.a * 2) * 1.2, Math.sin(m.userData.a) * ORBIT_R); m.rotation.y += still ? 0 : dt * (.4 + i * .1); });
    if (!still && introDone && !down && pinned < 0) galaxy.rotation.y += dt * .012;
    if (flying) {
      const t = Math.min(1, (now - flying.t0) / flying.ms), k = ease(t);
      camera.position.lerpVectors(flying.from, flying.to, k); look.lerpVectors(flying.fromLook, flying.toLook, k); camera.lookAt(look);
      if (t >= 1) { const f = flying; flying = null; if (f.after) f.after(); }
    } else if (pinned < 0) {
      yaw += (tYaw - yaw) * .08; pitch += (tPitch - pitch) * .08;
      camera.position.copy(rotated()); look.set(0, 0, 0); camera.lookAt(look);
    }
    // Door labels sit under their moons.
    const r = cv.getBoundingClientRect();
    moons.forEach((m, i) => {
      const v = m.position.clone().add(new THREE.Vector3(0, -5.4, 0)).project(camera), a = links[i];
      a.style.left = ((v.x + 1) / 2 * r.width) + 'px'; a.style.top = ((1 - v.y) / 2 * r.height) + 'px'; a.style.visibility = v.z < 1 ? 'visible' : 'hidden';
    });
    renderer.render(scene, camera);
    if (onScreen && !document.hidden) loop();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); loop(); } });
  loop();

  addEventListener('resize', () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()); home = homeFor();
    if (starPoints) starPoints.material.uniforms.scale.value = renderer.getPixelRatio() * H() / 2;
  });
}
