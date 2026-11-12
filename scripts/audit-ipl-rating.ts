import {assessSquad} from '../browser-auction/squad-rating-data';
import {baselineSquad, teams} from '../browser-auction/store';
console.table(teams.map(team => {
  const report = assessSquad(baselineSquad(team.id));
  return {team: team.shortName, players: report.playerCount, rating: report.overallRating, tier: report.tier, confidence: report.ratingConfidence, xi: report.bestPlayingXI.length};
}));
