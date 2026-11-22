/*
 * Match-up finder maths for Player Battle.
 *
 * Works on battle-<competition>.json rows:
 *   [matchIdx, batterIdx, bowlerIdx, phase, runs, balls, dots, fours, sixes, wickets, ...]
 * Every pair is measured from the batter's side (runs and balls he faced, wickets the bowler
 * took), so the same pair gives the same numbers whichever player you start from.
 *
 * Ranking: each opponent is compared with the selected player's own record against everyone
 * (same filters). Small samples are pulled toward that record by adding PRIOR_BALLS
 * "average" balls (a Bayesian average), so 6 balls and 2 wickets cannot top the list.
 */
(function (root) {
  'use strict';

  const COL = { batter: 1, bowler: 2, runs: 4, balls: 5, dots: 6, fours: 7, sixes: 8, wickets: 9 };
  const PRIOR_BALLS = 60;

  function emptyPair() {
    return { balls: 0, runs: 0, dots: 0, fours: 0, sixes: 0, wickets: 0 };
  }

  // role: 'batting' (playerId is the batter) or 'bowling' (playerId is the bowler).
  function aggregate(rows, playerId, role) {
    const self = role === 'bowling' ? COL.bowler : COL.batter;
    const other = role === 'bowling' ? COL.batter : COL.bowler;
    const total = emptyPair();
    const byOpponent = new Map();
    for (const row of rows) {
      if (row[self] !== playerId) continue;
      let pair = byOpponent.get(row[other]);
      if (!pair) byOpponent.set(row[other], pair = emptyPair());
      for (const key of ['balls', 'runs', 'dots', 'fours', 'sixes', 'wickets']) {
        pair[key] += row[COL[key]];
        total[key] += row[COL[key]];
      }
    }
    return { total, byOpponent };
  }

  function rate(numerator, denominator, multiplier) {
    return denominator ? numerator * (multiplier || 1) / denominator : null;
  }

  /*
   * Returns { baseline, opponents } or null when the player has no balls in the selection.
   * opponents are sorted by score, highest first. score > 0 means the opponent comes out on top
   * in this match-up compared with the player's normal record:
   *   batting view: positive = the bowler troubles the batter.
   *   bowling view: positive = the bowler troubles this batter (a "bunny").
   * score = (shrunk dismissal rate / baseline - 1) * 0.5 + (1 - shrunk SR / baseline SR)
   * Dismissals get half weight because they are rarer and noisier than runs.
   */
  function rankMatchups(rows, playerId, role, options) {
    const minBalls = options && options.minBalls != null ? options.minBalls : 30;
    const prior = options && options.priorBalls != null ? options.priorBalls : PRIOR_BALLS;
    const { total, byOpponent } = aggregate(rows, playerId, role);
    if (!total.balls) return null;
    const baseSR = total.runs / total.balls;
    // Half a wicket keeps the baseline above zero for players never dismissed in the selection.
    const baseOut = Math.max(total.wickets, 0.5) / total.balls;
    const opponents = [];
    for (const [id, pair] of byOpponent) {
      if (pair.balls < minBalls) continue;
      const shrunkSR = (pair.runs + prior * baseSR) / (pair.balls + prior);
      const shrunkOut = (pair.wickets + prior * baseOut) / (pair.balls + prior);
      const score = (shrunkOut / baseOut - 1) * 0.5 + (1 - (baseSR ? shrunkSR / baseSR : 1));
      opponents.push({
        id,
        ...pair,
        strikeRate: rate(pair.runs, pair.balls, 100),
        dotPct: rate(pair.dots, pair.balls, 100),
        boundaryPct: rate(pair.fours + pair.sixes, pair.balls, 100),
        ballsPerWicket: rate(pair.balls, pair.wickets),
        score
      });
    }
    opponents.sort((a, b) => b.score - a.score || b.balls - a.balls || a.id - b.id);
    return {
      baseline: {
        ...total,
        strikeRate: rate(total.runs, total.balls, 100),
        dotPct: rate(total.dots, total.balls, 100),
        boundaryPct: rate(total.fours + total.sixes, total.balls, 100),
        ballsPerWicket: rate(total.balls, total.wickets),
        opponents: byOpponent.size
      },
      opponents
    };
  }

  const api = { aggregate, rankMatchups, PRIOR_BALLS, COL };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSMatchups = api;
})(typeof window !== 'undefined' ? window : this);
