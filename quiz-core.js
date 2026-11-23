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

  /** A question with a known answer and wrong options; options are shuffled. */
  function choice(question, answer, wrong, r, explain) {
    const options = [answer, ...wrong.filter((w, i) => w !== answer && wrong.indexOf(w) === i)].map(String);
    const size = wrong.length >= 3 ? 4 : 2;
    if (options.length < size) return null;
    const list = shuffle(options.slice(0, size), r);
    return { question, options: list, answer: list.indexOf(String(answer)), explain };
  }
  /** Three believable wrong numbers around a true count. */
  function numberOptions(value, r) {
    const steps = value < 12 ? [-3, -2, -1, 1, 2, 3, 4] : value < 40 ? [-8, -5, -3, 3, 5, 8, 11] : null;
    const set = new Set();
    const pool = steps ? shuffle(steps, r).map(d => value + d) : shuffle([.7, .78, .86, 1.14, 1.22, 1.3, 1.4], r).map(m => Math.round(value * m));
    for (const n of pool) if (n > 0 && n !== value && set.size < 3) set.add(n);
    return [...set];
  }
  const L = data => data.label;
  const big = data => data.label !== 'WPL';
  const ground = v => v.name.split(',')[0];
  const month = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {month: 'long', year: 'numeric', timeZone: 'UTC'});
  const teamsIn = data => (data.teams ? Object.keys(data.teams.teams) : []);
  const runsMargin = m => { const x = /^(\d+) runs?$/.exec(m[7] || ''); return x ? Number(x[1]) : null; };

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

    // ---- Grounds
    tossField: (data, r) => best('At which ground do ' + L(data) + ' toss winners choose to bowl first most often?',
      busy(data, 'bat').map(v => ({label: ground(v), value: v.all.toss.fieldFirstPct})), r,
      {explain: w => 'Toss winners at ' + w.label + ' have chosen to field ' + w.value.toFixed(1) + '% of the time.'}),
    powerplayRate: (data, r) => best('Where is the ' + L(data) + ' powerplay (overs 1–6) run rate highest?',
      busy(data, 'bat').filter(v => v.all.phases?.[0]?.innings >= 10).map(v => ({label: ground(v), value: v.all.phases[0].runRate})), r,
      {explain: w => w.label + ': ' + w.value.toFixed(2) + ' an over in the powerplay.'}),
    deathRate: (data, r) => best('Where do ' + L(data) + ' batters score fastest at the death (overs 16–20)?',
      busy(data, 'bat').filter(v => v.all.phases?.[2]?.innings >= 10).map(v => ({label: ground(v), value: v.all.phases[2].runRate})), r,
      {explain: w => w.label + ': ' + w.value.toFixed(2) + ' an over at the death.'}),
    spinCheap: (data, r) => best('At which ground has spin bowling been cheapest in the ' + L(data) + '?',
      busy(data, 'bat').filter(v => v.all.paceSpin?.spin?.balls >= 300).map(v => ({label: ground(v), value: v.all.paceSpin.spin.economy})), r,
      {lowest: true, explain: w => 'Spinners go at ' + w.value.toFixed(2) + ' an over at ' + w.label + '.'}),
    chaseTrueFalse: (data, r) => {
      const list = busy(data, 'bat').filter(v => v.all.results.decided >= 8 && Math.abs(v.all.results.chaseWinPct - 50) >= 6);
      if (!list.length) return null;
      const v = pick(list, r), chase = v.all.results.chaseWins > v.all.results.defendWins;
      return choice('True or false: at ' + ground(v) + ', ' + L(data) + ' teams batting second have won more matches than teams batting first.', chase ? 'True' : 'False', [chase ? 'False' : 'True'], r,
        (chase ? 'True' : 'False') + '. Chasing sides have won ' + v.all.results.chaseWins + ' and defending sides ' + v.all.results.defendWins + ' there.');
    },

    // ---- Teams
    groundHighestTotal: (data, r) => {
      const list = busy(data, 'bat').filter(v => v.all.highest?.length && v.all.teams?.length >= 4);
      if (!list.length) return null;
      const v = pick(list, r), top = v.all.highest[0];
      if (v.all.highest.some(h => h.team !== top.team && h.runs === top.runs)) return null;
      return choice('Which team made the highest ' + L(data) + ' total at ' + ground(v) + '?', top.team, shuffle(v.all.teams.map(t => t.team).filter(t => t !== top.team), r).slice(0, 3), r,
        top.team + ' made ' + top.runs + '/' + top.wickets + ' against ' + top.opponent + ' in ' + month(top.date) + '.');
    },
    groundLowestTotal: (data, r) => {
      const list = busy(data, 'bat').filter(v => v.all.lowest?.length && v.all.teams?.length >= 4);
      if (!list.length) return null;
      const v = pick(list, r), low = v.all.lowest[0];
      if (v.all.lowest.some(h => h.team !== low.team && h.runs === low.runs)) return null;
      return choice('Which team has the lowest ' + L(data) + ' total at ' + ground(v) + '?', low.team, shuffle(v.all.teams.map(t => t.team).filter(t => t !== low.team), r).slice(0, 3), r,
        low.team + ' made ' + low.runs + (low.wickets < 10 ? '/' + low.wickets : ' all out') + ' against ' + low.opponent + ' in ' + month(low.date) + '.');
    },
    groundBestTeam: (data, r) => {
      const min = big(data) ? 8 : 4;
      const list = busy(data, 'bat').filter(v => (v.all.teams || []).filter(t => t.played >= min).length >= 4);
      if (!list.length) return null;
      const v = pick(list, r);
      return best('Which team has the best ' + L(data) + ' win record at ' + ground(v) + '? (min ' + min + ' matches)',
        v.all.teams.filter(t => t.played >= min).map(t => ({label: t.team, value: t.winPct, t})), r,
        {explain: w => w.label + ' have won ' + w.t.won + ' of ' + w.t.played + ' there (' + w.value.toFixed(1) + '%).'});
    },
    biggestWin: (data, r) => {
      if (!data.matches) return null;
      const seasons = [...new Set(data.matches.matches.map(m => m[2]))];
      const season = pick(seasons, r);
      const games = data.matches.matches.filter(m => m[2] === season && runsMargin(m) !== null).sort((a, b) => runsMargin(b) - runsMargin(a));
      if (games.length < 6 || runsMargin(games[0]) === runsMargin(games[1])) return null;
      const g = games[0], loser = g[3] === g[5] ? g[4] : g[3];
      const others = [...new Set(data.matches.matches.filter(m => m[2] === season).flatMap(m => [m[3], m[4]]))].filter(t => t !== g[5]);
      return choice('Which team had the biggest win by runs in ' + L(data) + ' ' + season + '?', g[5], shuffle(others, r).slice(0, 3), r,
        g[5] + ' beat ' + loser + ' by ' + g[7] + ' on ' + new Date(g[1] + 'T00:00:00Z').toLocaleDateString('en-GB', {day: 'numeric', month: 'long', timeZone: 'UTC'}) + '.');
    },
    headToHead: (data, r) => {
      if (!data.matches) return null;
      const min = big(data) ? 12 : 5, pairs = new Map();
      for (const m of data.matches.matches) {
        if (m[6] !== 'win') continue;
        const key = [m[3], m[4]].sort().join('|');
        const p = pairs.get(key) || {}; p[m[5]] = (p[m[5]] || 0) + 1; pairs.set(key, p);
      }
      const list = [...pairs].filter(([key, p]) => { const [a, b] = key.split('|'); return (p[a] || 0) + (p[b] || 0) >= min && (p[a] || 0) !== (p[b] || 0); });
      if (!list.length) return null;
      const [key, p] = pick(list, r), [a, b] = key.split('|'), win = (p[a] || 0) > (p[b] || 0) ? a : b, lose = win === a ? b : a;
      return choice('Head to head in the ' + L(data) + ': who has won more matches between ' + a + ' and ' + b + '?', win, [lose], r,
        win + ' lead ' + p[win] + '–' + (p[lose] || 0) + ' in results between the two.');
    },
    seasonTopTeam: (data, r) => {
      if (!data.teams) return null;
      const season = data.teams.latestSeason;
      const rows = Object.entries(data.teams.teams).filter(([, t]) => t.seasons?.[season]).map(([name, t]) => ({label: name, value: t.seasons[season].won, t: t.seasons[season]}));
      return best('Which of these teams won the most ' + L(data) + ' matches in ' + season + '?', rows, r,
        {explain: (w, sorted) => w.label + ' won ' + w.value + ' of ' + w.t.played + ' (next of these: ' + sorted[1].value + ').'});
    },

    // ---- Seasons
    teamBestSeason: (data, r) => {
      if (!data.teams) return null;
      const list = Object.entries(data.teams.teams).filter(([, t]) => Object.keys(t.seasons || {}).length >= 4);
      if (!list.length) return null;
      const [name, t] = pick(list, r);
      return best('In which season did ' + name + ' win the most ' + L(data) + ' matches?',
        Object.entries(t.seasons).map(([season, x]) => ({label: season, value: x.won, x})), r,
        {explain: w => name + ' won ' + w.value + ' of ' + w.x.played + ' in ' + w.label + '.'});
    },

    // ---- How many
    wicketsCount: (data, r) => {
      const list = Object.entries(data.impact.all).filter(([, v]) => v.bowling && v.bowling.wickets >= (big(data) ? 50 : 12));
      if (!list.length) return null;
      const [name, v] = pick(list, r), n = v.bowling.wickets;
      return choice('How many ' + L(data) + ' wickets has ' + name + ' taken?', n, numberOptions(n, r), r,
        name + ' has ' + n + ' wickets at an economy of ' + v.bowling.economy.toFixed(2) + '.');
    },
    knocksCount: (data, r) => {
      const list = Object.entries(data.impact.all).filter(([, v]) => v.batting && v.batting.winningKnocks >= (big(data) ? 8 : 3));
      if (!list.length) return null;
      const [name, v] = pick(list, r), n = v.batting.winningKnocks;
      return choice('How many match-winning knocks has ' + name + ' played in the ' + L(data) + '? (30+ at SR 150+ in a winning chase, or the winners’ top score)', n, numberOptions(n, r), r,
        name + ' has ' + n + ' match-winning knocks.');
    },
    runsRough: (data, r) => {
      const list = Object.entries(data.impact.all).filter(([, v]) => v.batting && v.batting.runs >= (big(data) ? 1500 : 400));
      if (!list.length) return null;
      const [name, v] = pick(list, r), unit = big(data) ? 100 : 50, n = Math.round(v.batting.runs / unit) * unit;
      const fmtN = x => 'About ' + x.toLocaleString('en-IN');
      const wrong = [...new Set(shuffle([.62, .74, 1.3, 1.45, .84, 1.18], r).map(m => Math.round(n * m / unit) * unit))].filter(x => x !== n && x > 0).slice(0, 3);
      return choice('Roughly how many ' + L(data) + ' runs has ' + name + ' scored?', fmtN(n), wrong.map(fmtN), r,
        fmtN(n) + ': ' + name + ' has ' + v.batting.runs.toLocaleString('en-IN') + ' runs at a strike rate of ' + v.batting.strikeRate.toFixed(1) + '.');
    },
    knockOpponent: (data, r) => {
      const list = Object.entries(data.impact.all).filter(([, v]) => v.batting?.bestKnocks?.[0]?.runs >= (big(data) ? 75 : 55));
      const teams = teamsIn(data);
      if (!list.length || teams.length < 4) return null;
      const [name, v] = pick(list, r), k = v.batting.bestKnocks[0];
      return choice('One of ' + name + '’s best ' + L(data) + ' knocks was ' + k.runs + ' off ' + k.balls + ' balls in ' + month(k.date) + '. Who was it against?', k.against,
        shuffle(teams.filter(t => t !== k.against), r).slice(0, 3), r, name + ' made ' + k.runs + ' off ' + k.balls + ' against ' + k.against + '.');
    },

    // ---- Players, other angles
    pressureAverage: (data, r) => best('Who averages the most with the bat in tight ' + L(data) + ' situations? (min ' + (big(data) ? 300 : 60) + ' balls under pressure)',
      Object.entries(data.impact.all).filter(([, v]) => v.batting?.pressure?.balls >= (big(data) ? 300 : 60) && v.batting.pressure.average).map(([name, v]) => ({label: name, value: v.batting.pressure.average})), r,
      {explain: w => w.label + ' averages ' + w.value.toFixed(1) + ' under pressure.'}),
    runsSaved: (data, r) => best('Which bowler saves the most runs per four overs compared with the average ' + L(data) + ' bowler? (min ' + (big(data) ? 600 : 120) + ' balls)',
      Object.entries(data.impact.all).filter(([, v]) => v.bowling?.balls >= (big(data) ? 600 : 120) && Number.isFinite(v.bowling.runsSavedPer24)).map(([name, v]) => ({label: name, value: v.bowling.runsSavedPer24})), r,
      {explain: w => w.label + ' saves ' + w.value.toFixed(1) + ' runs per four overs.'}),
    versusStrikeRate: (data, r) => {
      const list = shuffle(Object.entries(data.impact.all).filter(([, v]) => v.batting && v.batting.balls >= (big(data) ? 800 : 250)), r);
      for (let i = 0; i + 1 < list.length; i += 2) {
        const [a, va] = list[i], [b, vb] = list[i + 1];
        if (Math.abs(va.batting.strikeRate - vb.batting.strikeRate) < 3) continue;
        const [w, l] = va.batting.strikeRate > vb.batting.strikeRate ? [[a, va], [b, vb]] : [[b, vb], [a, va]];
        return choice('Who has the higher ' + L(data) + ' strike rate: ' + a + ' or ' + b + '?', w[0], [l[0]], r,
          w[0] + ' scores at ' + w[1].batting.strikeRate.toFixed(1) + ', ' + l[0] + ' at ' + l[1].batting.strikeRate.toFixed(1) + '.');
      }
      return null;
    },
  };
  // Question formats, so one day mixes "who", "where", "which team", "how many" and quick picks.
  const FORMAT = {
    venueRuns: 'player', venueWickets: 'player', winningKnocks: 'player', deathEconomy: 'player', strikeRate: 'player', pressureAverage: 'player', runsSaved: 'player',
    highFirstInnings: 'ground', chaseWins: 'ground', tossField: 'ground', powerplayRate: 'ground', deathRate: 'ground', spinCheap: 'ground',
    groundHighestTotal: 'team', groundLowestTotal: 'team', groundBestTeam: 'team', biggestWin: 'team', seasonTopTeam: 'team', knockOpponent: 'team',
    teamBestSeason: 'season', wicketsCount: 'number', knocksCount: 'number', runsRough: 'number',
    chaseTrueFalse: 'quick', headToHead: 'quick', versusStrikeRate: 'quick',
  };

  // Quizzes before this date keep the original seven types and order, so a day that was already
  // played never changes. Practice rounds use other seeds and always get the full mix.
  const MIX_FROM = '2026-11-24';
  const LEGACY = ['venueRuns', 'venueWickets', 'highFirstInnings', 'chaseWins', 'winningKnocks', 'deathEconomy', 'strikeRate'];
  function legacyQuiz(data, r, n) {
    const order = shuffle(LEGACY, r);
    const questions = [];
    for (let attempt = 0; questions.length < n && attempt < 60; attempt++) {
      const key = order[attempt % order.length];
      if (attempt < order.length || questions.filter(q => q.kind === key).length < 1) {
        const q = GENERATORS[key](data, r);
        if (q && !questions.some(x => x.question === q.question)) questions.push({ ...q, kind: key, format: FORMAT[key] });
      }
    }
    return questions;
  }

  /** Five questions for a date (YYYY-MM-DD), mixing formats, deterministic. */
  function dailyQuiz(data, date, count) {
    const n = count || 5;
    const r = rng('tcs-quiz-' + date + '-' + data.label);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date < MIX_FROM) return legacyQuiz(data, r, n);
    const order = shuffle(Object.keys(GENERATORS), r);
    const questions = [];
    // First pass: one question per format; then fill from any type not used yet; then repeats.
    for (const pass of [0, 1, 2]) {
      for (const key of order) {
        if (questions.length >= n) break;
        if (pass === 0 && questions.some(q => FORMAT[q.kind] === FORMAT[key])) continue;
        if (pass === 1 && questions.some(q => q.kind === key)) continue;
        const q = GENERATORS[key](data, r);
        if (q && !questions.some(x => x.question === q.question)) questions.push({ ...q, kind: key, format: FORMAT[key] });
      }
    }
    return shuffle(questions, r);
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

  const api = { rng, dailyQuiz, FORMAT, shareText, quizLink, inviteText, challengeText, readChallenge, verdict, GENERATORS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSQuiz = api;
})(typeof window !== 'undefined' ? window : this);
