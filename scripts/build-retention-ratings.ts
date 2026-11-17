// Rates every franchise's IPL 2027 retained squad with the same V6 squad model used by the
// retention feature's "Rate your squad" (batting 30%, bowling 30%, XI balance 15%, bench 10%,
// phase coverage 10%, fielding & wicketkeeping 5%), then writes ipl-retentions-data.json.
//
// Run from the repository root:  npx tsx scripts/build-retention-ratings.ts
import {readFileSync, writeFileSync} from 'node:fs';
import dataset from '../prisma/data/ipl-rating-data.json';
import impacts from '../reference/ipl-2027-season-impact.json';
import {createExpertEngine, overall, tierFor, type Member} from '../lib/ipl-auction/rating/expert';
import {categories, type Category} from '../lib/ipl-auction/rating/expert-config';
import type {RatingDataset} from '../lib/ipl-auction/rating/types';
import {expertBaselines} from '../browser-auction/expert-baselines';
import {baselineSquad} from '../browser-auction/store';

// Some roster players' IPL records sit under Cricsheet ids (listed in unmappedRosterNames), so the
// model treated them as having no IPL evidence (e.g. Vaibhav Sooryavanshi, Rohit Sharma, Rashid Khan).
// data/ipl-rating-identity-fixes.json links them; apply it to a copy of the dataset before rating.
const fixes = JSON.parse(readFileSync('data/ipl-rating-identity-fixes.json', 'utf8')).rows as Array<{playerId: string; archiveId: string}>;
const data = structuredClone(dataset) as unknown as RatingDataset & {players: any[]; records: any[]};
for (const {playerId, archiveId} of fixes) {
  const archive = data.players.find(p => p.id === archiveId);
  const roster = data.players.find(p => p.id === playerId);
  if (!archive || !roster) throw new Error(`Identity fix not found: ${playerId} -> ${archiveId}`);
  Object.assign(roster, {
    playingRole: archive.playingRole, profileRole: archive.profileRole, bowlingStyle: archive.bowlingStyle,
    styleDescription: archive.styleDescription, battingHand: archive.battingHand, metadataStatus: 'IDENTITY_FIX',
  });
  data.players = data.players.filter(p => p.id !== archiveId);
  for (const record of data.records) if (record.playerId === archiveId) record.playerId = playerId;
}
// Keepers the archive metadata lists as batters (confirmed on IPL / franchise profiles).
const retentionInput = JSON.parse(readFileSync('data/ipl-2027-retentions.json', 'utf8'));
const roleById = new Map<string, string>();
for (const team of Object.values(retentionInput.teams) as any[]) for (const p of team.retained) roleById.set(p.id, p.role);
for (const p of data.players) {
  if (roleById.get(p.id) === 'WICKETKEEPER' && p.playingRole !== 'WICKETKEEPER') { p.playingRole = 'WICKETKEEPER'; p.rosterRole = 'WICKETKEEPER'; }
}
const assessSquad = createExpertEngine(data, impacts as any);
const keyList = Object.keys(categories) as Category[];

// Same calibration as browser-auction/squad-rating-data.ts assessFranchise (V6 expert baselines).
function assessFranchise(teamId: string, members: Member[]) {
  const current = assessSquad(members);
  const anchor = expertBaselines[teamId];
  const fullRoster = assessSquad(baselineSquad(teamId).map(({id, name, role, isOverseas}) => ({id, name, role, isOverseas})));
  const coverage = Math.min(1, members.length / 11);
  const scores = {...anchor};
  for (const key of keyList) {
    const calibration = (anchor[key] - fullRoster[key]) * coverage;
    scores[key] = Math.round(Math.min(100, Math.max(0, current[key] + calibration)) * 100) / 100;
  }
  const overallRating = overall(scores);
  return {...current, ...scores, overallRating, tier: tierFor(overallRating),
    strengths: keyList.filter(key => scores[key] >= 85).map(key => categories[key][0])};
}

