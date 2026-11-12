import dataset from '../prisma/data/ipl-rating-data.json';
import impacts from '../reference/ipl-2027-season-impact.json';
import {createExpertEngine, overall, squadMembers, tierFor, type Member} from '../lib/ipl-auction/rating/expert';
import {categories, type Category} from '../lib/ipl-auction/rating/expert-config';
import type {RatingDataset} from '../lib/ipl-auction/rating/types';
import type {SessionView} from '../lib/ipl-auction/types';
import {expertBaselines} from './expert-baselines';
import {baselineSquad, teams} from './store';

const iplData = dataset as unknown as RatingDataset;
export const assessSquad = createExpertEngine(iplData, impacts);
const categoryKeys = Object.keys(categories) as Category[];

export function assessFranchise(teamId: string, members: Member[]) {
  const current = assessSquad(members);
  const anchor = expertBaselines[teamId];
  if (!anchor || !members.length) return current;
  const fullRoster = assessSquad(baselineSquad(teamId));
  const coverage = Math.min(1, members.length / 11);
  const scores = {...anchor};
  for (const key of categoryKeys) {
    // The same evidence/impact model rates both squads, so a released player
    // contributes only the net difference after the replacement XI is chosen.
    const calibration = (anchor[key] - fullRoster[key]) * coverage;
    scores[key] = Math.round(Math.min(100, Math.max(0, current[key] + calibration)) * 100) / 100;
  }
  const overallRating = overall(scores);
  return {
    ...current,
    ...scores,
    overallRating,
    tier: tierFor(overallRating),
    strengths: categoryKeys.filter(key => scores[key] >= 85).map(key => categories[key][0]),
    categoryExplanations: Object.fromEntries(categoryKeys.map(key => [
      key,
      `${current.categoryExplanations[key]} V6 expert baseline: ${anchor[key]}. Current roster adjustment: ${(scores[key] - anchor[key]).toFixed(2)}.`,
    ])) as typeof current.categoryExplanations,
  };
}

export function buildRating(session: SessionView) {
  const report = assessFranchise(session.team.id, squadMembers(session));
  const rankings = teams.map(team => {
    const current = team.id === session.team.id;
    const assessment = current ? report : assessFranchise(team.id, baselineSquad(team.id));
    return {id: team.id, team: team.shortName, score: assessment.playerCount ? assessment.overallRating : null, tier: assessment.tier, current};
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.team.localeCompare(b.team));
  return {...report, rankings};
}
