/*
 * Milestone watch for the Record Book.
 *
 * Works on archive rows (one per player innings, rebuilt by unpackArchive in record-book.html):
 *   [category ('Batting' | 'Bowling'), name, team, opponent, value (runs or wickets), extra,
 *    date (YYYY-MM-DD), gender, series, season, playerId, ...]
 *
 * Totals only count matches with ball-by-ball data. For formats whose archive starts after the
 * format itself began (Tests from Dec 2001, ODIs from Jun 2002), a player is only included if his
 * first archived match came at least a year after the archive start, so an older player's partial
 * career can never produce a false milestone. T20Is are archived from the first matches played.
 */
(function (root) {
  'use strict';

  const RULES = {
    Batting: { step: 1000, window: 300, unit: 'runs' },
    Bowling: { step: 50, window: 10, unit: 'wickets' }
  };
  const ACTIVE_DAYS = 548;   // played in the last 18 months
  const RECENT_DAYS = 30;    // "reached lately" window
  const COMPLETE_AFTER_DAYS = 365;

  const day = iso => Date.parse(iso + 'T00:00:00Z');
  const DAY_MS = 86400000;

  /** Per player (by id, falling back to name) and category: totals, dates and latest details. */
  function careers(rows) {
    const map = new Map();
    for (const row of rows) {
      const kind = row[0];
      if (!RULES[kind]) continue;
      const key = kind + '|' + (row[10] || row[1]);
      let c = map.get(key);
      if (!c) map.set(key, c = { kind, id: row[10] || row[1], name: row[1], team: row[2], gender: row[7], total: 0, innings: 0, first: row[6], last: row[6], rows: [] });
      c.total += row[4];
      c.innings += 1;
      if (row[6] < c.first) c.first = row[6];
      if (row[6] >= c.last) { c.last = row[6]; c.name = row[1]; c.team = row[2]; }
      c.rows.push(row);
    }
    return [...map.values()];
  }

  /**
   * options: { format, latest (YYYY-MM-DD, defaults to the newest row), archiveStart (YYYY-MM-DD or
   * null when the archive covers the whole format), limit }
   * Returns { near: [...], reached: [...] } sorted by closeness / recency.
   */
  function milestones(rows, options) {
    const opts = options || {};
    const latest = opts.latest || rows.reduce((m, r) => (r[6] > m ? r[6] : m), '');
    const now = day(latest);
    const startOk = c => !opts.archiveStart || day(c.first) >= day(opts.archiveStart) + COMPLETE_AFTER_DAYS * DAY_MS;
    const near = [], reached = [];
    for (const c of careers(rows)) {
      const rule = RULES[c.kind];
      if (!startOk(c)) continue;
      const active = now - day(c.last) <= ACTIVE_DAYS * DAY_MS;
      // Reached lately: the running total crossed a multiple of the step inside the recent window.
      const sorted = c.rows.slice().sort((a, b) => (a[6] < b[6] ? -1 : a[6] > b[6] ? 1 : 0));
      let running = 0;
      for (const row of sorted) {
        const before = running;
        running += row[4];
        const crossed = Math.floor(running / rule.step) > Math.floor(before / rule.step) && running >= rule.step;
        if (crossed && now - day(row[6]) <= RECENT_DAYS * DAY_MS) {
          reached.push({ kind: c.kind, unit: rule.unit, name: c.name, id: c.id, team: c.team, gender: c.gender, format: opts.format, milestone: Math.floor(running / rule.step) * rule.step, total: c.total, date: row[6], opponent: row[3] });
        }
      }
      if (!active) continue;
      const next = (Math.floor(c.total / rule.step) + 1) * rule.step;
      const need = next - c.total;
      if (need > rule.window) continue;
      const perInnings = c.total / c.innings;
      near.push({ kind: c.kind, unit: rule.unit, name: c.name, id: c.id, team: c.team, gender: c.gender, format: opts.format, total: c.total, next, need, innings: c.innings,
        perInnings, inningsAway: perInnings > 0 ? Math.max(1, Math.ceil(need / perInnings)) : null, last: c.last });
    }
    // Closest first (in innings), then the bigger milestone (15,000 before 1,000).
    near.sort((a, b) => Math.min(a.inningsAway ?? 9, 3) - Math.min(b.inningsAway ?? 9, 3) || b.next - a.next || a.need - b.need);
    reached.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.milestone - a.milestone));
    const limit = opts.limit || Infinity;
    return { latest, near: near.slice(0, limit), reached: reached.slice(0, limit) };
  }

  const api = { milestones, careers, RULES, ACTIVE_DAYS, RECENT_DAYS, COMPLETE_AFTER_DAYS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSMilestones = api;
})(typeof window !== 'undefined' ? window : this);