type Retained = {id: string; name: string; role: string; isOverseas: boolean; nationality?: string};
type TeamInput = {purseRemainingLakh: number; retained: Retained[]; released: string[]; note?: string};
const input = JSON.parse(readFileSync('data/ipl-2027-retentions.json', 'utf8')) as {
  teams: Record<string, TeamInput>; editorial?: any; [key: string]: unknown;
};

const names: Record<string, [string, string, string]> = {
  csk: ['Chennai Super Kings', 'CSK', '#f6ca46'], dc: ['Delhi Capitals', 'DC', '#539cff'],
  gt: ['Gujarat Titans', 'GT', '#9eaeff'], kkr: ['Kolkata Knight Riders', 'KKR', '#b591ff'],
  lsg: ['Lucknow Super Giants', 'LSG', '#42d1cb'], mi: ['Mumbai Indians', 'MI', '#4caaff'],
  pbks: ['Punjab Kings', 'PBKS', '#ff7979'], rr: ['Rajasthan Royals', 'RR', '#f291cf'],
  rcb: ['Royal Challengers Bengaluru', 'RCB', '#f36b6d'], srh: ['Sunrisers Hyderabad', 'SRH', '#ffad5a'],
};
const keys = Object.keys(categories) as Category[];

const teams = Object.entries(input.teams).map(([id, team]) => {
  const report = assessFranchise(id, team.retained.map(({id, name, role, isOverseas}) => ({id, name, role, isOverseas})));
  return {
    id, name: names[id][0], shortName: names[id][1], color: names[id][2],
    purseRemainingLakh: team.purseRemainingLakh,
    overseasCount: team.retained.filter(p => p.isOverseas).length,
    retained: team.retained, released: team.released, note: team.note ?? null,
    rating: {
      overall: report.overallRating, tier: report.tier,
      categories: Object.fromEntries(keys.map(k => [k, report[k]])),
      bestPlayingXI: report.bestPlayingXI, impactPlayer: report.impactPlayer,
      strengths: report.strengths, weaknesses: report.weaknesses,
      auctionPriorities: report.auctionPriorities, confidence: report.ratingConfidence,
    },
  };
}).sort((a, b) => b.rating.overall - a.rating.overall || a.shortName.localeCompare(b.shortName));

