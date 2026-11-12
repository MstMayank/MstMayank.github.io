'use client';

import {useEffect, useState, type CSSProperties} from 'react';
import type {SessionView} from '@/lib/ipl-auction/types';
import type {buildRating} from '@/browser-auction/squad-rating-data';
import {categories, type Category} from '@/lib/ipl-auction/rating/expert-config';

import {money, TeamLogo} from './shared';

const labels = ['Batting', 'Bowling', 'Balance', 'Bench', 'Phase coverage', 'Fielding'];
type Report = ReturnType<typeof buildRating>;
const keys = Object.keys(categories) as Category[];

export default function SquadRating({session, disabled, autoRun = false}: {session: SessionView; disabled: boolean; autoRun?: boolean}) {
  const signature = JSON.stringify([session.id, session.decisions, session.ratingPurchases, session.squad.map(p => [p.playerId, p.eligible, p.isOverseas])]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{signature: string; report: Report; change: number | null} | null>(null);
  const [failure, setFailure] = useState<{signature: string; message: string} | null>(null);
  useEffect(() => {
    if (!autoRun && !attempt) return;
    let active = true;
    import('@/browser-auction/squad-rating-data').then(({buildRating}) => {
      const report = buildRating(session);
      if (!active) return;
      setFailure(null);
      setResult(previous => ({
        signature, report,
        change: previous?.signature === signature ? previous.change : previous?.report.playerCount && report.playerCount
          ? report.overallRating - previous.report.overallRating : null,
      }));
    }).catch(error => {
      if (active) setFailure({signature, message: error instanceof Error ? error.message : 'Rating data could not load.'});
    });
    return () => {active = false;};
  }, [autoRun, attempt, session, signature]);
  const report = result?.signature === signature ? result.report : null;
  const error = failure?.signature === signature ? failure.message : null;
  const change = result?.change;
  return <section className="surface squad-rating" aria-label="IPL expert squad rating">
    {error && <p role="alert">{error} <button className="text-link" disabled={disabled} onClick={() => {setFailure(null); setAttempt(n => n + 1);}}>Retry</button></p>}
    {!report && !error && (autoRun || attempt ? <p role="status">Updating squad assessment…</p>
      : <button className="button" disabled={disabled} onClick={() => setAttempt(n => n + 1)}>Rate your squad</button>)}
    {report && <>
      {report.playerCount ? <div aria-live="polite">
        <div className="rating-card" style={{'--rating-accent': session.team.color} as CSSProperties}>
          <header className="rating-card-header">
            <TeamLogo team={session.team} />
            <div>
              <span>{session.team.shortName} · IPL {session.season.year}</span>
              <strong>{report.overallRating.toFixed(2)} / 100</strong>
              <b>{report.tier} Tier</b>
            </div>
            {change != null && change !== 0 && <span className="rating-card-change" data-direction={change > 0 ? 'up' : 'down'} aria-label={`Rating change: ${change.toFixed(2)}`}>{change > 0 ? '+' : ''}{change.toFixed(2)}</span>}
          </header>
          <div className="rating-card-bars">
            {keys.map((key, index) => <div className="rating-card-row" key={key}>
              <span>{labels[index]}</span>
              <progress max={100} value={report[key]} aria-label={categories[key][0]} />
              <span>{Number(report[key].toFixed(1))}</span>
            </div>)}
          </div>
          <dl className="rating-card-footer">
            <div><dt>Retained players</dt><dd>{session.totals.retained} / {session.squad.filter(player => player.eligible).length}</dd></div>
            <div><dt>Purse remaining</dt><dd>{money(session.totals.remainingLakh)}</dd></div>
          </dl>
        </div>
      </div> : <p role="status">Retain a player to start your squad assessment.</p>}
    </>}
  </section>;
}
