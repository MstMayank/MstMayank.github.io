import {anchors, categories, EXPERT_VERSION, expertProfiles, seasonWeights, type Category, type Scores} from './expert-config';
import {references} from './expert-references';
import {selectLegalXI, type Candidate} from './xi';
import type {Counts, IPLRecord, Phase, PlayerMetadata, PlayerRating, RatingDataset} from './types';
import type {SessionView} from '../types';

export type Member = {id: string; name: string; role: string; isOverseas: boolean};
const phases: Phase[] = ['POWERPLAY', 'MIDDLE', 'DEATH'];
const phaseLabels = ['Powerplay', 'Middle overs', 'Death overs'];
const keys = Object.keys(categories) as Category[];
const prior = anchors.limitedEvidencePrior;
const mean = (values: number[]) => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : prior;
const round = (n: number) => Math.round(n * 100) / 100;
export const overall = (scores: Scores) => round(keys.reduce((sum, key) => sum + scores[key] * categories[key][1], 0) / 100);
export const tierFor = (n: number) => n >= 90 ? 'S' : n >= 85 ? 'A+' : n >= 80 ? 'A' : n >= 75 ? 'B+' : n >= 70 ? 'B' : n >= 60 ? 'C' : 'D';
const rosterKey = (ids: string[]) => JSON.stringify([...ids].sort());
const namesKey = (name: string) => name.trim().toLowerCase();
const estimate = (value: number, thresholds: readonly number[]) => {
  const direction = thresholds[0] < thresholds[1] ? 1 : -1;
  const index = thresholds.findIndex(threshold => value * direction <= threshold * direction);
  if (index < 0) return anchors.scores[4];
  if (!index) return Math.max(40, anchors.scores[0] + 15 * (value - thresholds[0]) * direction / Math.abs(thresholds[1] - thresholds[0]));
  const progress = (value - thresholds[index - 1]) / (thresholds[index] - thresholds[index - 1]);
  return anchors.scores[index - 1] + progress * (anchors.scores[index] - anchors.scores[index - 1]);
};
const adjust = (score: number, sample: number, threshold: number) => prior + (score - prior) * sample / (sample + threshold);
const support = (sample: number, threshold: number) => Math.min(1, sample / threshold);
const blend = (records: IPLRecord[], measure: (record: IPLRecord) => number | null) => {
  let score = 0, weight = 0;
  for (const record of records) {
    const value = measure(record);
    if (value === null) continue;
    const importance = seasonWeights[record.year as keyof typeof seasonWeights];
    score += value * importance;
    weight += importance;
  }
  return weight ? score / weight : null;
};

function batting(count: Counts, finisher: boolean, phase?: number) {
  if (!count.balls) return null;
  const rate = estimate(100 * count.runs / count.balls, phase === undefined ? finisher ? anchors.finishRate : anchors.batRate : anchors.phaseBat[phase]);
  // No dismissals is a censored sample, so use strike rate alone in that sample.
  const average = count.outs ? estimate(count.runs / count.outs, finisher ? anchors.finishAverage : anchors.batAverage) : null;
  const consistency = count.innings ? adjust(55 + 45 * count.contributions / count.innings, count.innings, anchors.sample.consistency) : prior;
  const quality = phase !== undefined ? rate : (average === null ? rate : rate * .55 + average * .45) * .9 + consistency * .1;
  return adjust(quality, count.balls, phase === undefined ? anchors.sample.battingScore : anchors.sample.phase);
}
function bowling(count: Counts, phase?: number) {
  if (!count.legalBalls) return null;
  const control = estimate(6 * count.conceded / count.legalBalls, phase === undefined ? anchors.economy : anchors.phaseEconomy[phase]);
  const strike = count.wickets ? estimate(count.legalBalls / count.wickets, anchors.wicketRate) : 40;
  return adjust(.55 * control + .45 * strike, count.legalBalls, phase === undefined ? anchors.sample.bowling : anchors.sample.phase);
}

