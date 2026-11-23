import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {dailyQuiz, shareText, rng, GENERATORS} = require('../quiz-core.js');
const leagues = ['ipl', 'wpl'].map(l => ({label: l.toUpperCase(), venues: require(`../venue-stats-${l}.json`), impact: require(`../impact-${l}.json`)}));
const day = (i: number) => new Date(Date.UTC(2026, 10, 23 + i)).toISOString().slice(0, 10);

test('every day has five distinct questions with four distinct options and a valid answer', () => {
  for (const data of leagues) for (let i = 0; i < 45; i++) {
    const qs = dailyQuiz(data, day(i));
    assert.equal(qs.length, 5, data.label + ' ' + day(i));
    assert.equal(new Set(qs.map((q: {question: string}) => q.question)).size, 5);
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.ok(q.explain.includes(q.options[q.answer]), 'explanation names the answer');
    }
  }
});

test('answers are checked against the data', () => {
  const [ipl] = leagues;
  for (let i = 0; i < 40; i++) for (const q of dailyQuiz(ipl, day(i))) {
    if (q.kind === 'winningKnocks') {
      const best = Math.max(...q.options.map((n: string) => ipl.impact.all[n].batting.winningKnocks));
      assert.equal(ipl.impact.all[q.options[q.answer]].batting.winningKnocks, best);
    }
    if (q.kind === 'deathEconomy') {
      const low = Math.min(...q.options.map((n: string) => ipl.impact.all[n].bowling.pressure.economy));
      assert.equal(ipl.impact.all[q.options[q.answer]].bowling.pressure.economy, low);
    }
    if (q.kind === 'venueRuns') {
      const venue = ipl.venues.venues.find((v: {name: string}) => q.question.includes(v.name.split(',')[0]));
      assert.equal(venue.all.topBatters[0].name, q.options[q.answer]);
    }
  }
});

test('the same date gives the same quiz; different dates differ', () => {
  const [ipl] = leagues;
  assert.deepEqual(dailyQuiz(ipl, '2026-11-23'), dailyQuiz(ipl, '2026-11-23'));
  assert.notDeepEqual(dailyQuiz(ipl, '2026-11-23'), dailyQuiz(ipl, '2026-11-24'));
  const r1 = rng('x'), r2 = rng('x');
  assert.equal(r1(), r2());
});

test('share text', () => {
  assert.equal(shareText('2026-11-23', [true, false, true, true, true], 'IPL'), 'The Cricket Space IPL quiz · 2026-11-23 · 4/5 🏏⬜🏏🏏🏏');
  assert.ok(Object.keys(GENERATORS).length >= 5);
});
