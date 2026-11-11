import records from '../prisma/data/ipl-six-season-stats.json';
import {rateSquad} from '../lib/ipl-auction/rating';
import type {SessionView} from '../lib/ipl-auction/types';
export const buildRating=(session:SessionView)=>rateSquad(session,records.records);