function profile(member: Member, records: IPLRecord[], metadata?: PlayerMetadata) {
  const review = expertProfiles.find(item => item.playerId === member.id);
  const position = [0, 0, 0];
  let balls = 0, deliveries = 0;
  for (const record of records) {
    balls += record.totals.balls;
    deliveries += record.totals.legalBalls;
    for (const [slot, count] of Object.entries(record.battingPositions)) {
      position[Number(slot) <= 2 ? 0 : Number(slot) <= 5 ? 1 : 2] += count * seasonWeights[record.year as keyof typeof seasonWeights];
    }
  }
  const role = metadata?.playingRole ?? member.role;
  const keeper = role === 'WICKETKEEPER' || member.role === 'WICKETKEEPER';
  const batRole = review?.batRole ?? (position[0] > position[1] && position[0] >= position[2] ? 'OPENER' : position[2] > position[1] ? 'FINISHER' : 'MIDDLE');
  const battingOption = keeper || role !== 'BOWLER' || balls >= 180 && position[0] + position[1] > position[2];
  const bowlingOption = deliveries >= 36 || role === 'BOWLER';
  const allRounder = battingOption && bowlingOption && balls >= 80 && deliveries >= 60;
  const bat = battingOption ? blend(records, r => {
    const base = batting(r.totals, batRole === 'FINISHER');
    if (base === null) return null;
    const pace = r.battingAgainst?.PACE, spin = r.battingAgainst?.SPIN;
    if (!pace || !spin || pace.balls < 24 || spin.balls < 24) return base;
    const thresholds = batRole === 'FINISHER' ? anchors.finishRate : anchors.batRate;
    const matchupFloor = Math.min(...[pace, spin].map(split =>
      adjust(estimate(100 * split.runs / split.balls, thresholds), split.balls, anchors.sample.phase)));
    return .9 * base + .1 * matchupFloor;
  }) : null;
  const bowl = bowlingOption ? blend(records, r => bowling(r.totals)) : null;
  const phase = Object.fromEntries(phases.map((p, i) => [p, {
    batting: battingOption ? blend(records, r => batting(r.phases[p], batRole === 'FINISHER', i)) : null,
    bowling: bowlingOption ? blend(records, r => bowling(r.phases[p], i)) : null,
    confidence: 0,
  }])) as PlayerRating['phase'];
  const confidence = blend(records, r => Math.max(support(r.totals.balls, anchors.sample.batting), support(r.totals.legalBalls, anchors.sample.bowling))) ?? 0;
  const coverage = records.reduce((sum, r) => sum + seasonWeights[r.year as keyof typeof seasonWeights], 0);
  const rating: PlayerRating = {
    id: member.id, name: member.name, metadataSource: metadata?.metadataSource ?? null, metadataStatus: metadata?.metadataStatus ?? 'UNAVAILABLE',
    batRole, style: metadata?.bowlingStyle ?? 'UNKNOWN', keeper, battingOption, bowlingOption, allRounder,
    batting: bat, bowling: bowl, form: null, experience: null, phase, roles: {}, confidence: confidence * coverage * 100,
    seasonCoverage: coverage, matches: records.reduce((sum, r) => sum + r.matches, 0), metrics: null, seasons: [], issues: [],
    selectionQuality: (Math.max(bat ?? prior, bowl ?? prior) + (allRounder ? 4 : 0)) * (.85 + .15 * confidence),
  };
  const fieldingEvidence = blend(records, r => {
    if (!r.fielding || !r.matches) return null;
    const contributions = r.fielding.catches + r.fielding.stumpings + r.fielding.runOuts;
    const rate = contributions / r.matches;
    return adjust(estimate(rate, keeper ? [.15,.35,.60,.90,1.3] : [.08,.20,.35,.55,.85]), r.matches, 8);
  });
  return {...member, rating, priceLakh: null, fieldingEvidence, reviewedFielding: review?.fieldingAssessment, hand: review?.battingHand ?? metadata?.battingHand};
}
type Rated = ReturnType<typeof profile>;
const quality = (value: number | null) => value ?? prior;
const best = (pool: Rated[], score: (p: Rated) => number, count: number) => [...pool].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)).slice(0, count);
const withSlots = (scores: number[], slots: number, vacant: number) => mean([...scores.slice(0, slots), ...Array<number>(Math.max(0, slots - scores.length)).fill(vacant)]);
const batQuality = (p: Rated) => quality(p.rating.batting);
const bowlQuality = (p: Rated) => quality(p.rating.bowling);
const roleCoverage = (players: Rated[], phase: Phase, skill: 'batting' | 'bowling') =>
  withSlots(best(players.filter(p => p.rating.phase[phase][skill] !== null), p => quality(p.rating.phase[phase][skill]), 2).map(p => quality(p.rating.phase[phase][skill])), 2, 54);

