import type {Player} from '../lib/ipl-auction/types';
import stats from '../prisma/data/ipl-official-season-stats.json';
import careers from '../prisma/data/auction-career-records.json';
const updatedAt='2026-11-11T00:00:00Z';
const rate=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(2):null;
const careerStats=(id:string,kind:string)=>careers.rows.filter(s=>s.playerId===id&&s.kind===kind).map(s=>({format:s.format,matches:s.matches,runs:s.runs,wickets:s.wickets,battingAverage:rate(s.battingAverage),bowlingAverage:rate(s.bowlingAverage),strikeRate:rate(s.strikeRate),economy:rate(s.economy),updatedAt,source:{name:`Published career snapshot · as-of ${s.asOf||'not supplied'}${s.bowlingSource&&s.bowlingSource!==s.source?' · bowling: '+s.bowlingSource:''} · coverage varies`,url:s.source,isDemo:false,updatedAt}}));

export function withStats(p:Player):Player{return {...p,iplStats:stats.records.filter(s=>s.playerId===p.id).map(s=>({year:s.year,matches:s.matches,runs:s.runs,wickets:s.wickets,battingAverage:s.battingAverage,bowlingAverage:s.bowlingAverage,strikeRate:s.strikeRate,economy:s.economy,updatedAt,source:{name:`Official IPL ${s.year} scorecards · derived figures; 2025 coverage incomplete`,url:`https://www.iplt20.com/matches?season=${s.year}&status=results`,isDemo:false,updatedAt}})),domesticStats:careerStats(p.id,'domestic'),internationalStats:careerStats(p.id,'international')};}
