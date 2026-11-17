// Rates every franchise's IPL 2027 retained squad with the same V6 squad model used by the
// retention feature's "Rate your squad" (batting 30%, bowling 30%, XI balance 15%, bench 10%,
// phase coverage 10%, fielding & wicketkeeping 5%), then writes ipl-retentions-data.json.
//
// Run from the repository root:  npx tsx scripts/build-retention-ratings.ts
import {readFileSync, writeFileSync} from 'node:fs';
import {assessFranchise} from '../browser-auction/squad-rating-data';
import {categories, type Category} from '../lib/ipl-auction/rating/expert-config';

type Retained = {id: string; name: string; role: string; isOverseas: boolean; nationality?: string};
type TeamInput = {purseRemainingLakh: number; retained: Retained[]; released: string[]; note?: string};
const input = JSON.parse(readFileSync('data/ipl-2027-retentions.json', 'utf8')) as {
  teams: Record<string, TeamInput>; [key: string]: unknown;
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

const {teams: _ignored, ...meta} = input;
writeFileSync('ipl-retentions-data.json', JSON.stringify({
  ...meta,
  model: {version: 'IPL-2027-expert-v6', weights: Object.fromEntries(keys.map(k => [k, {label: categories[k][0], weight: categories[k][1]}]))},
  teams: teams.map((team, index) => ({rank: index + 1, ...team})),
}));
for (const t of teams) console.log(t.shortName.padEnd(5), String(t.retained.length).padStart(2), 'players', t.rating.overall.toFixed(2), t.rating.tier);
