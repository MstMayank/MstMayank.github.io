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
  // Smooth edges on laptops and desktops; phones skip it to stay light.
  renderer = new THREE.WebGLRenderer({ antialias: innerWidth > 760, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}

if (box && renderer) start();

function start() {
  root.classList.add('gl');
  // Sizes are cached and only re-read on resize, so the animation never forces the browser to re-measure the page.
  let w = box.clientWidth, h = box.clientHeight;
  const W = () => w, H = () => h;
  const maxRatio = () => Math.min(devicePixelRatio, small() ? 1.5 : 1.5);
  renderer.setPixelRatio(maxRatio());
  renderer.setSize(W(), H());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  box.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  // Animate each letter, but allow the title to wrap only between words.
  const heading = box.querySelector('h1');
  const title = heading.textContent.trim();
  heading.setAttribute('aria-label', title);
  heading.replaceChildren();
  let letterIndex = 0;
  for (const word of title.split(/\s+/)) {
    if (letterIndex) {
      heading.append(' ');
      letterIndex++;
    }
    const group = document.createElement('span');
    group.className = 'title-word';
    group.setAttribute('aria-hidden', 'true');
    for (const char of word) {
      const letter = document.createElement('span');
      letter.textContent = char;
      letter.style.animationDelay = (still ? 0 : 0.6 + letterIndex * 0.05) + 's';
      group.append(letter);
      letterIndex++;
    }
    heading.append(group);
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05080d');
  const camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 5000);
  const homeFor = () => small() ? new THREE.Vector3(0, 130, 290) : new THREE.Vector3(0, 88, 196);
  let home = homeFor();
  // Place navigation at its resting position while the scene flies in.
  const navigationCamera = camera.clone();
  function positionNavigationCamera() {
    navigationCamera.aspect = camera.aspect;
    navigationCamera.updateProjectionMatrix();
    navigationCamera.position.copy(home);
    navigationCamera.lookAt(0, 0, 0);
    navigationCamera.updateMatrixWorld();
  }
  positionNavigationCamera();
  if (still) camera.position.copy(home);
  else camera.position.set(0, 220, 1400);

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
    const n = small() ? 1500 : 3500, pos = new Float32Array(n * 3);
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
  }).catch(() => {});

  // Camera: fly in, then drag to look around.
  let yaw = 0, pitch = 0, tYaw = 0, tPitch = 0, flying = null, pinned = -1;
  const look = new THREE.Vector3();
  const ease = t => 1 - Math.pow(1 - t, 3);
  function flyTo(pos, target, ms, after) { flying = { from: camera.position.clone(), fromLook: look.clone(), to: pos, toLook: target, t0: performance.now(), ms: still ? 1 : ms, after }; }
  root.classList.add('tcs-ready');
  flyTo(home.clone(), look.clone(), 3600);
  const introFlight = flying;

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
  let hoverEvent = null;
  cv.addEventListener('pointermove', e => { hoverEvent = e; });
  addEventListener('pointerup', e => { cv.classList.remove('dragging'); if (down && !down.moved && e.target === cv) click(e); down = null; });
  cv.addEventListener('pointercancel', () => { down = null; cv.classList.remove('dragging'); });

  // Hover and click on stars.
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 1.6;
  const mouse = new THREE.Vector2(), tip = document.getElementById('tip');
  function pick(e) {
    if (!starPoints) return -1;
    mouse.set(e.offsetX / w * 2 - 1, -(e.offsetY / h) * 2 + 1); ray.setFromCamera(mouse, camera);
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

  const links = [...box.querySelectorAll('.moon')];
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (still || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hash) return;
    event.preventDefault();
    const moon = moons[index].position;
    // Keep the surrounding orbit in view as the camera approaches the chosen moon.
    const destination = camera.position.clone().lerp(moon, 0.24);
    const focus = look.clone().lerp(moon, 0.55);
    flyTo(destination, focus, 480, () => location.assign(link.href));
  }));

  // Find a player: our own small suggestion list (the browser's built-in one covered half the screen).
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim();
  const msg = document.getElementById('find-msg'), input = document.getElementById('q'), sugg = document.getElementById('sugg');
  let shown = [], active = -1;
  const statLine = p => p[5] * 25 > p[4] ? `${fmt(p[5])} ${p[2]} wkts` : `${fmt(p[4])} ${p[2]} runs`;
  // Best matches first: whole name, then any name word that starts with the query, then anywhere. Bigger careers first within each.
  function search(raw, limit) {
    const q = norm(raw); if (q.length < 2 || !players.length) return [];
    const out = [];
    players.forEach((p, i) => {
      // Match the name fans use and, if different, the full name too ("Ravindrasinh" still finds Jadeja).
      let best = -1;
      [p[0], p[6]].filter(Boolean).forEach(name => {
        const n = norm(name), words = n.split(' ');
        const score = n === q ? 0 : (n.startsWith(q) || words.some(w => w.startsWith(q))) ? 1 : n.includes(q) ? 2 : -1;
        if (score >= 0 && (best < 0 || score < best)) best = score;
      });
      if (best >= 0) out.push([best, i]);
    });
    return out.sort((x, y) => x[0] - y[0] || x[1] - y[1]).slice(0, limit).map(x => x[1]);
  }
  function closeList() { sugg.hidden = true; sugg.textContent = ''; shown = []; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
  function setActive(k) {
    active = k;
    [...sugg.children].forEach((li, j) => li.setAttribute('aria-selected', j === k ? 'true' : 'false'));
    if (k >= 0) input.setAttribute('aria-activedescendant', 'sugg-' + k); else input.removeAttribute('aria-activedescendant');
  }
  function openList() {
    shown = search(input.value, 6); sugg.textContent = '';
    if (!shown.length) { closeList(); return; }
    shown.forEach((i, k) => {
      const li = document.createElement('li'), b = document.createElement('b'), sm = document.createElement('small');
      li.id = 'sugg-' + k; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      b.textContent = players[i][0]; sm.textContent = statLine(players[i]); li.append(b, sm);
      li.addEventListener('pointerdown', e => { e.preventDefault(); choose(i); });
      sugg.appendChild(li);
    });
    sugg.hidden = false; input.setAttribute('aria-expanded', 'true'); setActive(-1);
  }
  function choose(i) { input.value = players[i][0]; closeList(); fly(i); }
  function fly(i) {
    if (!starPoints) return;
    pinned = i; root.classList.add('tcs-pinned'); starPoints.material.uniforms.hi.value = i;
    galaxy.updateMatrixWorld();
    const star = new THREE.Vector3().fromBufferAttribute(starPoints.geometry.attributes.position, i).applyMatrix4(galaxy.matrixWorld);
    const out = star.clone().setY(star.y + 6).add(star.clone().setY(0).normalize().multiplyScalar(18));
    flyTo(out, star, 1800, () => { const v = star.clone().project(camera), r = cv.getBoundingClientRect(); showTip(i, r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height); });
    msg.textContent = ''; const a = document.createElement('a'); a.href = '/player/' + players[i][1] + '.html'; a.textContent = `Open ${players[i][0]}’s page →`; msg.appendChild(a);
  }
  input.addEventListener('input', () => { unpin(); openList(); });
  input.addEventListener('keydown', e => {
    if (sugg.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % shown.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? shown.length - 1 : active - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeList(); }
  });
  input.addEventListener('blur', () => setTimeout(closeList, 120));
  document.getElementById('find').addEventListener('submit', e => {
    e.preventDefault();
    if (!players.length || !starPoints) return;
    const i = active >= 0 ? shown[active] : search(input.value, 1)[0];
    if (i === undefined) { closeList(); msg.textContent = 'No star by that name yet. Try a surname, like Kohli.'; return; }
    choose(i);
  });

  // Allow story cards and sign-off to fly the universe camera straight to a player's star.
  addEventListener('tcs:fly-slug', e => {
    const slug = e.detail && e.detail.slug;
    if (!slug || !players.length || !starPoints) return;
    const i = players.findIndex(p => p[1] === slug);
    if (i < 0) return;
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    setTimeout(() => choose(i), still ? 0 : 420);
  });

  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), camAt = new THREE.Vector3();
  const rotated = () => camAt.copy(home).applyAxisAngle(AX, -pitch).applyAxisAngle(AY, yaw).clone();

  // Composite the visible UI once. The pull then uses the existing renderer and a single image.
  let gravityPass = null;
  const screenCamera = new THREE.Camera();
  function disposeGravity() {
    if (!gravityPass) return;
    gravityPass.texture.dispose();
    gravityPass.mesh.geometry.dispose();
    gravityPass.mesh.material.dispose();
    gravityPass = null;
  }
  window.addEventListener('gravity-start', event => {
    disposeGravity();
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const image = document.createElement('canvas');
    image.width = renderer.domElement.width;
    image.height = renderer.domElement.height;
    const ctx = image.getContext('2d');
    if (!ctx) return;
    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, 0, 0);
    ctx.scale(image.width / bounds.width, image.height / bounds.height);
    ctx.translate(-bounds.left, -bounds.top);
    function paint(el) {
      if (el.tagName === 'CANVAS' || el.hidden) return;
      const style = getComputedStyle(el), rect = el.getBoundingClientRect();
      if (style.display === 'none' || style.visibility !== 'visible' || +style.opacity === 0) return;
      // The orbital navigation can have zero height while its positioned links are visible.
      if (!rect.width || !rect.height) {
        for (const child of el.children) paint(child);
        return;
      }
      ctx.save();
      ctx.globalAlpha *= Number(style.opacity);
      if (['FORM','INPUT','BUTTON','I','A','UL'].includes(el.tagName)) {
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        if (parseFloat(style.borderTopWidth)) {
          ctx.strokeStyle = style.borderTopColor; ctx.lineWidth = parseFloat(style.borderTopWidth);
          ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
        }
      }
      ctx.font = style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
      ctx.fillStyle = style.color;
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      const metrics = ctx.measureText('Hg');
      const baseline = ((metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize)*.8) -
                        (metrics.fontBoundingBoxDescent ?? parseFloat(style.fontSize)*.2))/2;
      if (el.tagName === 'INPUT') ctx.fillText(el.value || el.placeholder,rect.left+parseFloat(style.paddingLeft),rect.top+rect.height/2+baseline);
      for (const child of el.childNodes) {
        if (child.nodeType === 1) { paint(child); continue; }
        if (child.nodeType !== 3 || !child.textContent.trim()) continue;
        const range = document.createRange();
        for (const match of child.textContent.matchAll(/\S+/g)) {
          range.setStart(child,match.index);range.setEnd(child,match.index+match[0].length);
          const word=range.getBoundingClientRect();
          ctx.fillText(style.textTransform==='uppercase'?match[0].toUpperCase():match[0],word.left,word.top+word.height/2+baseline);
        }
      }
      ctx.restore();
    }
    for (const el of box.children) paint(el);
    const navigation = document.querySelector(".site-nav");
    if (navigation) paint(navigation);
    const texture = new THREE.CanvasTexture(image);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    const origin = new THREE.Vector2((event.detail.x-bounds.left)/bounds.width,1-(event.detail.y-bounds.top)/bounds.height);
    const extent = new THREE.Vector2(bounds.width,bounds.height).divideScalar(Math.max(bounds.width,bounds.height));
    const far = Math.hypot(Math.max(origin.x,1-origin.x)*extent.x,Math.max(origin.y,1-origin.y)*extent.y);
    const material = new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{picture:{value:texture},center:{value:origin},extent:{value:extent},reach:{value:far},progress:{value:0},horizon:{value:event.detail.radius/Math.max(bounds.width,bounds.height)}},
      vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`
        uniform sampler2D picture;
        uniform vec2 center,extent;
        uniform float reach,progress,horizon;
        varying vec2 coord;
        const vec3 night=vec3(.0196,.0314,.051);
        vec3 sampleSky(vec2 uv){
          vec2 inside=min(uv,1.-uv)*extent;
          float edge=smoothstep(-.002,.004,min(inside.x,inside.y));
          return mix(night,texture2D(picture,clamp(uv,0.,1.)).rgb,edge);
        }
        vec2 sourceAt(vec2 d,float r,float amount){
          // Integrate inward speed proportional to 1/sqrt(radius). Nearby pixels cross first.
          float start=pow(pow(r,1.5)+amount,2./3.);
          float turn=1.15*log((start+.012)/(r+.012));
          float cs=cos(turn),sn=sin(turn);
          vec2 dir=d/max(r,.00001);
          return center+start*(mat2(cs,sn,-sn,cs)*dir)/extent;
        }
        void main(){
          vec2 d=(coord-center)*extent;
          float r=length(d),t=progress;
          float amount=pow(reach,1.5)*1.10*pow(t,2.6);
          vec2 uv=sourceAt(d,r,amount);
          vec2 lag=sourceAt(d,r,amount*0.989)-uv;
          vec3 sky=.55*sampleSky(uv)+.30*sampleSky(uv+lag*.5)+.15*sampleSky(uv+lag);
          float heat=sin(3.14159*t)*exp(-r/max(.008,horizon*5.));
          float rim=exp(-abs(r-horizon)/max(.0006,horizon*.35));
          sky+=vec3(1.,.46,.12)*heat*(.045+.38*rim);
          sky=mix(night,sky,smoothstep(horizon*.55,horizon*1.02,r));
          gl_FragColor=vec4(mix(sky,night,smoothstep(.94,1.,t)),1.);
        }`
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
    mesh.frustumCulled=false;
    const passScene=new THREE.Scene();passScene.add(mesh);
    gravityPass={mesh,texture};
    event.detail.render = fraction => { material.uniforms.progress.value=fraction;renderer.render(passScene,screenCamera); };
  });
  window.addEventListener('gravity-release',()=>{disposeGravity();if(document.body.dataset.mode==='home')loop()});
  // Only draw while the universe is on screen and the tab is visible.
  let onScreen = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) loop(); }).observe(box);
  const ballCenter = new THREE.Vector3();
  const ballRadius = planet.geometry.parameters.radius;
  const tmp = new THREE.Vector3(), labelVis = [], slow = []; let lowered = false, smoothDt = 0;
  let raf = 0, last = performance.now();
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (document.body.dataset.mode !== "home") return;
    const raw = Math.min((now - last) / 1000, .05); last = now;
    smoothDt = smoothDt ? smoothDt * .85 + raw * .15 : raw; const dt = smoothDt;
    if (!still) planet.rotation.y += dt * .08;
    moons.forEach((m, i) => { if (!still) m.userData.a += dt * .05; m.position.set(Math.cos(m.userData.a) * ORBIT_R, Math.sin(m.userData.a * 2) * 1.2, Math.sin(m.userData.a) * ORBIT_R); m.rotation.y += still ? 0 : dt * (.4 + i * .1); });
    if (!still && !down && pinned < 0) galaxy.rotation.y += dt * .012;
    if (flying) {
      const t = Math.min(1, (now - flying.t0) / flying.ms), k = ease(t);
      camera.position.lerpVectors(flying.from, flying.to, k); look.lerpVectors(flying.fromLook, flying.toLook, k); camera.lookAt(look);
      if (t >= 1) { const f = flying; flying = null; if (f.after) f.after(); }
    } else if (pinned < 0) {
      yaw += (tYaw - yaw) * .08; pitch += (tPitch - pitch) * .08;
      camAt.copy(home).applyAxisAngle(AX, -pitch).applyAxisAngle(AY, yaw); camera.position.copy(camAt); look.set(0, 0, 0); camera.lookAt(look);
    }
    // Cut the ball silhouette out of labels on the far half of the orbit.
    camera.updateMatrixWorld();
    ballCenter.copy(planet.position).applyMatrix4(camera.matrixWorldInverse);
    const ballZ = ballCenter.z;
    const radiusPx = h * camera.projectionMatrix.elements[5] * ballRadius /
      (2 * Math.sqrt(Math.max(1, ballZ * ballZ - ballRadius * ballRadius)));
    ballCenter.applyMatrix4(camera.projectionMatrix);
    const ballX = (1 + ballCenter.x) * w / 2, ballY = (1 - ballCenter.y) * h / 2;
    moons.forEach((m, i) => {
      const behind = tmp.copy(m.position).applyMatrix4(camera.matrixWorldInverse).z < ballZ;
      tmp.copy(m.position); tmp.y -= 5.4; tmp.project(flying === introFlight ? navigationCamera : camera);
      const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h, vis = tmp.z < 1, a = links[i];
      a.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translateX(-50%)`;
      const mask = behind && ballZ < -ballRadius && !a.matches(':focus-visible')
        ? `radial-gradient(circle at calc(50% + ${(ballX - x).toFixed(2)}px) ${(ballY - y).toFixed(2)}px, transparent ${Math.max(0, radiusPx - 0.5).toFixed(2)}px, black ${(radiusPx + 0.5).toFixed(2)}px)`
        : 'none';
      a.style.maskImage = mask;
      a.style.webkitMaskImage = mask;
      if (labelVis[i] !== vis) { labelVis[i] = vis; a.style.visibility = vis ? 'visible' : 'hidden'; }
    });
    if (hoverEvent) { hover(hoverEvent); hoverEvent = null; }
    // If this device struggles, drop to a lighter resolution once.
    if (!lowered) { slow.push(dt); if (slow.length > 90) { const avg = slow.reduce((x, y) => x + y) / slow.length; slow.length = 0; if (avg > 0.034) { lowered = true; renderer.setPixelRatio(1); if (starPoints) starPoints.material.uniforms.scale.value = h / 2; } else lowered = true; } }
    renderer.render(scene, camera);
    if (onScreen && !document.hidden) loop();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); loop(); } });
  loop();

  addEventListener('resize', () => {
    w = box.clientWidth; h = box.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); home = homeFor();
    positionNavigationCamera();
    if (flying === introFlight) introFlight.to.copy(home);
    if (starPoints) starPoints.material.uniforms.scale.value = renderer.getPixelRatio() * H() / 2;
  });
}

// Keep the portal usable on devices without WebGL.
(() => {
  const home=document.querySelector('#home'),hole=document.querySelector('#hole'),restore=document.querySelector('#restore');
  const markerParent=hole.parentElement, reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0;
  function finish(){
    cancelAnimationFrame(frame);
    document.body.dataset.mode='inside';
    window.dispatchEvent(new Event('gravity-release'));
    home.style.visibility='hidden';
    restore.hidden=false;
    restore.focus({preventScroll:true});
  }
  function enter(){
    if(document.body.dataset.mode!=='home') return;
    const rect=hole.getBoundingClientRect(), ring=hole.querySelector('img').getBoundingClientRect(), page=home.getBoundingClientRect();
    document.body.append(hole);
    Object.assign(hole.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',right:'auto',width:rect.width+'px'});
    hole.disabled=true;
    home.inert=true;
    home.style.transformOrigin=(ring.left+ring.width/2-page.left)+'px '+(ring.top+ring.height/2-page.top)+'px';
    if(reduce.matches){finish();return}
    const pass={x:ring.left+ring.width/2,y:ring.top+ring.height/2,radius:ring.width*.15};
    window.dispatchEvent(new CustomEvent('gravity-start',{detail:pass}));
    document.body.dataset.mode='pull';
    if(pass.render) {home.classList.add('gravity-composite');pass.render(0)}
    const start=performance.now(),duration=2850;
    function collapse(now){
      const t=Math.min(1,Math.max(0,(now-start)/duration));
      if(pass.render) pass.render(t);
      else {
        const size=Math.pow(1-t*t,2.15);
        home.style.transform='rotate('+(-30*t*t)+'deg) scale('+size+')';
      }
      if(t<1)frame=requestAnimationFrame(collapse);else finish();
    }
    frame=requestAnimationFrame(collapse);
  }
  function reset(){
    cancelAnimationFrame(frame);
    restore.hidden=true;
    markerParent.append(hole);
    hole.removeAttribute('style');
    hole.disabled=false;
    home.style.removeProperty('transform');
    home.style.removeProperty('transform-origin');
    home.style.removeProperty('visibility');
    home.inert=false;
    document.body.dataset.mode='home';
    home.classList.remove('gravity-composite');
    window.dispatchEvent(new Event('gravity-release'));
    window.dispatchEvent(new Event('resize'));
    hole.focus({preventScroll:true});
  }
  hole.addEventListener('click',enter);
  restore.addEventListener('click',reset);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.mode!=='home')reset()});
  reduce.addEventListener('change',()=>{if(reduce.matches&&document.body.dataset.mode==='pull')finish()});
})();
