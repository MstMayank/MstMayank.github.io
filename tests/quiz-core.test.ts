import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {dailyQuiz, shareText, rng, GENERATORS, quizLink, inviteText, challengeText, readChallenge, verdict} = require('../quiz-core.js');
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

test('share links keep the league and carry the score only for a challenge', () => {
  assert.equal(quizLink('ipl', '2026-11-23'), 'https://mstmayank.github.io/quiz.html');
  assert.equal(quizLink('wpl', '2026-11-23'), 'https://mstmayank.github.io/quiz.html?league=wpl');
  assert.equal(quizLink('wpl', '2026-11-23', 3), 'https://mstmayank.github.io/quiz.html?league=wpl&beat=3&d=2026-11-23');
  assert.match(inviteText('ipl', '2026-11-23'), /today’s IPL quiz[\s\S]*quiz\.html$/);
  const text = challengeText('ipl', '2026-11-23', [true, false, true, true, false]);
  assert.match(text, /^I got 3\/5 on today’s IPL quiz/);
  assert.ok(text.endsWith('quiz.html?beat=3&d=2026-11-23'));
});

test('a challenge counts only on the same day and with a valid score', () => {
  assert.deepEqual(readChallenge('?beat=3&d=2026-11-23', '2026-11-23', 5), {score: 3});
  assert.equal(readChallenge('?beat=3&d=2026-11-22', '2026-11-23', 5), null);
  assert.equal(readChallenge('?beat=9&d=2026-11-23', '2026-11-23', 5), null);
  assert.equal(readChallenge('?beat=x&d=2026-11-23', '2026-11-23', 5), null);
  assert.equal(readChallenge('', '2026-11-23', 5), null);
  assert.match(verdict(4, 3), /beat/);
  assert.match(verdict(3, 3), /Level/);
  assert.match(verdict(2, 3), /rematch/);
});
