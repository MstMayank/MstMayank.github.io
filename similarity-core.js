/*
 * "Players most like X" for Player Battle.
 *
 * Builds a style vector for every player with MIN_BALLS+ balls in the given rows
 * (battle-<competition>.json: [match, batter, bowler, phase, runs, balls, dots, fours, sixes,
 * wickets, conceded, legal, wides, noBalls, bowlingDots, outs]):
 *   Batting: strike rate in each phase, dot %, boundary %, sixes as a share of boundaries,
 *            balls per dismissal.
 *   Bowling: economy in each phase, dot %, balls per wicket, boundary % conceded.
 * Phase features are only used when the rows have phases (not Tests). A phase where the player
 * has fewer than PHASE_MIN balls uses the league value, so it neither helps nor hurts.
 * Every feature is turned into a z-score (distance from the average in standard deviations),
 * and players are compared with cosine similarity, shown as a 0-100 match.
 */
(function (root) {
  'use strict';

  const MIN_BALLS = 300;
  const PHASE_MIN = 30;
  // [phrase when well above average, phrase when well below average]
  const PHRASES = {
    batting: [['fast in the powerplay', 'steady in the powerplay'], ['fast through the middle overs', 'steady through the middle overs'],
      ['big hitter at the death', 'slower at the death'], ['plays lots of dot balls', 'rotates strike well'],
      ['hits lots of boundaries', 'fewer boundaries'], ['six-hitter', 'mostly fours'], ['hard to dismiss', 'gets out more often']],
    bowling: [['expensive in the powerplay', 'tight in the powerplay'], ['expensive in the middle overs', 'tight in the middle overs'],
      ['expensive at the death', 'tight at the death'], ['bowls lots of dot balls', 'fewer dot balls'],
      ['takes wickets less often', 'strikes often'], ['leaks boundaries', 'hard to hit for boundaries']]
  };
  const LABELS = {
    batting: ['powerplay strike rate', 'middle-overs strike rate', 'death strike rate', 'dot-ball %', 'boundary %', 'six-hitting share', 'balls per dismissal'],
    bowling: ['powerplay economy', 'middle-overs economy', 'death economy', 'dot-ball %', 'balls per wicket', 'boundary % conceded']
  };

  function totals(rows, role) {
    const who = role === 'bowling' ? 2 : 1;
    const players = new Map();
    for (const row of rows) {
      let p = players.get(row[who]);
      if (!p) players.set(row[who], p = { all: new Array(8).fill(0), phase: [0, 1, 2].map(() => [0, 0]) });
      const a = p.all;
      a[0] += row[4]; a[1] += row[5]; a[2] += row[6]; a[3] += row[7]; a[4] += row[8];
      a[5] += row[10]; a[6] += row[11]; a[7] += row[14];
      if (role === 'bowling') { a.wickets = (a.wickets || 0) + row[9]; }
      else { a.outs = (a.outs || 0) + row[15]; }
      const ph = p.phase[row[3]];
      if (ph) { ph[0] += role === 'bowling' ? row[10] : row[4]; ph[1] += role === 'bowling' ? row[11] : row[5]; }
    }
    return players;
  }

  function rawFeatures(p, role, phased, league) {
    const a = p.all;
    const div = (x, y, m = 1) => (y ? x * m / y : null);
    const phase = i => {
      if (!phased) return null;
      const [num, balls] = p.phase[i];
      if (balls < PHASE_MIN) return league ? league[i] : null;
      return role === 'bowling' ? num / balls * 6 : num / balls * 100;
    };
    if (role === 'bowling') {
      return [phase(0), phase(1), phase(2), div(a[7], a[6], 100), div(a[6], a.wickets || 0) ?? a[6] * 2, div(a[3] + a[4], a[6], 100)];
    }
    return [phase(0), phase(1), phase(2), div(a[2], a[1], 100), div(a[3] + a[4], a[1], 100), div(a[4], a[3] + a[4], 100) ?? 0, div(a[1], a.outs || 0) ?? a[1] * 2];
  }

  function build(rows, role, options) {
    const minBalls = (options && options.minBalls) || MIN_BALLS;
    // Tests store the innings number where limited-overs data stores the phase, so callers say.
    const phased = options && options.phased !== undefined ? options.phased : rows.some(row => row[3] === 1 || row[3] === 2);
    const players = totals(rows, role);
    const sample = p => (role === 'bowling' ? p.all[6] : p.all[1]);
    // League value for each phase, used to fill thin phases.
    const leagueSums = [0, 1, 2].map(() => [0, 0]);
    for (const p of players.values()) p.phase.forEach((ph, i) => { leagueSums[i][0] += ph[0]; leagueSums[i][1] += ph[1]; });
    const league = leagueSums.map(([num, balls]) => (balls ? (role === 'bowling' ? num / balls * 6 : num / balls * 100) : null));
    const ids = [...players.keys()].filter(id => sample(players.get(id)) >= minBalls);
    const raw = ids.map(id => rawFeatures(players.get(id), role, phased, league));
    const used = LABELS[role].map((_, f) => raw.some(v => v[f] !== null));
    const mean = [], sd = [];
    LABELS[role].forEach((_, f) => {
      const values = raw.map(v => v[f]).filter(v => v !== null);
      const m = values.reduce((s, v) => s + v, 0) / (values.length || 1);
      const s = Math.sqrt(values.reduce((t, v) => t + (v - m) ** 2, 0) / (values.length || 1)) || 1;
      mean.push(m); sd.push(s);
    });
    const z = raw.map(v => v.map((x, f) => (used[f] && x !== null ? (x - mean[f]) / sd[f] : 0)));
    return { role, ids, raw, z, used, mean, labels: LABELS[role], minBalls, sample: id => sample(players.get(id)) };
  }

  function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // Up to two features where both players sit clearly on the same side of average.
  function reasons(model, i, j) {
    const a = model.z[i], b = model.z[j];
    return a.map((v, f) => ({ f, both: Math.min(Math.abs(v), Math.abs(b[f])), same: Math.sign(v) === Math.sign(b[f]) }))
      .filter(x => model.used[x.f] && x.same && x.both >= 0.5)
      .sort((x, y) => y.both - x.both)
      .slice(0, 2)
      .map(x => PHRASES[model.role][x.f][a[x.f] > 0 ? 0 : 1]);
  }

  function similar(model, id, count) {
    const i = model.ids.indexOf(id);
    if (i < 0) return null;
    return model.ids.map((other, j) => ({ id: other, j, score: cosine(model.z[i], model.z[j]) }))
      .filter(item => item.id !== id)
      .sort((a, b) => b.score - a.score)
      .slice(0, count || 5)
      .map(item => ({ id: item.id, match: Math.round((item.score + 1) * 50), raw: model.raw[item.j], reasons: reasons(model, i, item.j) }));
  }

  const api = { build, similar, cosine, MIN_BALLS, PHASE_MIN, LABELS, PHRASES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSSimilarity = api;
})(typeof window !== 'undefined' ? window : this);
