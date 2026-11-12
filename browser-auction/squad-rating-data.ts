import dataset from '../prisma/data/ipl-rating-data.json';
import {createExpertEngine, squadMembers} from '../lib/ipl-auction/rating/expert';
import type {RatingDataset} from '../lib/ipl-auction/rating/types';
import type {SessionView} from '../lib/ipl-auction/types';
import {baselineSquad, teams} from './store';

export const assessSquad = createExpertEngine(dataset as unknown as RatingDataset);
export function buildRating(session: SessionView) {
  const report = assessSquad(squadMembers(session));
  const rankings = teams.map(team => {
    const current = team.id === session.team.id;
    const assessment = current ? report : assessSquad(baselineSquad(team.id));
    return {id: team.id, team: team.shortName, score: assessment.playerCount ? assessment.overallRating : null, tier: assessment.tier, current};
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.team.localeCompare(b.team));
  return {...report, rankings};
}
