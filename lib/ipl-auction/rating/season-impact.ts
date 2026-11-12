export type SeasonImpact = {
  playerId: string;
  category: string;
  maxImpact: number;
  basis: string;
  evidenceStatus: string;
};

export function impactIndex(rows: readonly SeasonImpact[]) {
  const result = new Map<string, SeasonImpact>();
  for (const row of rows) {
    if (!row.playerId || result.has(row.playerId) || !Number.isFinite(row.maxImpact) || row.maxImpact < 0 || row.maxImpact > 7) {
      throw new Error(`Invalid V6 impact record for ${row.playerId}`);
    }
    result.set(row.playerId, row);
  }
  return result;
}

export function impactQuality(raw: number | null, impact: SeasonImpact | undefined, discipline: 'batting' | 'bowling') {
  if (!impact || impact.basis === 'NO_SEASON_EVIDENCE') return raw;
  const batting = ['BATSMAN', 'ELITE_BATSMAN', 'UNCAPPED_PLAYER'].includes(impact.category);
  const bowling = ['BOWLER', 'ELITE_BOWLER'].includes(impact.category);
  if (discipline === 'batting' ? !batting : !bowling) return raw;
  // Convert the provisional impact scale to a bounded player-quality estimate.
  // Blend it into the existing role score once, before comparing actual replacements.
  const estimate = 65 + impact.maxImpact * 4.5;
  if (impact.basis === 'MANUAL_CALIBRATION') return estimate;
  if (raw === null) return null;
  const weight = impact.evidenceStatus === 'AVAILABLE' ? .25 : .10;
  return raw * (1 - weight) + estimate * weight;
}
