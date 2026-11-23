/* Player pages: share button, the A–Z filter on /player/, and the on-demand match-up list.
   The match-up list downloads battle-<competition>.json only when the button is pressed. */
(() => {
  'use strict';
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
  const num = (v, d) => (v === null || !Number.isFinite(v) ? '–' : v.toLocaleString('en-IN', { maximumFractionDigits: d ?? 0, minimumFractionDigits: d ?? 0 }));

  const profileHeader = document.querySelector('.pp-head');
  if (profileHeader && !document.getElementById('pp-filter')) {
    const slug = location.pathname.split('/').pop().replace(/\.html$/, '');
    fetch('/battle-art/portraits.json').then(r => r.ok ? r.json() : null).then(art => {
      const asset = art?.profiles[slug];
      if (!asset) return;
      const image = new Image();
      image.alt = '';
      image.onload = () => {
        profileHeader.classList.add('with-portrait');
        profileHeader.prepend(image);
      };
      image.src = '/battle-art/' + asset + '.jpg';
    }).catch(() => {});
  }

  // Share
  for (const button of document.querySelectorAll('.pp-share')) {
    button.addEventListener('click', async () => {
      const data = { title: button.dataset.title + ' | The Cricket Space', url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else { await navigator.clipboard.writeText(location.href); button.textContent = 'Link copied'; }
      } catch (error) { if (error.name !== 'AbortError') button.textContent = 'Copy the address bar link'; }
    });
  }

  // Index filter
  const filter = document.getElementById('pp-filter');
  if (filter) {
    const clean = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const items = [...document.querySelectorAll('.pp-list li')].map(li => ({ li, key: clean(li.textContent) }));
    filter.addEventListener('input', () => {
      const q = clean(filter.value.trim());
      for (const { li, key } of items) li.hidden = !!q && !key.includes(q);
      let any = false;
      for (const section of document.querySelectorAll('.pp-letter')) { const shown = [...section.querySelectorAll('li')].some(li => !li.hidden); section.hidden = !shown; any = any || shown; }
      document.querySelector('.pp-letters').hidden = !!q;
      const feat = document.querySelector('.pp-featured'); if (feat) feat.hidden = !!q;
      document.getElementById('pp-empty').hidden = any;
    });
  }

  // Every match-up, on demand
  const cache = {};
  const load = key => (cache[key] ||= Promise.all([
    fetch('/battle-' + key + '.json').then(r => { if (!r.ok) throw new Error('download'); return r.json(); }),
    fetch('/player/links.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  ]).catch(error => { delete cache[key]; throw error; }));

  function render(out, data, links, name, role) {
    const id = data.players.indexOf(name);
    const batting = role === 'batting';
    const totals = new Map();
    for (const r of data.rows) {
      if ((batting ? r[1] : r[2]) !== id) continue;
      const other = batting ? r[2] : r[1];
      const t = totals.get(other) || { runs: 0, balls: 0, outs: 0, dots: 0 };
      t.runs += batting ? r[4] : r[10]; t.balls += batting ? r[5] : r[11]; t.outs += r[9]; t.dots += batting ? r[6] : r[14];
      totals.set(other, t);
    }
    const list = [...totals].filter(([, t]) => t.balls > 0).map(([other, t]) => ({ name: data.players[other], ...t,
      rate: batting ? t.runs / t.balls * 100 : t.runs / t.balls * 6, dot: t.dots / t.balls * 100 }));
    const cols = [['name', batting ? 'Bowler' : 'Batter'], ['balls', 'Balls'], ['runs', 'Runs'], ['rate', batting ? 'SR' : 'Economy'], ['outs', batting ? 'Outs' : 'Wickets'], ['dot', 'Dot %']];
    let sortKey = 'balls', desc = true;
    const wrap = el('div', undefined, 'pp-scroll'), table = el('table', undefined, 'pp-table');
    const caption = el('caption', list.length + ' opponents, every ball in the archive. Tap a heading to sort.');
    const head = el('thead'), tr = el('tr'), body = el('tbody');
    for (const [key, label] of cols) {
      const th = el('th'); th.scope = 'col'; const b = el('button', label, 'pp-sort'); b.type = 'button';
      b.addEventListener('click', () => { desc = sortKey === key ? !desc : key !== 'name'; sortKey = key; draw(); });
      th.appendChild(b); tr.appendChild(th);
    }
    head.appendChild(tr); table.append(caption, head, body); wrap.appendChild(table);
    function draw() {
      for (const th of tr.children) th.removeAttribute('aria-sort');
      tr.children[cols.findIndex(c => c[0] === sortKey)].setAttribute('aria-sort', desc ? 'descending' : 'ascending');
      list.sort((a, b) => (sortKey === 'name' ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey]) * (desc ? -1 : 1));
      body.replaceChildren(...list.map(p => {
        const row = el('tr'), th = el('th'); th.scope = 'row';
        const slug = links && links[p.name];
        if (slug) { const a = el('a', p.name); a.href = '/player/' + slug + '.html'; th.appendChild(a); } else th.textContent = p.name;
        row.append(th, el('td', num(p.balls)), el('td', num(p.runs)), el('td', num(p.rate, batting ? 1 : 2)), el('td', num(p.outs)), el('td', num(p.dot) + '%'));
        return row;
      }));
    }
    draw();
    out.replaceChildren(wrap);
  }

  for (const box of document.querySelectorAll('.pp-more')) {
    const button = box.querySelector('.pp-load'), out = box.querySelector('.pp-more-out');
    button.addEventListener('click', async () => {
      button.disabled = true; out.replaceChildren(el('p', 'Loading ball-by-ball data…', 'pp-note'));
      try {
        const [data, links] = await load(box.dataset.competition);
        render(out, data, links[box.dataset.competition], box.dataset.player, box.dataset.role);
        button.hidden = true;
      } catch {
        out.replaceChildren(el('p', 'The match-up data could not load. Check your connection and try again.', 'pp-note'));
        button.disabled = false;
      }
    });
  }
})();
