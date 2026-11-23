// How computer-run franchises value and bid for players in the mini-auction.
// Pure functions: the engine (engine.ts) still decides what is legal (purse reserve, 25-player
// squads, 8 overseas); these only decide how far a franchise is willing to go.
import values from './player-values.json';
import type {Player} from './mini-auction';

export type StrategyId = 'star' | 'value' | 'youth' | 'balanced';
export const STRATEGIES: Record<StrategyId, {label: string; blurb: string; star: number; plain: number; uncapped: number; capShare: number; needWeight: number}> = {
  star: {label: 'Star-chaser', blurb: 'Pays a premium for proven quality.', star: 1.4, plain: .8, uncapped: .85, capShare: .45, needWeight: .6},
  value: {label: 'Value hunter', blurb: 'Never goes beyond fair value.', star: 1, plain: .9, uncapped: 1, capShare: .25, needWeight: .8},
  youth: {label: 'Youth builder', blurb: 'Backs uncapped players.', star: .95, plain: .85, uncapped: 1.35, capShare: .3, needWeight: .8},
  balanced: {label: 'Balanced', blurb: 'Fills squad gaps first.', star: 1.1, plain: 1, uncapped: 1, capShare: .35, needWeight: 1.2},
};
// Fixed per franchise so every game feels the same "room"; shown in the game.
export const TEAM_STRATEGY: Record<string, StrategyId> = {
  mi: 'star', rcb: 'star', srh: 'star', csk: 'balanced', gt: 'balanced', lsg: 'balanced', kkr: 'value', dc: 'value', rr: 'youth', pbks: 'youth',
};
export const strategyFor = (teamId: string): StrategyId => TEAM_STRATEGY[teamId] ?? 'balanced';

const table = (values as {players: Record<string, {quality: number; matches: number}>}).players;

/**
 * Fair price in lakh: anchored on the higher of base price and last salary, doubled for every
 * 10 points of V6 quality above average (halved below), trusted in proportion to matches played
 * (20+ matches = full trust). Never below the base price.
 */
export function fairValue(player: Player, base: number, data = table): number {
  const info = data[player.id];
  const anchor = Math.max(base, player.salary ?? base);
  if (!info) return anchor;
  const trust = Math.min(1, info.matches / 20);
  const edge = (info.quality - 50) / 10 * trust;
  return Math.max(base, Math.round(anchor * Math.pow(2, edge)));
}

export type BidContext = {
  base: number; purse: number; squadSize: number; sameRole: number; uncapped: boolean;
  lotsLeft: number; minSquad?: number;
};

/** Highest price (lakh) this franchise will bid for the player right now. */
export function bidLimit(strategy: StrategyId, player: Player, ctx: BidContext, data = table): number {
  const s = STRATEGIES[strategy];
  const fair = fairValue(player, ctx.base, data);
  const info = data[player.id];
  const proven = !!info && info.matches >= 10 && info.quality >= 52;
  let limit = fair * (ctx.uncapped ? s.uncapped : proven ? s.star : s.plain);
  if (strategy === 'value') limit = Math.min(limit, fair);
  // Squad need: a role the franchise is short of is worth more, a covered role less.
  const target = player.role === 'WICKETKEEPER' ? 2 : player.role === 'BOWLER' ? 7 : 5;
  // Gaps are rewarded in full (scaled by the strategy); a well-covered role only trims the price,
  // so a franchise with a deep squad still competes for a player it rates.
  const need = Math.min(1.35, Math.max(.8, 1.35 - ctx.sameRole / target));
  limit *= need >= 1 ? 1 + (need - 1) * s.needWeight : 1 + (need - 1) * .5;
  // Late in the auction with too few players, buy at the base price rather than finish short.
  const short = (ctx.minSquad ?? 18) - ctx.squadSize;
  if (short > 0 && ctx.lotsLeft <= short * 2) limit = Math.max(limit, ctx.base);
  // Never spend more than this share of the purse on one player.
  const cap = ctx.purse * (ctx.squadSize < 10 ? s.capShare * .7 : s.capShare);
  return Math.floor(Math.min(limit, cap));
}

export type ReportRow = {id: string; teamId: string; price: number; fair: number; ratio: number};
/** Sold lots against fair value: the best value buys and the biggest overpays. */
export function valueReport(history: Array<{id: string; teamId: string | null; price: number}>, find: (id: string) => Player, base: (id: string) => number, count = 5) {
  const rows: ReportRow[] = history.filter(h => h.teamId && h.price > 0).map(h => {
    const fair = fairValue(find(h.id), base(h.id));
    return {id: h.id, teamId: h.teamId!, price: h.price, fair, ratio: h.price / fair};
  });
  return {
    bargains: [...rows].sort((a, b) => a.ratio - b.ratio || b.fair - a.fair).slice(0, count),
    overpays: [...rows].sort((a, b) => b.ratio - a.ratio || b.price - a.price).slice(0, count),
    rows,
  };
}
