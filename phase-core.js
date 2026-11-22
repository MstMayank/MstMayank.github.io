/*
 * Phase profile maths for Player Battle (limited-overs formats only).
 *
 * Works on battle-<competition>.json rows:
 *   [match, batter, bowler, phase(0 powerplay, 1 middle, 2 death), runs, balls, dots, fours,
 *    sixes, wickets, conceded, legal, wides, noBalls, bowlingDots, outs]
 *
 * For each phase it returns the player's numbers and the average of everyone in the same rows,
 * so the page can show "+18% vs average". Role labels use the fixed rules in LABEL_RULES,
 * which the page also shows in a tooltip.
 */
(function (root) {
  'use strict';

  const PHASES = [0, 1, 2];
  const PHASE_NAMES = ['Powerplay', 'Middle overs', 'Death overs'];
  // Below these balls a phase is greyed out as a small sample; labels need LABEL_RULES.minBalls.
  const SMALL_SAMPLE = { batting: 30, bowling: 60 };
  const LABEL_RULES = {
    minBalls: 120,
    fasterBy: 0.10,      // batting: strike rate 10%+ above the phase average
    stickierBy: 0.30,    // batting: 30%+ more balls per dismissal than average...
    steadyWithin: 0.10,  // ...while scoring within 10% of the phase strike rate
    tighterBy: 0.12,     // bowling: economy 12%+ below the phase average
    strikesBy: 0.20,     // bowling: 20%+ fewer balls per wicket than average
    maxLabels: 2         // keep only the strongest labels
  };

  function empty() {
    return { balls: 0, runs: 0, dots: 0, fours: 0, sixes: 0, outs: 0, legal: 0, conceded: 0, wickets: 0, bowlingDots: 0 };
  }

  function add(totals, row) {
    totals.runs += row[4]; totals.balls += row[5]; totals.dots += row[6];
    totals.fours += row[7]; totals.sixes += row[8]; totals.wickets += row[9];
    totals.conceded += row[10]; totals.legal += row[11]; totals.bowlingDots += row[14]; totals.outs += row[15];
  }

  function ratio(numerator, denominator, multiplier) {
    return denominator ? numerator * (multiplier || 1) / denominator : null;
  }

  // Metrics, each with the direction that counts as good.
  function metrics(totals, role) {
    if (role === 'bowling') {
      return {
        sample: totals.legal,
        economy: { value: ratio(totals.conceded, totals.legal, 6), higherIsBetter: false },
        dotPct: { value: ratio(totals.bowlingDots, totals.legal, 100), higherIsBetter: true },
        ballsPerWicket: { value: ratio(totals.legal, totals.wickets), higherIsBetter: false },
        boundaryPct: { value: ratio(totals.fours + totals.sixes, totals.legal, 100), higherIsBetter: false }
      };
    }
    return {
      sample: totals.balls,
      strikeRate: { value: ratio(totals.runs, totals.balls, 100), higherIsBetter: true },
      dotPct: { value: ratio(totals.dots, totals.balls, 100), higherIsBetter: false },
      boundaryPct: { value: ratio(totals.fours + totals.sixes, totals.balls, 100), higherIsBetter: true },
      ballsPerDismissal: { value: ratio(totals.balls, totals.outs), higherIsBetter: true }
    };
  }

  // Everyone's totals per phase for these rows (the comparison baseline).
  function phaseAverages(rows, role) {
    const totals = PHASES.map(empty);
    for (const row of rows) if (totals[row[3]]) add(totals[row[3]], row);
    return totals.map(phase => metrics(phase, role));
  }

  function playerPhases(rows, playerId, role) {
    const column = role === 'bowling' ? 2 : 1;
    const totals = PHASES.map(empty);
    for (const row of rows) if (row[column] === playerId && totals[row[3]]) add(totals[row[3]], row);
    return totals.map(phase => metrics(phase, role));
  }

  // Relative difference from the average, signed so positive is always better for the player.
  function edge(player, average) {
    if (player.value === null || average.value === null || !average.value) return null;
    const diff = (player.value - average.value) / average.value;
    return player.higherIsBetter ? diff : -diff;
  }

  function labels(phases, averages, role) {
    const found = [];
    const rules = LABEL_RULES;
    phases.forEach((phase, index) => {
      if (phase.sample < rules.minBalls) return;
      const avg = averages[index];
      const where = ['Powerplay', 'Middle-overs', 'Death'][index];
      if (role === 'bowling') {
        if (edge(phase.economy, avg.economy) >= rules.tighterBy) found.push({ phase: index, strength: edge(phase.economy, avg.economy), text: where + ' specialist', why: 'Economy ' + pct(edge(phase.economy, avg.economy)) + ' better than the ' + PHASE_NAMES[index].toLowerCase() + ' average' });
        if (edge(phase.ballsPerWicket, avg.ballsPerWicket) >= rules.strikesBy) found.push({ phase: index, strength: edge(phase.ballsPerWicket, avg.ballsPerWicket), text: where + ' wicket-taker', why: 'Strikes ' + pct(edge(phase.ballsPerWicket, avg.ballsPerWicket)) + ' more often than average' });
        return;
      }
      const speed = edge(phase.strikeRate, avg.strikeRate);
      const stay = edge(phase.ballsPerDismissal, avg.ballsPerDismissal);
      if (speed >= rules.fasterBy) found.push({ phase: index, strength: speed, text: ['Powerplay enforcer', 'Middle-overs accelerator', 'Death finisher'][index], why: 'Strike rate ' + pct(speed) + ' above the ' + PHASE_NAMES[index].toLowerCase() + ' average' });
      else if (index < 2 && stay >= rules.stickierBy && speed !== null && Math.abs(speed) <= rules.steadyWithin) found.push({ phase: index, strength: stay / 2, text: where + ' anchor', why: 'Lasts ' + pct(stay) + ' longer than average at a normal strike rate' });
    });
    return found.sort((a, b) => b.strength - a.strength).slice(0, rules.maxLabels);
  }

  function pct(value) {
    return Math.round(Math.abs(value) * 100) + '%';
  }

  function profile(rows, playerId, role) {
    const averages = phaseAverages(rows, role);
    const phases = playerPhases(rows, playerId, role);
    return { phases, averages, labels: labels(phases, averages, role) };
  }

  const api = { profile, phaseAverages, playerPhases, labels, edge, PHASE_NAMES, SMALL_SAMPLE, LABEL_RULES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TCSPhases = api;
})(typeof window !== 'undefined' ? window : this);
