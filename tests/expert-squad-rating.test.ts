import assert from 'node:assert/strict';
import test from 'node:test';
import {assessSquad, buildRating} from '../browser-auction/squad-rating-data';
import {baselineSquad, createStore, players, teams} from '../browser-auction/store';
import {canUseImpactPlayer, overall, squadMembers, tierFor} from '../lib/ipl-auction/rating/expert';
import {categories, seasonWeights} from '../lib/ipl-auction/rating/expert-config';
import {references} from '../lib/ipl-auction/rating/expert-references';
import type {SessionView} from '../lib/ipl-auction/types';

test('approved exact compositions return approved weights and ratings in any order', () => {
  assert.deepEqual(Object.values(categories).map(c => c[1]), [30,30,15,10,10,5]);
  assert.deepEqual(seasonWeights, {2025:.4, 2026:.6});
  for (const [index, reference] of references.entries()) {
    const squad = reference.names.split('|').map(name => {
      const player = players.find(p => p.name === name);
      assert.ok(player, name);
      return player;
    });
    const report = assessSquad(squad);
    assert.equal(report.approvedReference, true);
    assert.equal(report.overallRating, [87.75,83.10,78.40][index]);
    assert.equal(report.overallRating, overall(report));
    assert.equal(report.tier, tierFor(report.overallRating));
    assert.strictEqual(assessSquad([...squad].reverse()), report);
    assert.equal(assessSquad(squad.slice(1)).approvedReference, false);
  }
});

test('all ten baselines provide a legal practical XI, without oversaturating ratings', () => {
  for (const team of teams) {
    const squad = baselineSquad(team.id);
    const report = assessSquad(squad);
    const xi = report.bestPlayingXI;
    assert.equal(xi.length, 11, team.id);
    assert.equal(new Set(xi.map(p => p.id)).size, 11);
    assert.ok(xi.filter(p => p.isOverseas).length <= 4);
    assert.ok(xi.some(p => p.role === 'Wicketkeeper'));
    assert.ok(report.overallRating < 95);
    assert.ok(report.ratingConfidence > 0);
    if (report.impactPlayer) assert.ok(canUseImpactPlayer(xi, report.impactPlayer));
  }
  const unfilled = assessSquad(baselineSquad('rcb').slice(0, 4));
  assert.equal(unfilled.bestPlayingXI.length, 0);
  assert.equal(unfilled.impactPlayer, null);
  assert.ok(unfilled.playingXIBalance < 70);
});

test('retention, release and purchases recalculate from current membership only', async () => {
  const cache = new Map<string,string>();
  const store = createStore({getItem: key => cache.get(key) ?? null, setItem: (key,value) => {cache.set(key,value);}});
  const session = await store.request('/api/ipl-auction/sessions', {method:'POST', body: JSON.stringify({seasonId:'ipl-2027-custom', franchiseId:'rcb'})}) as SessionView;
  assert.equal(squadMembers(session).length, 0);
  const slot = session.squad.find(p => p.eligible)!;
  session.decisions[slot.playerId] = 'RETAIN';
  const rated = buildRating(session);
  assert.equal(rated.rankings.length, 10);
  assert.equal(rated.rankings.find(row => row.current)?.score, rated.overallRating);
  assert.equal(rated.playerCount, 1);
  session.decisions[slot.playerId] = 'RELEASE';
  assert.equal(buildRating(session).playerCount, 0);
  session.ratingPurchases = [{player:slot.player,isOverseas:slot.isOverseas,priceLakh:50,salaryVerified:true}];
  assert.equal(buildRating(session).overallRating, rated.overallRating);
  session.ratingPurchases[0].priceLakh = 2400;
  assert.equal(buildRating(session).overallRating, rated.overallRating);
  session.decisions[slot.playerId] = 'RETAIN';
  assert.throws(() => buildRating(session), /Duplicate player/);
});

test('Impact restriction excludes a fifth overseas player and an existing starter', () => {
  const xi = Array.from({length:11}, (_,i) => ({id:String(i),name:String(i),role:'BATTER',isOverseas:i<4}));
  const overseas = {...xi[0],id:'reserve'};
  assert.equal(canUseImpactPlayer(xi, overseas), false);
  assert.equal(canUseImpactPlayer(xi, {...overseas,isOverseas:false}), true);
  assert.equal(canUseImpactPlayer(xi, xi[0]), false);
  assert.equal(canUseImpactPlayer(xi.map((p,i) => i===0 ? {...p,isOverseas:false} : p), overseas), true);
});
