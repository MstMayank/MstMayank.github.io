/* Player faces for any page: the site's portrait (battle-art/thumbs) when there is one, otherwise
   an initials badge in a colour from the name (the same formula as scripts/build-player-pages.py).
   Uses player/links.json: competition -> scorecard name -> page slug, and slug -> portrait. */
(function (root) {
  'use strict';
  let links = null, pending = null;
  const load = () => pending || (pending = fetch('/player/links.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(j => (links = j)));
  const hue = name => { let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i) * (i + 7); return h % 360; };
  const initials = name => { const w = name.trim().split(/\s+/); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
  const slug = (competition, name) => ((links || {})[competition] || {})[name] || null;
  function face(competition, name, cls) {
    const s = slug(competition, name), photo = s && (((links || {}).faces || {})[s] || ((links || {}).photos || {})[s]);
    const el = document.createElement('span');
    el.className = 'tcs-face' + (cls ? ' ' + cls : '');
    el.setAttribute('aria-hidden', 'true');
    if (photo) { el.classList.add('has-photo'); const img = new Image(); img.src = photo; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; el.appendChild(img); }
    else { el.style.setProperty('--h', hue(name)); el.textContent = initials(name); }
    return el;
  }
  /** Put a face in `host` (prepended) once the link data has loaded. */
  function attach(host, competition, name, cls) {
    load().then(() => { if (host.isConnected !== false) host.prepend(face(competition, name, cls)); });
  }
  root.TCSFaces = { load, face, attach, slug };
})(window);