// ---- Scouting report: phase numbers from IPL 2025-26 ball-by-ball records of each retained squad,
// ranked against the other nine squads, plus squad balance. Replaces the model's generic notes.
const styleById = new Map(data.players.map(p => [p.id, p.bowlingStyle]));
const recs = data.records.filter(r => r.year >= 2025);
const PH = ['POWERPLAY', 'MIDDLE', 'DEATH'] as const;
const phaseName = {POWERPLAY: 'powerplay', MIDDLE: 'middle overs', DEATH: 'death overs'};
type Scout = Record<string, number>;
const scout = new Map<string, Scout>();
for (const t of teams) {
  const ids = new Set(t.retained.map(p => p.id));
  const m: Scout = {};
  for (const ph of PH) {
    let runs = 0, balls = 0, conceded = 0, legal = 0, wkts = 0;
    for (const r of recs) if (ids.has(r.playerId)) {
      const x = r.phases[ph]; runs += x.runs; balls += x.balls; conceded += x.conceded; legal += x.legalBalls; wkts += x.wickets;
    }
    m[`bat_${ph}`] = balls ? runs / balls * 100 : 0;      // strike rate
    m[`bowl_${ph}`] = legal ? conceded / legal * 6 : 99;   // economy
    m[`bpw_${ph}`] = wkts ? legal / wkts : 99;             // balls per wicket
  }
  const bowlers = t.retained.filter(p => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER');
  m.pace = bowlers.filter(p => styleById.get(p.id) === 'PACE').length;
  m.spin = bowlers.filter(p => styleById.get(p.id) === 'SPIN').length;
  m.keepers = t.retained.filter(p => p.role === 'WICKETKEEPER').length;
  m.allRounders = t.retained.filter(p => p.role === 'ALL_ROUNDER').length;
  scout.set(t.id, m);
}
const rankOf = (id: string, key: string, higherIsBetter: boolean) => {
  const sorted = [...scout.entries()].sort((a, b) => higherIsBetter ? b[1][key] - a[1][key] : a[1][key] - b[1][key]);
  return sorted.findIndex(([k]) => k === id) + 1;
};
const ord = (n: number) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
for (const t of teams) {
  const m = scout.get(t.id)!;
  const areas = PH.flatMap(ph => [
    {key: `bat_${ph}`, rank: rankOf(t.id, `bat_${ph}`, true), text: `${phaseName[ph][0].toUpperCase() + phaseName[ph].slice(1)} batting: strike rate ${m[`bat_${ph}`].toFixed(0)}`,
     need: ph === 'POWERPLAY' ? 'Explosive opener' : ph === 'MIDDLE' ? 'Middle-order batter who handles spin' : 'Proven finisher'},
    {key: `bowl_${ph}`, rank: rankOf(t.id, `bowl_${ph}`, false), text: `${phaseName[ph][0].toUpperCase() + phaseName[ph].slice(1)} bowling: ${m[`bowl_${ph}`].toFixed(1)} runs an over`,
     need: ph === 'POWERPLAY' ? 'New-ball pacer who swings it' : ph === 'MIDDLE' ? 'Wicket-taking spinner' : 'Death-overs fast bowler'},
  ]).sort((a, b) => b.rank - a.rank);
  const catRanks = keys.map(k => ({k, rank: [...teams].sort((a, b) => b.rating.categories[k] - a.rating.categories[k]).findIndex(x => x.id === t.id) + 1}))
    .sort((a, b) => b.rank - a.rank);
  // Weak spots: the squad's three lowest-ranked phase numbers, plus its lowest-ranked rating category if bottom three.
  const weak = areas.slice(0, 3).map(a => `${a.text} (${ord(a.rank)} of 10)`);
  if (catRanks[0].rank >= 8) weak.push(`${categories[catRanks[0].k][0]}: ${t.rating.categories[catRanks[0].k].toFixed(0)} (${ord(catRanks[0].rank)} of 10)`);
  // Shopping list: needs behind the two weakest phases, then squad-balance gaps.
  const needs = [...new Set(areas.slice(0, 2).map(a => a.need))];
  if (m.keepers < 2) needs.push('Backup wicketkeeper');
  if (m.spin < 2 && !needs.includes('Wicket-taking spinner')) needs.push('Second frontline spinner');
  if (m.pace < 5 && !needs.some(n => /pacer|fast/i.test(n))) needs.push('Pace-bowling depth');
  if (m.allRounders < 3) needs.push('Seam-bowling all-rounder');
  const slots = 25 - t.retained.length, overseasSlots = 8 - t.overseasCount;
  (t as any).squadNeeds = {slots, overseasSlots, pace: m.pace, spin: m.spin, keepers: m.keepers, allRounders: m.allRounders};
  t.rating.weaknesses = weak;
  t.rating.auctionPriorities = needs.slice(0, Math.max(2, Math.min(4, slots)));
  // Editorial calls from The Cricket Space override the automatic list for that team.
  const editorial = input.editorial?.teams?.[t.id];
  if (editorial?.needs) t.rating.auctionPriorities = editorial.needs;
  if (editorial?.weakSpots) t.rating.weaknesses = [...editorial.weakSpots, ...t.rating.weaknesses].slice(0, 4);
}

const {teams: _ignored, ...meta} = input;
writeFileSync('ipl-retentions-data.json', JSON.stringify({
  ...meta,
  model: {version: 'IPL-2027-expert-v6', weights: Object.fromEntries(keys.map(k => [k, {label: categories[k][0], weight: categories[k][1]}]))},
  teams: teams.map((team, index) => ({rank: index + 1, ...team})),
}));
for (const t of teams) console.log(t.shortName.padEnd(5), String(t.retained.length).padStart(2), 'players', t.rating.overall.toFixed(2), t.rating.tier);
