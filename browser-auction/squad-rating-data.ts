import dataset from '../prisma/data/ipl-rating-data.json';
import salaries from '../prisma/data/ipl-salary-references.json';
import trades from '../prisma/data/ipl-2027-confirmed-trades.json';
import {createRatingEngine} from '../lib/ipl-auction/rating';
import type {RatingDataset} from '../lib/ipl-auction/rating';
const tradeCosts=new Map(trades.rows.map(t=>[t.playerId,t.salaryLakh]));
const contracts=salaries.rows.map(c=>({playerId:c.playerId,salaryLakh:tradeCosts.get(c.playerId)??c.salaryLakh}));
// No domestic/international/career-stat imports are allowed in this module.
export const buildRating=createRatingEngine(dataset as unknown as RatingDataset,contracts);
