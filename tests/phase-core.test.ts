import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {profile, phaseAverages, edge} = require('../phase-core.js');

// [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, conceded, legal, wides, noBalls, bowlingDots, outs]
const row = (batter: number, bowler: number, phase: number, runs: number, balls: number,
  {dots = 0, fours = 0, sixes = 0, wickets = 0, outs = wickets} = {}) =>
  [0, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, runs, balls, 0, 0, dots, outs];

// A field of ordinary players: SR 125, out every 25 balls, economy 7.5 in every phase.
const field = [0, 1, 2].flatMap(phase => Array.from({length: 20}, (_, i) => row(100 + i, 200 + i, phase, 250, 200, {dots: 70, fours: 20, sixes: 5, wickets: 8})));

test('averages are computed per phase from every row', () => {
  const averages = phaseAverages(field, 'batting');
  assert.equal(averages[0].strikeRate.value, 125);
  assert.equal(averages[2].ballsPerDismissal.value, 25);
  const bowling = phaseAverages(field, 'bowling');
  assert.equal(bowling[1].economy.value, 7.5);
});

test('only the two strongest labels are kept, strongest first', () => {
  const rows = [...field, ...[0, 1, 2].map(phase => row(150, 1, phase, [200, 170, 140][phase], 200, {wickets: 8}))];
  const texts = profile(rows, 1, 'bowling').labels.map((l: {text: string}) => l.text);
  assert.deepEqual(texts, ['Death specialist', 'Middle-overs specialist']);
});

test('a batter scoring much faster at the death is labelled a death finisher', () => {
  const rows = [...field, row(1, 200, 2, 330, 200, {fours: 20, sixes: 20, outs: 8}), row(1, 200, 0, 250, 200, {outs: 8})];
  const result = profile(rows, 1, 'batting');
  assert.deepEqual(result.labels.map((l: {text: string}) => l.text), ['Death finisher']);
  assert.ok(result.labels[0].why.includes('above the death overs average'));
});

test('a bowler much tighter at the death is labelled a death specialist', () => {
  const rows = [...field, row(150, 1, 2, 150, 200, {dots: 90, wickets: 12})];
  const result = profile(rows, 1, 'bowling');
  const texts = result.labels.map((l: {text: string}) => l.text);
  assert.ok(texts.includes('Death specialist'));
  assert.ok(texts.includes('Death wicket-taker'));
});

test('no label from a small sample, however extreme', () => {
  const rows = [...field, row(1, 200, 2, 300, 100)];
  assert.deepEqual(profile(rows, 1, 'batting').labels, []);
});

test('an anchor needs to last longer at a normal strike rate, and never applies at the death', () => {
  const rows = [...field, row(1, 200, 1, 250, 200, {outs: 4}), row(1, 200, 2, 250, 200, {outs: 4})];
  assert.deepEqual(profile(rows, 1, 'batting').labels.map((l: {text: string}) => l.text), ['Middle-overs anchor']);
});

test('edge is signed so positive is always better for the player', () => {
  assert.ok(edge({value: 6, higherIsBetter: false}, {value: 7.5}) > 0);
  assert.ok(edge({value: 150, higherIsBetter: true}, {value: 125}) > 0);
  assert.equal(edge({value: null, higherIsBetter: true}, {value: 125}), null);
});

test('a phase the player never played has empty values, not errors', () => {
  const result = profile([...field, row(1, 200, 0, 30, 20)], 1, 'batting');
  assert.equal(result.phases[2].sample, 0);
  assert.equal(result.phases[2].strikeRate.value, null);
});
