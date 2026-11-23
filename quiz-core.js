/*
 * Daily cricket quiz (quiz.html). Everyone gets the same five questions on a given day: the date
 * seeds the random choices. Every question is built from the site's own data (venue-stats and
 * impact files) and only kept when the correct option is strictly the best of the four, so there
 * is never a tie or a wrong answer key.
 */
(function (root) {
  'use strict';

  function rng(seedText) {
    let h = 1779033703 ^ seedText.length;
    for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (list, r) => list[Math.floor(r() * list.length)];
  function shuffle(list, r) { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** Build a question from candidates [{label, value}] where the highest (or lowest) value wins. */
  function best(question, candidates, r, opts) {
    const o = opts || {};
    const pool = shuffle(candidates.filter(c => Number.isFinite(c.value)), r).slice(0, 12);
    if (pool.length < 4) return null;
    const chosen = pool.slice(0, 4);
    const sorted = chosen.slice().sort((a, b) => (o.lowest ? a.value - b.value : b.value - a.value));
    if (sorted[0].value === sorted[1].value) return null;
    if (new Set(chosen.map(c => c.label)).size !== 4) return null;
    return { question, options: chosen.map(c => c.label), answer: chosen.indexOf(sorted[0]), explain: o.explain ? o.explain(sorted[0], sorted) : sorted[0].label + ': ' + sorted[0].value };
  }

  // The busiest grounds in this league (WPL has few matches per ground, IPL many).
  const busy = (data, key) => {
    const list = data.venues.venues.filter(v => key === 'bowl' ? v.all.topBowlers.length : v.all.topBatters.length).slice().sort((a, b) => b.all.matches - a.all.matches);
    return list.slice(0, Math.max(4, Math.min(12, list.length))).filter(v => v.all.matches >= 6);
  };
  const GENERATORS = {
    venueRuns: (data, r) => {
      const venues = busy(data, 'bat');
      if (!venues.length) return null;
      const v = pick(venues, r);
      const top = v.all.topBatters[0];
      const others = data.venues.venues.filter(x => x !== v).flatMap(x => x.all.topBatters.slice(0, 2)).filter(b => !v.all.topBatters.some(t => t.name === b.name));
      const options = [{label: top.name, value: 2}, ...shuffle(others, r).slice(0, 6).map(b => ({label: b.name, value: 1 - r() * .5}))];
      const q = best('Who has scored the most ' + data.label + ' runs at ' + v.name.split(',')[0] + '?', options.slice(0, 4), r);
      if (q) q.explain = top.name + ' has ' + top.runs.toLocaleString('en-IN') + ' runs there in ' + top.innings + ' innings.';
      return q;
    },
    venueWickets: (data, r) => {
      const venues = busy(data, 'bowl');
      if (!venues.length) return null;
      const v = pick(venues, r);
      const top = v.all.topBowlers[0];
      const others = data.venues.venues.filter(x => x !== v).flatMap(x => x.all.topBowlers.slice(0, 2)).filter(b => !v.all.topBowlers.some(t => t.name === b.name));
      const options = [{label: top.name, value: 2}, ...shuffle(others, r).slice(0, 3).map(b => ({label: b.name, value: 1 - r() * .5}))];
      const q = best('Who has taken the most ' + data.label + ' wickets at ' + v.name.split(',')[0] + '?', options, r);
      if (q) q.explain = top.name + ' has ' + top.wickets + ' wickets there at an economy of ' + Number(top.economy).toFixed(2) + '.';
      return q;
    },
    highFirstInnings: (data, r) => best('Which ground has the highest average first-innings score in the ' + data.label + '?',
      busy(data, 'bat').filter(v => v.all.counted >= 6).map(v => ({label: v.name.split(',')[0], value: v.all.firstInnings.average})), r,
      {explain: (w, s) => w.label + ' averages ' + Math.round(w.value) + ' (the next of these: ' + Math.round(s[1].value) + ').'}),
    chaseWins: (data, r) => best('At which ground have chasing teams won the highest share of ' + data.label + ' matches?',
      busy(data, 'bat').filter(v => v.all.results.decided >= 6).map(v => ({label: v.name.split(',')[0], value: v.all.results.chaseWinPct})), r,
      {explain: w => 'Chasing sides have won ' + w.value.toFixed(1) + '% of results at ' + w.label + '.'}),
    winningKnocks: (data, r) => best('Who has played the most match-winning knocks in the ' + data.label + '? (30+ at SR 150+ in a winning chase, or the winners’ top score)',
      Object.entries(data.impact.all).filter(([, v]) => v.batting && v.batting.winningKnocks >= 2).map(([name, v]) => ({label: name, value: v.batting.winningKnocks})), r,
      {explain: w => w.label + ' has ' + w.value + ' match-winning knocks.'}),
    deathEconomy: (data, r) => best('Who has the best economy at the death (overs 16–20) in close ' + data.label + ' games? (min ' + (data.label === 'WPL' ? 5 : 20) + ' overs)',
      Object.entries(data.impact.all).filter(([, v]) => v.bowling && v.bowling.pressure.balls >= (data.label === 'WPL' ? 30 : 120)).map(([name, v]) => ({label: name, value: v.bowling.pressure.economy})), r,
      {lowest: true, explain: w => w.label + ' goes at ' + w.value.toFixed(2) + ' an over in those overs.'}),
    strikeRate: (data, r) => best('Who has the highest career strike rate in the ' + data.label + '? (min ' + (data.label === 'WPL' ? 300 : '1,000') + ' balls)',
      Object.entries(data.impact.all).filter(([, v]) => v.batting && v.batting.balls >= (data.label === 'WPL' ? 300 : 1000)).map(([name, v]) => ({label: name, value: v.batting.strikeRate})), r,
      {explain: w => w.label + ' scores at ' + w.value.toFixed(1) + '.'}),
  };

  /** Five questions for a date (YYYY-MM-DD), from different generators, deterministic. */
  function dailyQuiz(data, date, count) {
    const n = count || 5;
    const r = rng('tcs-quiz-' + date + '-' + data.label);
    const order = shuffle(Object.keys(GENERATORS), r);
    const questions = [];
    for (let attempt = 0; questions.length < n && attempt < 60; attempt++) {
      const key = order[attempt % order.length];
      if (attempt < order.length || questions.filter(q => q.kind === key).length < 1) {
        const q = GENERATORS[key](data, r);
        if (q && !questions.some(x => x.question === q.question)) questions.push({ ...q, kind: key });
      }
    }
    return questions;
  }

  const shareText = (date, results, label) => 'The Cricket Space ' + label + ' quiz · ' + date + ' · ' + results.filter(Boolean).length + '/' + results.length + ' ' + results.map(ok => (ok ? '🏏' : '⬜')).join('');

  /*
   * Sharing. A shared link opens the same league, and carries the sharer's score and date so a
   * friend sees "beat 3/5" on the same day's quiz. The questions themselves are never in the link.
   */
  const SITE = 'https://mstmayank.github.io/quiz.html';
  function quizLink(league, date, score) {
    const q = new URLSearchParams();
    if (league === 'wpl') q.set('league', 'wpl');
    if (Number.isInteger(score)) { q.set('beat', String(score)); q.set('d', date); }
    const t = q.toString();
    return SITE + (t ? '?' + t : '');
  }
  const inviteText = (league, date) => 'Can you get 5/5 on today’s ' + league.toUpperCase() + ' quiz? Five questions from real match data, new every day 🏏\n' + quizLink(league, date);
  const challengeText = (league, date, results) => {
    const score = results.filter(Boolean).length;
    return 'I got ' + score + '/' + results.length + ' on today’s ' + league.toUpperCase() + ' quiz on The Cricket Space ' + results.map(ok => (ok ? '🏏' : '⬜')).join('') +
      '\nCan you beat me? ' + quizLink(league, date, score);
  };
  /** A friend's challenge from the link, only for today's quiz; null otherwise. */
  function readChallenge(search, today, total) {
    const p = new URLSearchParams(search);
    const beat = Number(p.get('beat'));
    if (!p.has('beat') || p.get('d') !== today || !Number.isInteger(beat) || beat < 0 || beat > (total || 5)) return null;
    return { score: beat };
  }
  function verdict(mine, theirs) {
    if (mine > theirs) return 'You beat your friend’s ' + theirs + '. Send it back to them!';
    if (mine === theirs) return 'Level with your friend on ' + theirs + '. Challenge someone else!';
    return 'Your friend got ' + theirs + '. Try tomorrow’s quiz for a rematch.';
  }

  const api = { rng, dailyQuiz, shareText, quizLink, inviteText, challengeText, readChallenge, verdict, GENERATORS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSQuiz = api;
})(typeof window !== 'undefined' ? window : this);
