import type {Scores} from '../lib/ipl-auction/rating/expert-config';
// V6 provisional manual squad calibration; not a season standings model.
const row = (battingStrength:number,bowlingStrength:number,playingXIBalance:number,benchStrength:number,phaseCoverage:number,fieldingWicketkeeping:number):Scores => ({battingStrength,bowlingStrength,playingXIBalance,benchStrength,phaseCoverage,fieldingWicketkeeping});
export const expertBaselines: Record<string,Scores> = {
  rcb: row(95,93,95,91,94,87),
  gt: row(93,95,93,88,93,85),
  srh: row(96,87,90,85,91,85),
  rr: row(94,89,90,83,91,86),
  mi: row(91,89,91,87,90,86),
  pbks: row(94,82,91,86,85,85),
  kkr: row(87,90,89,84,89,84),
  dc: row(88,83,87,85,85,86),
  lsg: row(86,86,86,82,85,83),
  csk: row(84,85,84,78,84,84),
};
