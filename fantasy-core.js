/*
 * Fantasy XI helper (fantasy.html). Not betting advice: a stats-based suggestion.
 *
 * Fantasy points per match are rebuilt from battle-<competition>.json with a common T20 scoring
 * (POINTS below): runs, boundary bonuses, 30/50/100 bonuses; 25 per wicket, bowled/lbw bonus,
 * 3/4/5-wicket bonuses; catches, stumpings and run-outs.
 * Expected points = recent form (last 10 matches, 70%) blended with the last two seasons (30%),
 * then nudged by the player's record at the venue and against the opposing squad (each capped at
 * ±15%, only with enough evidence). Roles come from the data: keepers have stumpings, all-rounders
 * both bat and bowl. Credits scale with recent points. The XI follows RULES.
 */
(function (root) {
  'use strict';

  const POINTS = { run: 1, four: 1, six: 2, thirty: 4, fifty: 8, hundred: 16, wicket: 25, bowledLbw: 8, threeW: 4, fourW: 8, fiveW: 16, catch: 8, stumping: 12, runOut: 6 };
  const RULES = { players: 11, credits: 100, maxPerTeam: 7, roles: { WK: [1, 4], BAT: [3, 6], AR: [1, 4], BOWL: [3, 6] } };
  const WEIGHTS = { form: .7, seasons: .3, venueCap: .15, matchupCap: .15, venueMinMatches: 3, matchupMinBalls: 30 };

  /** matchIdx -> Map(playerId -> {pts, runs, balls, wickets, catches, ...}) */
  function matchPoints(data) {
    const byMatch = new Map();
    const get = (m, id) => {
      let match = byMatch.get(m);
      if (!match) byMatch.set(m, match = new Map());
      let p = match.get(id);
      if (!p) match.set(id, p = { runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, bowledLbw: 0, catches: 0, stumpings: 0, runOuts: 0, batBalls: 0, bowlBalls: 0 });
      return p;
    };
    for (const row of data.rows) {
      const bat = get(row[0], row[1]);
      bat.runs += row[4]; bat.balls += row[5]; bat.fours += row[7]; bat.sixes += row[8]; bat.batBalls += row[5];
      const bowl = get(row[0], row[2]);
      bowl.wickets += row[9]; bowl.bowlBalls += row[11];
    }
    for (const d of data.dismissals || []) {
      if (d[3] === 'bowled' || d[3] === 'lbw') get(d[0], d[2]).bowledLbw += 1;
      if (d[3] === 'caught and bowled') get(d[0], d[2]).catches += 1;
      for (const f of d[5] || []) {
        if (d[3] === 'caught') get(d[0], f).catches += 1;
        else if (d[3] === 'stumped') get(d[0], f).stumpings += 1;
        else if (d[3] === 'run out') get(d[0], f).runOuts += 1;
      }
    }
    for (const match of byMatch.values()) for (const p of match.values()) p.pts = score(p);
    return byMatch;
  }

  function score(p) {
    const P = POINTS;
    let pts = p.runs * P.run + p.fours * P.four + p.sixes * P.six;
    if (p.runs >= 100) pts += P.hundred; else if (p.runs >= 50) pts += P.fifty; else if (p.runs >= 30) pts += P.thirty;
    pts += p.wickets * P.wicket + p.bowledLbw * P.bowledLbw;
    if (p.wickets >= 5) pts += P.fiveW; else if (p.wickets >= 4) pts += P.fourW; else if (p.wickets >= 3) pts += P.threeW;
    pts += p.catches * P.catch + p.stumpings * P.stumping + p.runOuts * P.runOut;
    return pts;
  }

  const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Profile for one player: recent form, seasons average, role, venue and opposition factors. */
  function profile(data, points, id, opts) {
    const o = opts || {};
    const games = [];
    for (const [m, match] of points) if (match.has(id)) games.push({ m, date: data.matches[m][2], season: data.matches[m][0], venue: data.matches[m][1], ...match.get(id) });
    games.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!games.length) return null;
    const seasons = [...new Set(data.matches.map(m => m[0]))].sort().slice(-2);
    const recent = games.slice(0, 10), lastTwo = games.filter(g => seasons.includes(g.season));
    const form = mean(recent.map(g => g.pts)), seasonAvg = mean(lastTwo.map(g => g.pts)) ?? form;
    let expected = WEIGHTS.form * form + WEIGHTS.seasons * seasonAvg;
    const reasons = [];
    // Venue: average at this ground against overall, with enough matches there.
    if (o.venueLabel && o.venueOf) {
      const here = games.filter(g => o.venueOf(g.venue) === o.venueLabel);
      const all = mean(games.map(g => g.pts));
      if (here.length >= WEIGHTS.venueMinMatches && all > 0) {
        const f = clamp(mean(here.map(g => g.pts)) / all - 1, -WEIGHTS.venueCap, WEIGHTS.venueCap);
        expected *= 1 + f;
        if (Math.abs(f) >= .05) reasons.push((f > 0 ? 'Strong' : 'Weaker') + ' record at this venue');
      }
    }
    // Opposition: SR against the opposing squad's bowlers, or economy against its batters.
    if (o.opponents && o.opponents.size) {
      let balls = 0, runs = 0, allBalls = 0, allRuns = 0, bowled = 0, conceded = 0, allBowled = 0, allConceded = 0;
      for (const row of data.rows) {
        if (row[1] === id) { allBalls += row[5]; allRuns += row[4]; if (o.opponents.has(row[2])) { balls += row[5]; runs += row[4]; } }
        if (row[2] === id) { allBowled += row[11]; allConceded += row[10]; if (o.opponents.has(row[1])) { bowled += row[11]; conceded += row[10]; } }
      }
      let f = 0;
      if (balls >= WEIGHTS.matchupMinBalls && allBalls) f += (runs / balls) / (allRuns / allBalls) - 1;
      if (bowled >= WEIGHTS.matchupMinBalls && allBowled && conceded) f += (allConceded / allBowled) / (conceded / bowled) - 1;
      f = clamp(f / 2, -WEIGHTS.matchupCap, WEIGHTS.matchupCap);
      expected *= 1 + f;
      if (Math.abs(f) >= .05) reasons.push((f > 0 ? 'Good' : 'Tough') + ' match-up against this opposition');
    }
    const batBalls = lastTwo.reduce((n, g) => n + g.batBalls, 0), bowlBalls = lastTwo.reduce((n, g) => n + g.bowlBalls, 0);
    const keeper = games.slice(0, 30).some(g => g.stumpings > 0);
    const role = keeper ? 'WK' : bowlBalls >= 120 && batBalls >= 120 ? 'AR' : bowlBalls > batBalls ? 'BOWL' : 'BAT';
    if (form > seasonAvg * 1.2) reasons.unshift('In form');
    return { id, role, form, seasonAvg, expected, matches: games.length, recentMatches: recent.length, reasons };
  }

  /** Credits 7.0–10.5 by recent average points, in steps of 0.5. */
  function credits(seasonAvg, all) {
    const sorted = all.slice().sort((a, b) => a - b);
    const rank = sorted.filter(v => v < seasonAvg).length / Math.max(1, sorted.length - 1);
    return Math.round((7 + 3.5 * clamp(rank, 0, 1)) * 2) / 2;
  }

  /**
   * Pick 11 under the RULES maximising expected points: depth-first branch and bound over players
   * sorted by expected points, pruned by an optimistic bound and by what can still be completed
   * (credits, team and role limits). Stops after `maxNodes` and returns the best XI found.
   */
  function pickXI(pool, rules, maxNodes) {
    const R = rules || RULES;
    const roles = Object.keys(R.roles);
    const players = pool.slice().sort((a, b) => b.expected - a.expected);
    const n = players.length;
    let best = null, bestScore = -Infinity, nodes = 0;
    const limit = maxNodes || 300000;
    const chosen = [], roleCount = Object.fromEntries(roles.map(r => [r, 0])), teamCount = {};
    // Cheapest credits among players from index i on, sorted, for the "can still finish" check.
    const cheapest = players.map((_, i) => players.slice(i).map(p => p.credits).sort((a, b) => a - b));
    function canFinish(i, credits) {
      const left = R.players - chosen.length;
      if (left > n - i) return false;
      if (roles.reduce((m, r) => m + Math.max(0, R.roles[r][0] - roleCount[r]), 0) > left) return false;
      for (const r of roles) {
        const need = R.roles[r][0] - roleCount[r];
        if (need > 0 && players.slice(i).filter(p => p.role === r).length < need) return false;
      }
      const cheap = cheapest[i] || [];
      let cost = 0; for (let k = 0; k < left; k++) cost += cheap[k] ?? Infinity;
      return credits + cost <= R.credits;
    }
    function dfs(i, credits, total) {
      if (++nodes > limit) return;
      if (chosen.length === R.players) {
        if (roles.every(r => roleCount[r] >= R.roles[r][0]) && total > bestScore) { bestScore = total; best = chosen.slice(); }
        return;
      }
      if (i >= n || !canFinish(i, credits)) return;
      // Optimistic bound: the best remaining expected points fill every open slot.
      let bound = total; for (let k = i, c = chosen.length; k < n && c < R.players; k++, c++) bound += players[k].expected;
      if (bound <= bestScore) return;
      const p = players[i];
      if (credits + p.credits <= R.credits && roleCount[p.role] < R.roles[p.role][1] && (teamCount[p.team] || 0) < R.maxPerTeam) {
        chosen.push(p); roleCount[p.role]++; teamCount[p.team] = (teamCount[p.team] || 0) + 1;
        dfs(i + 1, credits + p.credits, total + p.expected);
        chosen.pop(); roleCount[p.role]--; teamCount[p.team]--;
      }
      dfs(i + 1, credits, total);
    }
    dfs(0, 0, 0);
    if (!best) return null;
    best.sort((a, b) => b.expected - a.expected);
    return { players: best, captain: best[0].id, viceCaptain: best[1].id, credits: best.reduce((m, p) => m + p.credits, 0),
      expected: bestScore + best[0].expected + best[1].expected * .5, exhaustive: nodes <= limit };
  }

  const api = { POINTS, RULES, WEIGHTS, matchPoints, score, profile, credits, pickXI };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSFantasy = api;
})(typeof window !== 'undefined' ? window : this);