function lineupScores(xi: Rated[], impact?: Rated) {
  const batters = xi.filter(p => p.rating.battingOption);
  const bowlers = xi.filter(p => p.rating.bowlingOption);
  const openers = best(batters.filter(p => p.rating.batRole === 'OPENER'), batQuality, 2);
  const middle = best(batters.filter(p => p.rating.batRole === 'MIDDLE'), batQuality, 3);
  const finishers = best(batters.filter(p => p.rating.batRole === 'FINISHER'), batQuality, 2);
  const pace = bowlers.filter(p => p.rating.style === 'PACE');
  const spin = bowlers.filter(p => p.rating.style === 'SPIN');
  const keepers = batters.filter(p => p.rating.keeper);
  const provenBowls = bowlers.filter(p => p.rating.bowling !== null && p.rating.confidence >= 30);
  const roleFit = .31 * withSlots(openers.map(batQuality), 2, 56) + .32 * withSlots(middle.map(batQuality), 3, 58)
    + .27 * withSlots(finishers.map(batQuality), 2, 56) + .10 * withSlots(best(batters, batQuality, 7).slice(5).map(batQuality), 2, 56);
  const topSix = withSlots(best(batters, batQuality, 6).map(batQuality), 6, 56);
  const batting = .65 * topSix + .35 * roleFit;
  const bowling = .44 * withSlots(best(pace, bowlQuality, 2).map(bowlQuality), 2, 55)
    + .24 * withSlots(best(spin, bowlQuality, 1).map(bowlQuality), 1, 55)
    + .32 * withSlots(best(bowlers, bowlQuality, 5).slice(2).map(bowlQuality), 3, 54);
  const knownHands = new Set(batters.map(p => p.hand).filter(Boolean));
  const balance = 40 + 8 * Number(keepers.length > 0) + Math.min(6, provenBowls.length) * 3
    + Math.min(2, xi.filter(p => p.rating.allRounder).length) * 5 + 6 * Number(pace.length >= 2 && spin.length >= 1)
    + Math.min(7, batters.length) + (knownHands.size === 2 ? 3 : 0) + (impact ? 4 : 0);
  const phase = phases.map(p => (roleCoverage(batters, p, 'batting') + roleCoverage(bowlers, p, 'bowling')) / 2);
  return {batting, bowling, balance, phase, keepers, pace, spin};
}

export function canUseImpactPlayer(xi: Member[], candidate: Member) {
  return xi.length === 11 && !xi.some(p => p.id === candidate.id) && (!candidate.isOverseas || xi.filter(p => p.isOverseas).length < 4);
}
const legal = (xi: Rated[]) => xi.filter(p => p.isOverseas).length <= 4 && xi.some(p => p.rating.keeper)
  && xi.filter(p => p.rating.battingOption).length >= 6 && xi.filter(p => p.rating.bowlingOption).length >= 5;
const utility = (xi: Rated[]) => {
  const s = lineupScores(xi);
  return s.batting * .35 + s.bowling * .35 + s.balance * .18 + mean(s.phase) * .12;
};
function practicalXI(pool: Rated[]) {
  const selected = selectLegalXI(pool as Candidate[]);
  if (selected.status !== 'LEGAL') return {xi: [], reason: selected.reason};
  let xi = pool.filter(p => selected.ids.includes(p.id));
  // Improve the practical combination with legal single-player swaps.
  for (let pass = 0; pass < 4; pass++) {
    let next = xi, value = utility(xi);
    const reserves = pool.filter(p => !xi.includes(p));
    for (const candidate of reserves) {
      for (let slot = 0; slot < xi.length; slot++) {
        const trial = xi.map((p, index) => index === slot ? candidate : p);
        if (!legal(trial)) continue;
        const score = utility(trial);
        if (score > value + 1e-8) {
          next = trial;
          value = score;
        }
      }
    }
    if (next === xi) break;
    xi = next;
  }
  return {xi, reason: null};
}

export function squadMembers(session: SessionView): Member[] {
  const retained = session.squad.filter(p => p.eligible && session.decisions[p.playerId] === 'RETAIN')
    .map(p => ({id: p.playerId, name: p.player.name, role: p.player.role, isOverseas: p.isOverseas}));
  return [...retained, ...(session.ratingPurchases ?? []).map(p => ({
    id: p.player.id, name: p.player.name, role: p.player.role, isOverseas: p.isOverseas,
  }))];
}

