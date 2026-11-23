import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {milestones, careers} = require('../milestones-core.js');

// [category, name, team, opponent, value, extra, date, gender, series, season, playerId]
const bat = (id: string, runs: number, date: string, gender = 'male', name = id) => ['Batting', name, 'India', 'Australia', runs, 0, date, gender, '', '', id];
const bowl = (id: string, wkts: number, date: string) => ['Bowling', id, 'India', 'Australia', wkts, 30, date, 'male', '', '', id];

test('careers merge rows by player id and keep the latest name and team', () => {
  const rows = [bat('k1', 50, '2020-01-01', 'male', 'V Kohli'), bat('k1', 70, '2024-01-01', 'male', 'Virat Kohli')];
  const [c] = careers(rows);
  assert.equal(c.total, 120);
  assert.equal(c.name, 'Virat Kohli');
  assert.equal(c.innings, 2);
});

test('active players close to the next round number are listed, closest and biggest first', () => {
  const rows = [
    ...Array.from({length: 30}, (_, i) => bat('big', 499, `2024-0${1 + (i % 9)}-1${i % 9}`)),           // 14,970 → 15,000
    ...Array.from({length: 10}, (_, i) => bat('small', 98, `2025-0${1 + (i % 9)}-0${1 + (i % 9)}`)),    // 980 → 1,000
    ...Array.from({length: 10}, (_, i) => bat('far', 50, `2025-0${1 + (i % 9)}-0${1 + (i % 9)}`)),      // 500: too far
    bat('big', 0, '2026-05-01'),
  ];
  const result = milestones(rows, {format: 'ODI', latest: '2026-06-01'});
  assert.deepEqual(result.near.map((m: {id: string}) => m.id), ['big', 'small']);
  assert.equal(result.near[0].next, 15000);
  assert.equal(result.near[0].need, 30);
});

test('players not seen for 18 months are not "active"', () => {
  const rows = [bat('old', 990, '2023-01-01'), bat('x', 1, '2026-06-01')];
  assert.equal(milestones(rows, {format: 'ODI'}).near.length, 0);
});

test('players who debuted before the archive (plus a year) are left out of Tests and ODIs', () => {
  const rows = [bat('early', 980, '2002-03-01'), bat('early', 0, '2026-05-01'), bat('late', 980, '2004-03-01'), bat('late', 0, '2026-05-01')];
  const ids = milestones(rows, {format: 'Test', archiveStart: '2001-12-01'}).near.map((m: {id: string}) => m.id);
  assert.deepEqual(ids, ['late']);
  assert.equal(milestones(rows, {format: 'T20I', archiveStart: null}).near.length, 2, 'T20Is are archived from the start');
});

test('milestones reached in the last 30 days, with the date they were crossed', () => {
  const rows = [bowl('b', 48, '2026-01-01'), bowl('b', 3, '2026-05-20'), bowl('c', 40, '2026-01-01'), bowl('c', 12, '2026-03-01')];
  const result = milestones(rows, {format: 'Test', latest: '2026-06-01'});
  assert.equal(result.reached.length, 1);
  assert.deepEqual([result.reached[0].id, result.reached[0].milestone, result.reached[0].date], ['b', 50, '2026-05-20']);
});

test('wicket milestones use steps of 50 within 10 wickets', () => {
  const rows = [bowl('w', 142, '2026-01-01'), bowl('v', 130, '2026-01-01')];
  const near = milestones(rows, {format: 'ODI', latest: '2026-02-01'}).near;
  assert.deepEqual(near.map((m: {id: string; next: number}) => [m.id, m.next]), [['w', 150]]);
});
