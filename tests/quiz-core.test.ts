import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {dailyQuiz, FORMAT, shareText, rng, GENERATORS, quizLink, inviteText, challengeText, readChallenge, verdict} = require('../quiz-core.js');
const leagues = ['ipl', 'wpl'].map(l => ({label: l.toUpperCase(), venues: require(`../venue-stats-${l}.json`), impact: require(`../impact-${l}.json`),
  teams: require(`../team-stats-${l}.json`), matches: require(`../match-index-${l}.json`)}));
const day = (i: number) => new Date(Date.UTC(2026, 10, 23 + i)).toISOString().slice(0, 10);

test('every day has five distinct questions with distinct options and a valid answer', () => {
  for (const data of leagues) for (let i = 0; i < 90; i++) {
    const qs = dailyQuiz(data, day(i));
    assert.equal(qs.length, 5, data.label + ' ' + day(i));
    assert.equal(new Set(qs.map((q: {question: string}) => q.question)).size, 5);
    for (const q of qs) {
      assert.ok([2, 4].includes(q.options.length), q.kind);
      assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(q.answer >= 0 && q.answer < q.options.length);
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
  assert.equal(quizLink('ipl', '2026-11-23'), 'https://thecricketspace.in/quiz.html');
  assert.equal(quizLink('wpl', '2026-11-23'), 'https://thecricketspace.in/quiz.html?league=wpl');
  assert.equal(quizLink('wpl', '2026-11-23', 3), 'https://thecricketspace.in/quiz.html?league=wpl&beat=3&d=2026-11-23');
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

test('from 24 November each day mixes five different question formats', () => {
  for (const data of leagues) for (let i = 1; i < 60; i++) {
    const qs = dailyQuiz(data, day(i));
    assert.equal(new Set(qs.map((q: {format: string}) => q.format)).size, 5, data.label + ' ' + day(i));
  }
  assert.ok(new Set(Object.values(FORMAT)).size >= 6);
  // 23 November (already played) keeps the original question types.
  for (const q of dailyQuiz(leagues[0], '2026-11-23')) assert.ok(['player', 'ground'].includes(q.format));
});

test('new question types are checked against the data', () => {
  for (const data of leagues) for (let i = 0; i < 300; i++) for (const q of dailyQuiz(data, 'practice-' + i)) {
    const ans = q.options[q.answer];
    if (q.kind === 'wicketsCount') {
      const name = /has (.+) taken/.exec(q.question)![1];
      assert.equal(String(data.impact.all[name].bowling.wickets), ans);
    }
    if (q.kind === 'headToHead') {
      const [, a, b] = /between (.+) and (.+)\?/.exec(q.question)!;
      const wins = (t: string) => data.matches.matches.filter((m: string[]) => m[6] === 'win' && m[5] === t && [m[3], m[4]].includes(a) && [m[3], m[4]].includes(b)).length;
      assert.ok(wins(ans) > wins(ans === a ? b : a));
    }
    if (q.kind === 'groundHighestTotal') {
      const v = data.venues.venues.find((x: {name: string}) => q.question.endsWith(' at ' + x.name.split(',')[0] + '?'));
      assert.equal(v.all.highest[0].team, ans);
    }
    if (q.kind === 'seasonTopTeam') {
      const season = data.teams.latestSeason;
      const won = (t: string) => data.teams.teams[t].seasons[season].won;
      for (const o of q.options) if (o !== ans) assert.ok(won(ans) > won(o));
    }
    if (q.kind === 'chaseTrueFalse') {
      const v = data.venues.venues.find((x: {name: string}) => q.question.includes(' at ' + x.name.split(',')[0] + ','));
      assert.equal(ans, v.all.results.chaseWins > v.all.results.defendWins ? 'True' : 'False');
    }
  }
});
