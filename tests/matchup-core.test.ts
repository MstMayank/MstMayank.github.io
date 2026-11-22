import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {aggregate, rankMatchups} = require('../matchup-core.js');

// [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets]
const row = (batter: number, bowler: number, runs: number, balls: number, wickets = 0, dots = 0, fours = 0, sixes = 0) =>
  [0, batter, bowler, 0, runs, balls, dots, fours, sixes, wickets, 0, 0, 0, 0, 0, 0];

test('aggregate sums every row for the player against each opponent, from the batter side', () => {
  const rows = [row(1, 10, 20, 10, 1, 3, 2, 1), row(1, 10, 5, 5), row(1, 11, 30, 12), row(2, 10, 99, 9)];
  const batting = aggregate(rows, 1, 'batting');
  assert.deepEqual(batting.total, {balls: 27, runs: 55, dots: 3, fours: 2, sixes: 1, wickets: 1});
  assert.deepEqual(batting.byOpponent.get(10), {balls: 15, runs: 25, dots: 3, fours: 2, sixes: 1, wickets: 1});
  const bowling = aggregate(rows, 10, 'bowling');
  assert.equal(bowling.byOpponent.get(2)!.runs, 99);
  assert.equal(bowling.total.balls, 24);
});

test('bowlers who dismiss the batter cheaply rank as trouble, those he scores freely against rank last', () => {
  const rows = [
    row(1, 10, 30, 40, 4),   // slow and out often: trouble
    row(1, 11, 80, 40, 0),   // fast and never out: dominated
    row(1, 12, 50, 40, 1),   // close to his normal record
  ];
  const result = rankMatchups(rows, 1, 'batting', {minBalls: 30});
  assert.deepEqual(result.opponents.map((o: {id: number}) => o.id), [10, 12, 11]);
  assert.ok(result.opponents[0].score > 0);
  assert.ok(result.opponents[2].score < 0);
  assert.equal(result.baseline.balls, 120);
  assert.equal(result.opponents[0].strikeRate, 75);
  assert.equal(result.opponents[0].ballsPerWicket, 10);
});

test('the minimum-balls filter drops tiny samples', () => {
  const rows = [row(1, 10, 0, 6, 2), row(1, 11, 40, 40, 1)];
  const result = rankMatchups(rows, 1, 'batting', {minBalls: 30});
  assert.deepEqual(result.opponents.map((o: {id: number}) => o.id), [11]);
});

test('small samples are pulled toward the player average, so 2 wickets in 6 balls cannot beat a long, consistent record', () => {
  const rows = [
    row(1, 10, 0, 6, 2),          // tiny, extreme sample
    row(1, 11, 60, 100, 8),       // long, clearly troublesome record
    ...Array.from({length: 20}, (_, i) => row(1, 100 + i, 40, 30, 1)), // his normal record
  ];
  const result = rankMatchups(rows, 1, 'batting', {minBalls: 1});
  assert.equal(result.opponents[0].id, 11);
});

test('a batter never dismissed in the selection still gets finite scores', () => {
  const rows = [row(1, 10, 50, 40), row(1, 11, 30, 40)];
  const result = rankMatchups(rows, 1, 'batting', {minBalls: 30});
  for (const opponent of result.opponents) assert.ok(Number.isFinite(opponent.score));
  assert.equal(result.opponents[0].id, 11);
  assert.equal(result.opponents[0].ballsPerWicket, null);
});

test('bowling view ranks the batters the bowler troubles most first', () => {
  const rows = [row(5, 10, 20, 40, 4), row(6, 10, 70, 40, 0), ...Array.from({length: 10}, (_, i) => row(200 + i, 10, 45, 40, 1))];
  const result = rankMatchups(rows, 10, 'bowling', {minBalls: 30});
  assert.equal(result.opponents[0].id, 5);
  assert.equal(result.opponents.at(-1).id, 6);
});

test('no balls in the selection returns null', () => {
  assert.equal(rankMatchups([row(2, 10, 5, 5)], 1, 'batting'), null);
});
