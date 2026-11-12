export const RATING_CONFIG={
 version:'IPL-2027-v5',seasonWeights:{2025:.3,2026:.7} as Record<number,number>,
 phaseWeights:{POWERPLAY:12,MIDDLE:14,DEATH:14},
 teamWeights:{batting:40,bowling:40,balance:10,form:0,death:0,depth:10,experience:0,powerplay:0,spinPace:0,value:0},
 sample:{battingBalls:180,bowlingBalls:120,phaseBalls:48,innings:12,cohortBalls:36,minCohort:5},
 neutralPrior:50,experienceMatches:40,
 balanceWeights:{batting:.25,bowling:.35,keeper:.2,openers:.1,finishers:.1},targets:{openers:2,finishers:1,pace:3,spin:1,bench:5},
 xi:{size:11,maxOverseas:4,minKeepers:1,minBattingOptions:6,minBowlingOptions:5},
 // Only two independent performance groups score: scoring/survival, control/strike.
 // Boundary%, dot%, bowling average are explained but never added again to their correlated rates.
 battingProfiles:{OPENER:{efficiency:.5,survival:.5},MIDDLE:{efficiency:.45,survival:.55},FINISHER:{efficiency:.65,survival:.35}},
 bowlingProfiles:{PACE:{control:.5,strike:.5},SPIN:{control:.6,strike:.4},UNKNOWN:{control:.55,strike:.45}},
 selection:{rolePerformance:.7,phaseSuitability:.2,experience:.1},
} as const;
export type XIConstraints={size:number;maxOverseas:number;minKeepers:number;minBattingOptions:number;minBowlingOptions:number};
export type RatingConfig={version:string;seasonWeights:Record<number,number>;phaseWeights:Record<"POWERPLAY"|"MIDDLE"|"DEATH",number>;teamWeights:{[K in keyof typeof RATING_CONFIG.teamWeights]:number};sample:{[K in keyof typeof RATING_CONFIG.sample]:number};neutralPrior:number;experienceMatches:number;balanceWeights:{batting:number;bowling:number;keeper:number;openers:number;finishers:number};targets:{openers:number;finishers:number;pace:number;spin:number;bench:number};xi:XIConstraints;battingProfiles:{[K in keyof typeof RATING_CONFIG.battingProfiles]:{efficiency:number;survival:number}};bowlingProfiles:{[K in keyof typeof RATING_CONFIG.bowlingProfiles]:{control:number;strike:number}};selection:{rolePerformance:number;phaseSuitability:number;experience:number}};
