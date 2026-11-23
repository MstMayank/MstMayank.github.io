import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {score, matchPoints, pickXI, credits, profile, RULES} = require('../fantasy-core.js');

test('scoring: runs, boundaries, milestones, wickets and fielding', () => {
  const base = {runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, bowledLbw: 0, catches: 0, stumpings: 0, runOuts: 0};
  assert.equal(score({...base, runs: 52, fours: 4, sixes: 2}), 52 + 4 + 4 + 8);
  assert.equal(score({...base, wickets: 3, bowledLbw: 1}), 75 + 8 + 4);
  assert.equal(score({...base, catches: 2, stumpings: 1, runOuts: 1}), 16 + 12 + 6);
});

test('match points are rebuilt from rows and dismissals', () => {
  // [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, conceded, legal, wides, noBalls, bowlingDots, outs]
  const data = {
    matches: [['2025', 0, '2025-04-01', ['A', 'B'], 'win', 'A', '1']],
    rows: [[0, 1, 2, 0, 34, 20, 5, 3, 1, 1, 34, 20, 0, 0, 5, 1]],
    dismissals: [[0, 1, 2, 'caught', 0, [3]]],
  };
  const pts = matchPoints(data).get(0);
  assert.equal(pts.get(1).pts, 34 + 3 + 2 + 4, 'batter: runs, boundaries, 30 bonus');
  assert.equal(pts.get(2).pts, 25, 'bowler: one caught wicket');
  assert.equal(pts.get(3).pts, 8, 'fielder: one catch');
});

const player = (id: number, role: string, team: string, expected: number, cr: number) => ({id, role, team, expected, credits: cr});

test('the XI respects credits, team and role limits, and maximises expected points', () => {
  const pool = [
    player(1, 'WK', 'A', 60, 10), player(2, 'WK', 'B', 40, 9),
    ...[3, 4, 5, 6, 7].map(i => player(i, 'BAT', 'A', 50 - i, 9)),
    ...[8, 9, 10, 11].map(i => player(i, 'BAT', 'B', 40 - i, 8)),
    player(12, 'AR', 'A', 55, 10.5), player(13, 'AR', 'B', 30, 8),
    ...[14, 15, 16, 17, 18].map(i => player(i, 'BOWL', 'A', 45 - i, 9)),
    ...[19, 20, 21, 22].map(i => player(i, 'BOWL', 'B', 35 - i, 7.5)),
  ];
  const xi = pickXI(pool);
  assert.ok(xi);
  assert.equal(xi.players.length, 11);
  assert.ok(xi.credits <= RULES.credits);
  const teams: Record<string, number> = {}, roles: Record<string, number> = {};
  for (const p of xi.players) { teams[p.team] = (teams[p.team] || 0) + 1; roles[p.role] = (roles[p.role] || 0) + 1; }
  assert.ok(Object.values(teams).every(n => n <= RULES.maxPerTeam));
  for (const [role, [min, max]] of Object.entries(RULES.roles) as [string, number[]][]) assert.ok((roles[role] || 0) >= min && (roles[role] || 0) <= max, role);
  assert.equal(xi.captain, 1, 'captain is the highest expected scorer');
  assert.ok(xi.exhaustive);
});

test('impossible pools return null instead of a broken team', () => {
  assert.equal(pickXI([player(1, 'BAT', 'A', 50, 9)]), null);
});

test('credits run 7 to 10.5 in half steps by recent points', () => {
  const all = [10, 20, 30, 40, 50];
  assert.equal(credits(10, all), 7);
  assert.equal(credits(50, all), 10.5);
  assert.ok([7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5].includes(credits(30, all)));
});

test('profile: keepers are detected from stumpings, form uses the last 10 matches', () => {
  const matches = Array.from({length: 12}, (_, i) => ['2025', 0, `2025-04-${String(i + 1).padStart(2, '0')}`, ['A', 'B'], 'win', 'A', String(i)]);
  const rows = matches.map((_, m) => [m, 1, 2, 0, m < 2 ? 0 : 40, 30, 0, 0, 0, 0, 40, 30, 0, 0, 0, 0]);
  const data = {matches, rows, dismissals: [[5, 9, 2, 'stumped', 0, [1]]]};
  const p = profile(data, matchPoints(data), 1);
  assert.equal(p.role, 'WK');
  assert.equal(p.recentMatches, 10);
  assert.ok(p.form > 40);
});
