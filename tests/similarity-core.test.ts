import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {build, similar, cosine} = require('../similarity-core.js');

// [match, batter, bowler, phase, runs, balls, dots, fours, sixes, wickets, conceded, legal, wides, noBalls, bowlingDots, outs]
const bat = (batter: number, phase: number, runs: number, balls: number, dots: number, fours: number, sixes: number, outs: number) =>
  [0, batter, 99, phase, runs, balls, dots, fours, sixes, outs, runs, balls, 0, 0, dots, outs];

// Three styles, two players each: hitters, anchors, and a middle group.
const styles: Record<number, number[][]> = {
  1: [[150, 100, 35, 10, 8, 4], [140, 100, 38, 9, 8, 5], [190, 100, 30, 8, 12, 6]],
  2: [[148, 100, 36, 11, 7, 4], [142, 100, 37, 9, 9, 5], [185, 100, 31, 8, 11, 6]],
  3: [[110, 100, 45, 12, 1, 1], [115, 100, 40, 10, 1, 1], [120, 100, 42, 9, 2, 2]],
  4: [[112, 100, 44, 12, 1, 1], [118, 100, 41, 10, 2, 1], [125, 100, 40, 9, 2, 2]],
  5: [[130, 100, 40, 11, 4, 2], [128, 100, 39, 9, 4, 3], [150, 100, 36, 9, 6, 4]],
  6: [[132, 100, 41, 11, 4, 2], [126, 100, 40, 9, 5, 3], [155, 100, 35, 9, 6, 4]],
};
const rows = Object.entries(styles).flatMap(([id, phases]) => phases.map((v, phase) => bat(+id, phase, v[0], v[1], v[2], v[3], v[4], v[5])));

test('players with the same style are each other’s closest match', () => {
  const model = build(rows, 'batting', {minBalls: 200});
  assert.equal(model.ids.length, 6);
  assert.equal(similar(model, 1, 1)[0].id, 2);
  assert.equal(similar(model, 3, 1)[0].id, 4);
  assert.equal(similar(model, 5, 1)[0].id, 6);
});

test('results give a 0-100 match, a reason in cricket words, and skip the player himself', () => {
  const model = build(rows, 'batting', {minBalls: 200});
  const list = similar(model, 1, 5);
  assert.equal(list.length, 5);
  assert.ok(list.every((item: {id: number}) => item.id !== 1));
  assert.ok(list[0].match > list.at(-1).match && list[0].match <= 100 && list.at(-1).match >= 0);
  assert.ok(list[0].reasons.length >= 1);
  assert.ok(list[0].reasons.every((r: string) => /[a-z]/.test(r) && !r.includes('undefined')));
});

test('players under the ball minimum are left out, and unknown players return null', () => {
  const model = build([...rows, bat(7, 0, 50, 30, 10, 5, 2, 1)], 'batting', {minBalls: 200});
  assert.ok(!model.ids.includes(7));
  assert.equal(similar(model, 7, 3), null);
});

test('cosine similarity', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
});

test('phases can be switched off (Tests keep the innings number in that column)', () => {
  const model = build(rows, 'batting', {minBalls: 200, phased: false});
  assert.deepEqual(model.used.slice(0, 3), [false, false, false]);
  assert.ok(model.raw.every((v: (number | null)[]) => v[0] === null && v[2] === null));
});
