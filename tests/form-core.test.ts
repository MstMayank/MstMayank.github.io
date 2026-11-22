import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {battingInnings, bowlingMatches, form, leaders, badge} = require('../form-core.js');

// [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, conceded, legal, wides, noBalls, bowlingDots, outs]
const row = (match: number, batter: number, bowler: number, runs: number, balls: number, wickets = 0, phase = 0) =>
  [match, batter, bowler, phase, runs, balls, 0, 0, 0, wickets, runs, balls, 0, 0, 0, wickets];
const matches = Array.from({length: 30}, (_, i) => ['2025', 0, `2025-04-${String(i + 1).padStart(2, '0')}`, ['A', 'B'], 'win', 'A', String(i)]);
matches[0][0] = '2024';

test('innings are grouped per match across phases and bowlers, newest first', () => {
  const rows = [row(1, 7, 20, 10, 8), row(1, 7, 21, 15, 9, 0, 2), row(3, 7, 20, 40, 25)];
  const list = battingInnings(rows, [[1, 7, 21, 'caught', 2, [5]]], matches, 7);
  assert.deepEqual(list.map((e: {match: number}) => e.match), [3, 1]);
  assert.deepEqual([list[1].runs, list[1].balls, list[1].out, list[1].how], [25, 17, true, 'caught']);
  assert.equal(list[0].out, false, 'no dismissal means not out');
});

test('a batter run out without facing still gets a 0 (0) innings', () => {
  const list = battingInnings([], [[4, 7, 20, 'run out', 1, [9]]], matches, 7);
  assert.deepEqual([list[0].runs, list[0].balls, list[0].out, list[0].how], [0, 0, true, 'run out']);
});

test('dismissals from matches outside the given rows are ignored (one format at a time)', () => {
  const rows = [row(10, 7, 20, 30, 20), row(12, 99, 20, 5, 5)];
  const result = form({rows: [...rows, row(11, 7, 20, 50, 30)], dismissals: [[11, 7, 20, 'bowled', 0, []], [10, 7, 20, 'caught', 0, [3]]], matches}, 7, 'batting', rows);
  assert.deepEqual(result.list.map((e: {match: number}) => e.match), [10]);
});

test('bowling figures add up per match and skip matches without a legal ball', () => {
  const rows = [row(2, 1, 9, 12, 12, 1), row(2, 3, 9, 6, 6, 1), row(5, 1, 9, 0, 0)];
  const list = bowlingMatches(rows, matches, 9);
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].wickets, list[0].conceded, list[0].legal], [2, 18, 18]);
});

test('only the last 10 innings count as recent, and a big jump is "In form"', () => {
  const rows = [
    ...Array.from({length: 15}, (_, i) => row(i, 7, 20, 15, 12)),        // older: 15 per innings
    ...Array.from({length: 10}, (_, i) => row(15 + i, 7, 20, 45, 30)),   // last 10: 45 per innings
  ];
  const result = form({rows, dismissals: [], matches}, 7, 'batting');
  assert.equal(result.list.length, 10);
  assert.equal(result.recent.runs, 450);
  assert.equal(result.badge.label, 'In form');
});

test('a slump is "Out of form", and few recent innings give no badge', () => {
  const slump = [...Array.from({length: 15}, (_, i) => row(i, 7, 20, 40, 30)), ...Array.from({length: 10}, (_, i) => row(15 + i, 7, 20, 10, 12))];
  assert.equal(form({rows: slump, dismissals: [], matches}, 7, 'batting').badge.label, 'Out of form');
  const few = Array.from({length: 4}, (_, i) => row(i, 7, 20, 40, 30));
  assert.equal(form({rows: few, dismissals: [], matches}, 7, 'batting').badge.label, 'Not enough matches');
});

test('bowling badge: more wickets at a similar economy is in form, leaking runs is out of form', () => {
  const career = {matches: 30, perMatch: 1, economy: 8};
  assert.equal(badge('bowling', {matches: 10, perMatch: 1.6, economy: 8.2}, career).label, 'In form');
  assert.equal(badge('bowling', {matches: 10, perMatch: 1.0, economy: 9.6}, career).label, 'Out of form');
  assert.equal(badge('bowling', {matches: 10, perMatch: 1.0, economy: 8.1}, career).label, 'Steady');
});

test('leaders only include players active in the latest season, ranked by recent runs', () => {
  const rows = [
    row(0, 1, 20, 300, 200),                                            // only the 2024 season
    ...Array.from({length: 6}, (_, i) => row(1 + i, 2, 20, 30, 20)),    // 180 recent runs
    ...Array.from({length: 6}, (_, i) => row(1 + i, 3, 20, 50, 30)),    // 300 recent runs
    ...Array.from({length: 3}, (_, i) => row(1 + i, 4, 20, 90, 40)),    // too few innings
  ];
  const result = leaders({rows, dismissals: [], matches}, 'batting');
  assert.equal(result.season, '2025');
  assert.deepEqual(result.players.map((p: {id: number}) => p.id), [3, 2]);
});