export function createExpertEngine(dataset: RatingDataset) {
  const seasons = dataset.seasons.filter(s => s.completed && s.verified && s.year in seasonWeights);
  const years = new Set(seasons.map(s => s.year));
  const records = new Map<string, IPLRecord[]>();
  for (const record of dataset.records) {
    if (record.competition !== 'IPL' || !years.has(record.year)) continue;
    const previous = records.get(record.playerId) ?? [];
    previous.push(record);
    records.set(record.playerId, previous);
  }
  const metadata = new Map(dataset.players.map(p => [p.id, p]));
  const names = new Map(dataset.players.map(p => [namesKey(p.name), p.id]));
  for (const review of expertProfiles) {
    if (!metadata.has(review.playerId) || !review.reviewedBy.trim() || !review.evidence.startsWith('https://')
      || (review.fieldingAssessment !== undefined && !(review.fieldingAssessment >= 0 && review.fieldingAssessment <= 100))) {
      throw new Error('Invalid reviewed IPL player profile.');
    }
  }
  if (new Set(expertProfiles.map(p => p.playerId)).size !== expertProfiles.length) throw new Error('Duplicate reviewed IPL profile.');
  const approved = new Map(references.flatMap(reference => {
    const ids = reference.names.split('|').map(name => names.get(namesKey(name)));
    return ids.every((id): id is string => !!id) ? [[rosterKey(ids), reference] as const] : [];
  }));

  function evaluate(members: Member[]) {
    const pool = [...members].sort((a, b) => a.id.localeCompare(b.id)).map(member => profile(member, records.get(member.id) ?? [], metadata.get(member.id)));
    const reference = approved.get(rosterKey(pool.map(p => p.id)));
    const {xi, reason} = practicalXI(pool);
    const incomplete = !xi.length;
    const core = incomplete ? best(pool, p => p.rating.selectionQuality, 11) : xi;
    const bench = pool.filter(p => !core.includes(p));
    const impact = best(bench.filter(p => canUseImpactPlayer(xi, p) && p.rating.confidence >= 25),
      p => Math.max(batQuality(p), bowlQuality(p), quality(p.rating.phase.DEATH.bowling)), 1)[0];
    const lineup = lineupScores(core, impact);
    const backedUp = [
      ...(['OPENER', 'MIDDLE', 'FINISHER'] as const).map(role => best(bench.filter(p => p.rating.battingOption && p.rating.batRole === role), batQuality, 1)[0]?.rating.batting),
      best(bench.filter(p => p.rating.keeper), batQuality, 1)[0]?.rating.batting,
      ...[false, true].map(overseas => best(bench.filter(p => p.isOverseas === overseas && p.rating.style === 'PACE' && p.rating.bowlingOption), bowlQuality, 1)[0]?.rating.bowling),
      best(bench.filter(p => p.rating.style === 'SPIN' && p.rating.bowlingOption), bowlQuality, 1)[0]?.rating.bowling,
      best(bench.filter(p => p.rating.allRounder), p => mean([batQuality(p), bowlQuality(p)]), 1).map(p => mean([batQuality(p), bowlQuality(p)]))[0],
    ];
    const fielding = core.flatMap(p => {
      const value = p.reviewedFielding ?? p.fieldingEvidence;
      return value === null ? [] : [value];
    });
    const keeping = lineup.keepers.length ? .75 * mean(lineup.keepers.map(p => p.reviewedFielding ?? p.fieldingEvidence ?? prior))
      + .25 * (bench.some(p => p.rating.keeper) ? 86 : 66) : 49;
    const deathBowling = roleCoverage(core, 'DEATH', 'bowling');
    const general: Scores = {
      battingStrength: round(lineup.batting),
      bowlingStrength: round(lineup.bowling),
      playingXIBalance: round(Math.min(incomplete ? 69 : 100, lineup.balance)),
      benchStrength: round(mean(backedUp.map(n => n ?? 55))),
      phaseCoverage: round(.27 * lineup.phase[0] + .28 * lineup.phase[1] + .45 * lineup.phase[2] - Math.max(0, 69 - deathBowling) * .24),
      fieldingWicketkeeping: round(fielding.length ? .55 * keeping + .45 * mean(fielding) : keeping),
    };
    const scores = reference ? Object.fromEntries(keys.map((key, index) => [key, reference.scores[index]])) as Scores : general;
    const overallRating = overall(scores);
    const categoryExplanations: Record<Category, string> = {
      battingStrength: 'Quality of the strongest six batters plus opening, middle-order, finishing and depth coverage. Strike rate, dismissal average and contribution frequency use IPL evidence. Pace and spin scoring splits contribute where both samples are sufficient.',
      bowlingStrength: 'Lead pace pair, best spin option and supporting bowlers. Economy and balls per wicket measure control and threat.',
      playingXIBalance: 'Keeper, batting depth, proven bowling options, genuine all-rounders, pace and spin, and a legal Impact option. Left/right evidence uses verified profile metadata where available.',
      benchStrength: 'Quality of the strongest backup per role outside the XI. Unproven or uncovered roles receive a conservative assessment.',
      phaseCoverage: phaseLabels.map((label, i) => `${label} ${round(lineup.phase[i])}`).join(' · ') + '. Death bowling gaps carry extra weight within this category.',
      fieldingWicketkeeping: 'Provisional. Keeper cover and recorded catches, stumpings and run-out involvements are assessed. Catch opportunities, drops and ground-fielding reliability are unavailable.',
    };
    if (reference) for (const key of keys) categoryExplanations[key] = 'Approved expert estimate for this exact squad. ' + categoryExplanations[key];
    const weaknesses = [
      ...(reason ? [reason] : []),
      ...(reference?.weaknesses ?? []),
      ...(deathBowling < 70 ? ['Death bowling lacks two proven options.'] : []),
      ...(lineup.pace.length < 2 ? ['The core lacks two classified pace options.'] : []),
      ...(lineup.spin.length === 0 ? ['The core lacks a classified spin option.'] : []),
      ...(!lineup.keepers.length ? ['No wicketkeeper in the current core.'] : []),
      ...(backedUp.filter(n => n != null && n >= 70).length < 4 ? ['Few IPL-proven backups across the key roles.'] : []),
    ];
    const auctionPriorities = [
      ...(deathBowling < 70 ? ['Proven death-over pacer'] : []),
      ...(!lineup.keepers.length ? ['First-choice wicketkeeper'] : !bench.some(p => p.rating.keeper) ? ['Backup wicketkeeper'] : []),
      ...(lineup.spin.length === 0 ? ['Middle-overs spinner'] : []),
      ...(core.filter(p => p.rating.batRole === 'OPENER' && p.rating.battingOption).length < 2 ? ['IPL-proven opener'] : []),
      ...(core.filter(p => p.rating.bowlingOption).length < 5 ? ['Reliable fifth bowler'] : []),
      ...(core.every(p => !p.rating.allRounder) ? ['Proven all-rounder'] : []),
    ];
    const display = (p: Rated) => ({id: p.id, name: p.name, role: p.rating.keeper ? 'Wicketkeeper' : p.rating.allRounder ? 'All-rounder' : !p.rating.battingOption ? p.rating.style === 'SPIN' ? 'Spinner' : 'Bowler' : {OPENER:'Opener', MIDDLE:'Middle order', FINISHER:'Finisher'}[p.rating.batRole], isOverseas: p.isOverseas});
    const battingOrder = (p: Rated) => p.rating.battingOption ? {OPENER:0, MIDDLE:1, FINISHER:2}[p.rating.batRole] : 3;
    const ratingConfidence = pool.length ? Math.round(mean(pool.map(p => p.rating.confidence)) * .95) : 0;
    return {...scores, overallRating, tier: tierFor(overallRating),
      bestPlayingXI: [...xi].sort((a, b) => battingOrder(a) - battingOrder(b) || batQuality(b) - batQuality(a)).map(display),
      impactPlayer: impact ? display(impact) : null,
      strengths: [...(reference?.strengths ?? keys.filter(key => scores[key] >= 85).map(key => categories[key][0]))],
      weaknesses, auctionPriorities, ratingConfidence, categoryExplanations, approvedReference: !!reference,
      provisional: true, playerCount: pool.length, coveredPlayers: pool.filter(p => p.rating.confidence > 0).length,
      version: EXPERT_VERSION, seasons, checkedAt: dataset.checkedAt, source: dataset.source,
    };
  }
  const cache = new Map<string, ReturnType<typeof evaluate>>();
  return (members: Member[]) => {
    if (new Set(members.map(p => p.id)).size !== members.length) throw new Error('Duplicate player in the rated squad.');
    // Known identities use catalogue roles and overseas status; unknown purchases retain supplied roster metadata.
    const canonical = members.map(member => {
      const data = metadata.get(member.id);
      return data ? {...member, name: data.name, role: data.rosterRole, isOverseas: data.isOverseas ?? member.isOverseas} : member;
    });
    const key = JSON.stringify([EXPERT_VERSION, rosterKey(canonical.map(p => p.id)), canonical.filter(p => metadata.get(p.id)?.isOverseas == null).sort((a,b) => a.id.localeCompare(b.id))]);
    const previous = cache.get(key);
    if (previous) return previous;
    const report = evaluate(canonical);
    if (cache.size >= 128) cache.delete(cache.keys().next().value!);
    cache.set(key, report);
    return report;
  };
}
