/*
 * Recent form for Player Battle.
 *
 * Rebuilds a player's innings (batting) or matches (bowling) from battle-<competition>.json:
 *   rows:       [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, conceded, legal, ...]
 *   dismissals: [match, batter, bowler, kind, phase, [fielders]]
 *   matches:    [season, venue, date, [teams], result, winner, id, (format)]
 * A batter is out in a match when the dismissals list has him as the batter; a batter run out
 * without facing a ball still gets a 0 (0) innings. One entry per match (Tests combine both innings).
 *
 * Form badge (FORM_RULES): needs 5+ recent entries, compares the last 10 with the whole career.
 *   Batting: "In form" = runs per innings 25%+ above career and SR no more than 5% below it;
 *            "Out of form" = runs per innings 25%+ below career.
 *   Bowling: "In form" = wickets per match 25%+ above career with economy no more than 5% worse,
 *            or economy 12%+ better with wickets per match no more than 10% lower;
 *            "Out of form" = economy 15%+ worse, or wickets per match 30%+ lower without a
 *            better economy.
 */
(function (root) {
  'use strict';

  const FORM_RULES = { recent: 10, minRecent: 5, up: 0.25, down: 0.25, srSlack: 0.05,
    econSlack: 0.05, econBetter: 0.12, wicketSlack: 0.10, econWorse: 0.15, wicketsDown: 0.30 };

  function byDate(matches) {
    return (a, b) => (matches[b.match][2] > matches[a.match][2] ? 1 : matches[b.match][2] < matches[a.match][2] ? -1 : b.match - a.match);
  }

  // Newest first.
  function battingInnings(rows, dismissals, matches, playerId) {
    const byMatch = new Map();
    const get = match => {
      if (!byMatch.has(match)) byMatch.set(match, { match, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: null });
      return byMatch.get(match);
    };
    for (const row of rows) {
      if (row[1] !== playerId) continue;
      const entry = get(row[0]);
      entry.runs += row[4]; entry.balls += row[5]; entry.fours += row[7]; entry.sixes += row[8];
    }
    for (const wicket of dismissals) {
      if (wicket[1] !== playerId) continue;
      const entry = get(wicket[0]);
      entry.out = true;
      entry.how = entry.how ? entry.how : wicket[3];
    }
    return [...byMatch.values()].sort(byDate(matches));
  }

  function bowlingMatches(rows, matches, playerId) {
    const byMatch = new Map();
    for (const row of rows) {
      if (row[2] !== playerId) continue;
      if (!byMatch.has(row[0])) byMatch.set(row[0], { match: row[0], wickets: 0, conceded: 0, legal: 0, dots: 0 });
      const entry = byMatch.get(row[0]);
      entry.wickets += row[9]; entry.conceded += row[10]; entry.legal += row[11]; entry.dots += row[14];
    }
    return [...byMatch.values()].filter(entry => entry.legal > 0).sort(byDate(matches));
  }

  function ratio(a, b, m) { return b ? a * (m || 1) / b : null; }

  function battingSummary(list) {
    const runs = list.reduce((s, e) => s + e.runs, 0), balls = list.reduce((s, e) => s + e.balls, 0);
    const outs = list.filter(e => e.out).length;
    return { innings: list.length, runs, balls, outs, strikeRate: ratio(runs, balls, 100), average: ratio(runs, outs), perInnings: ratio(runs, list.length) };
  }

  function bowlingSummary(list) {
    const wickets = list.reduce((s, e) => s + e.wickets, 0), conceded = list.reduce((s, e) => s + e.conceded, 0);
    const legal = list.reduce((s, e) => s + e.legal, 0);
    return { matches: list.length, wickets, conceded, legal, economy: ratio(conceded, legal, 6), average: ratio(conceded, wickets), perMatch: ratio(wickets, list.length) };
  }

  function badge(role, recent, career) {
    const r = FORM_RULES;
    const count = role === 'bowling' ? recent.matches : recent.innings;
    const careerCount = role === 'bowling' ? career.matches : career.innings;
    if (count < r.minRecent || careerCount <= count) return { label: 'Not enough matches', key: 'none' };
    if (role === 'bowling') {
      const wkt = career.perMatch ? recent.perMatch / career.perMatch : 1;
      const econ = career.economy ? recent.economy / career.economy : 1;
      if ((wkt >= 1 + r.up && econ <= 1 + r.econSlack) || (econ <= 1 - r.econBetter && wkt >= 1 - r.wicketSlack)) return { label: 'In form', key: 'up' };
      if (econ >= 1 + r.econWorse || (wkt <= 1 - r.wicketsDown && econ >= 1)) return { label: 'Out of form', key: 'down' };
      return { label: 'Steady', key: 'even' };
    }
    const output = career.perInnings ? recent.perInnings / career.perInnings : 1;
    const pace = career.strikeRate ? recent.strikeRate / career.strikeRate : 1;
    if (output >= 1 + r.up && pace >= 1 - r.srSlack) return { label: 'In form', key: 'up' };
    if (output <= 1 - r.down) return { label: 'Out of form', key: 'down' };
    return { label: 'Steady', key: 'even' };
  }

  function form(data, playerId, role, rows) {
    const source = rows || data.rows;
    // Only dismissals from matches in these rows (e.g. one format of the international data).
    const inRows = new Set(source.map(row => row[0]));
    const dismissals = (data.dismissals || []).filter(wicket => inRows.has(wicket[0]));
    const list = role === 'bowling' ? bowlingMatches(source, data.matches, playerId) : battingInnings(source, dismissals, data.matches, playerId);
    const recentList = list.slice(0, FORM_RULES.recent);
    const sum = role === 'bowling' ? bowlingSummary : battingSummary;
    const recent = sum(recentList), career = sum(list);
    return { list: recentList, recent, career, badge: badge(role, recent, career) };
  }

  /*
   * Form leaders for the latest season in the rows: players with 5+ innings/matches that season,
   * ranked by runs (batting) or wickets (bowling) in their last 10, with economy / SR as tie-break.
   */
  function leaders(data, role, rows, limit) {
    const source = rows || data.rows;
    if (!source.length) return { season: null, players: [] };
    const season = source.reduce((latest, row) => (data.matches[row[0]][0] > latest ? data.matches[row[0]][0] : latest), '');
    const seasonCounts = new Map();
    const column = role === 'bowling' ? 2 : 1;
    const seen = new Set();
    for (const row of source) {
      if (data.matches[row[0]][0] !== season) continue;
      const key = row[column] + ':' + row[0];
      if (seen.has(key)) continue;
      seen.add(key);
      seasonCounts.set(row[column], (seasonCounts.get(row[column]) || 0) + 1);
    }
    const players = [...seasonCounts].filter(([, count]) => count >= FORM_RULES.minRecent).map(([id]) => ({ id, ...form(data, id, role, source) }));
    players.sort(role === 'bowling'
      ? (a, b) => b.recent.wickets - a.recent.wickets || (a.recent.economy ?? 99) - (b.recent.economy ?? 99)
      : (a, b) => b.recent.runs - a.recent.runs || (b.recent.strikeRate ?? 0) - (a.recent.strikeRate ?? 0));
    return { season, players: players.slice(0, limit || 10) };
  }

  const api = { battingInnings, bowlingMatches, battingSummary, bowlingSummary, badge, form, leaders, FORM_RULES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSForm = api;
})(typeof window !== 'undefined' ? window : this);
