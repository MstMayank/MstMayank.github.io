// Build browser-auction/game/player-values.json: a quality score for every auction-pool player,
// used by the computer franchises' bid ceilings (browser-auction/game/strategy.ts).
//   npx tsx scripts/build-auction-values.ts
// quality = V6 player selection quality (lib/ipl-auction/rating/players.ts) over the rating seasons
// (50 = average); matches = IPL matches in those seasons, so thin evidence can be discounted.
import {writeFileSync} from 'node:fs';
import dataset from '../prisma/data/ipl-rating-data.json';
import pool from '../browser-auction/game/mini-auction.json';
import {playerRatings} from '../lib/ipl-auction/rating/players';
import {RATING_CONFIG} from '../lib/ipl-auction/rating/config';
import type {RatingDataset} from '../lib/ipl-auction/rating/types';

const years = Object.keys(RATING_CONFIG.seasonWeights).map(Number);
const source = dataset as unknown as RatingDataset;
const ratings = playerRatings({...source, records: source.records.filter(r => years.includes(r.year))});
const ids = [...(pool as any).releasedPlayers.map((m: {id: string}) => m.id), ...(pool as any).registeredPlayers.map((m: {player: {id: string}}) => m.player.id)];
const players: Record<string, {quality: number; matches: number}> = {};
for (const id of ids) {
  const r = ratings.get(id);
  players[id] = {quality: Math.round((r?.selectionQuality ?? 50) * 10) / 10, matches: r?.matches ?? 0};
}
const out = {version: 1, rating: RATING_CONFIG.version, seasons: years, poolRevision: (pool as any).revision, players};
writeFileSync(new URL('../browser-auction/game/player-values.json', import.meta.url), JSON.stringify(out) + '\n');
console.log(`Wrote player-values.json for ${ids.length} players (rating ${RATING_CONFIG.version}, seasons ${years.join('+')})`);
