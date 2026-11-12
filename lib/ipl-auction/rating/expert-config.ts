export const EXPERT_VERSION = 'IPL-2027-expert-v2';
export const seasonWeights = {2025: .4, 2026: .6} as const;
export const categories = {
  battingStrength: ['Batting Strength', 30],
  bowlingStrength: ['Bowling Strength', 30],
  playingXIBalance: ['Playing XI Balance', 15],
  benchStrength: ['Bench Strength', 10],
  phaseCoverage: ['Phase Coverage', 10],
  fieldingWicketkeeping: ['Fielding & Wicketkeeping', 5],
} as const;
export type Category = keyof typeof categories;
export type Scores = Record<Category, number>;

// Ordered absolute quality anchors. The same cricket standards apply to every squad.
export const anchors = {
  batRate: [100, 120, 135, 150, 170],
  batAverage: [12, 20, 28, 36, 48],
  finishRate: [110, 135, 155, 175, 200],
  finishAverage: [9, 15, 22, 30, 42],
  economy: [12, 10, 9, 8, 7],
  wicketRate: [42, 30, 23, 18, 13],
  phaseBat: [[110, 125, 140, 155, 175], [100, 120, 135, 150, 170], [115, 140, 160, 180, 205]],
  phaseEconomy: [[12, 10.5, 9.25, 8, 7], [11, 9.5, 8.5, 7.5, 6.5], [15, 13, 11.5, 10, 8.5]],
  scores: [55, 70, 80, 90, 97],
  sample: {batting: 120, battingScore: 55, bowling: 90, phase: 42, consistency: 8},
  limitedEvidencePrior: 65,
} as const;

export type ExpertProfile = {
  playerId: string;
  reviewedBy: string;
  evidence: string;
  batRole?: 'OPENER' | 'MIDDLE' | 'FINISHER';
  battingHand?: 'LEFT' | 'RIGHT';
  fieldingAssessment?: number;
};
// Add reviewed, IPL-only profiles by stable player ID, with an evidence URL.
// Bump the methodology version when changing any scoring inputs or rubric.
export const expertProfiles: readonly ExpertProfile[] = [];
