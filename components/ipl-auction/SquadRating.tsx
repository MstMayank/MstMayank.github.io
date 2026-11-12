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
        <details>
          <summary>Assessment details</summary>
          <p>{report.approvedReference ? 'Approved expert reference' : 'V6 provisional expert assessment'} · {report.ratingConfidence}% evidence confidence · {report.coveredPlayers}/{report.playerCount} players with IPL evidence</p>
          <ul>{keys.map(key => <li key={key}><strong>{categories[key][0]} · {categories[key][1]}%</strong> {report.categoryExplanations[key]}</li>)}</ul>
        <div className="expert-rating-columns">
          <div>
            <h3>Best Playing XI</h3>
            {report.bestPlayingXI.length ? <ol>{report.bestPlayingXI.map(player =>
              <li key={player.id}>{player.name} <small>{player.role}{player.isOverseas ? ' · Overseas' : ''}</small></li>)}</ol>
              : <p>No XI meets the current selection rules.</p>}
            <p><strong>Impact Player</strong> {report.impactPlayer?.name ?? 'No eligible option with sufficient IPL evidence'}</p>
          </div>
          <div>
            <h3>Auction priorities</h3>
            {report.auctionPriorities.length ? <ul>{report.auctionPriorities.map(item => <li key={item}>{item}</li>)}</ul> : <p>No immediate role gaps identified.</p>}
            {!!report.strengths.length && <><h3>Strengths</h3><ul>{report.strengths.map(item => <li key={item}>{item}</li>)}</ul></>}
            {!!report.weaknesses.length && <><h3>Weaknesses</h3><ul>{report.weaknesses.map(item => <li key={item}>{item}</li>)}</ul></>}
          </div>
        </div>
        </details>
      </div> : <p role="status">Retain a player to start your squad assessment.</p>}
      <details>
        <summary>Rankings across all ten teams</summary>
        <p>Your current squad is ranked alongside the other franchises’ baseline squads.</p>
        <ol className="expert-team-rankings">{report.rankings.map(row => <li key={row.id}><strong>{row.team}</strong> {row.score === null ? 'Unrated' : `${row.score.toFixed(2)} · ${row.tier}`}{row.current ? ' · Your squad' : ''}</li>)}</ol>
      </details>
      <details>
        <summary>Method and IPL evidence</summary>
        <p>IPL 2025 contributes 40% and IPL 2026 contributes 60% when both seasons have evidence. Single-season evidence reduces confidence. Small samples are pulled toward a conservative rubric estimate. Category scores use provisional V6 baselines and player impacts. Squad changes are scored against the baseline after recalculating the XI and bench.</p>
        <p>Fielding is provisional. Phase figures use regular innings and scheduled overs 1–6, 7–15 and 16–20. The Impact recommendation is a substitute outside the XI and uses the overseas limit of four.</p>
        <ul>{report.seasons.map(s => <li key={s.year}><a href={s.completionSource}>IPL {s.year}</a> · {s.verifiedMatches}/{s.archiveMatches} archived matches passed verification</li>)}</ul>
        <p>Ball-by-ball source <a href={report.source}>Cricsheet</a> under <a href="https://opendatacommons.org/licenses/by/1-0/">ODC Attribution 1.0</a>. Checked {report.checkedAt} · {report.version}</p>
      </details>
    </>}
  </section>;
}
