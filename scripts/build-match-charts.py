#!/usr/bin/env python3
"""Build the data for match.html (worm, Manhattan and win-probability charts) from Cricsheet.

    python scripts/build-match-charts.py                  # IPL, downloads ipl_json.zip
    python scripts/build-match-charts.py --competition wpl
    python scripts/build-match-charts.py --zip path/to/ipl_json.zip

Writes:
- match-index-<competition>.json: one row per match (for the match list) and the fitted
  win-probability model.
- matches/<competition>/<season>.json: ball-by-ball data per match, loaded on demand.
  Each ball is three numbers: over (0-based), runs off the ball, flags (1 = legal ball,
  2 = wicket).

Win probability (chasing side, before each ball) is a logistic model fitted on every chase ball
in completed, non-rain-reduced matches. Features: required run rate (capped at 36), wickets in
hand / 10, balls left / 120, and required rate x balls left / 120. It ignores who is batting,
the venue and the toss, so it is a simple guide, not a prediction.
"""
import argparse
import importlib.util
import json
import math
import tempfile
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('venue_stats', ROOT / 'scripts/build-venue-stats.py')
venue_stats = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(venue_stats)
SOURCES = venue_stats.SOURCES
FEATURES = ['bias', 'requiredRate', 'wicketsInHand/10', 'ballsLeft/120', 'requiredRate*ballsLeft/120']


def legal(delivery):
    extras = delivery.get('extras', {})
    return 'wides' not in extras and 'noballs' not in extras


def features(need, balls_left, wickets_in_hand):
    rate = min(36.0, need / balls_left * 6)
    left = balls_left / 120
    return [1.0, rate, wickets_in_hand / 10, left, rate * left]


def probability(coef, need, balls_left, wickets_in_hand):
    if need <= 0:
        return 1.0
    if balls_left <= 0 or wickets_in_hand <= 0:
        return 0.0
    z = sum(c * x for c, x in zip(coef, features(need, balls_left, wickets_in_hand)))
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def chase_states(match):
    """(need, balls_left, wickets_in_hand) before each ball of a chase, with the result label."""
    info = match['info']
    outcome = info.get('outcome', {})
    innings = [i for i in match.get('innings', []) if not i.get('super_over')]
    if len(innings) < 2 or 'method' in outcome or 'winner' not in outcome:
        return None, []
    chase = innings[1]
    target = chase.get('target', {}).get('runs') or sum(d['runs']['total'] for o in innings[0]['overs'] for d in o['deliveries']) + 1
    won = outcome['winner'] == chase['team']
    runs = wickets = balls = 0
    states = []
    for over in chase.get('overs', []):
        for delivery in over['deliveries']:
            states.append((target - runs, 120 - balls, 10 - wickets))
            runs += delivery['runs']['total']
            wickets += len(delivery.get('wickets', []))
            balls += legal(delivery)
    return won, states


def solve(matrix, vector):
    """Gaussian elimination for the small Newton step."""
    n = len(vector)
    a = [row[:] + [vector[i]] for i, row in enumerate(matrix)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(a[r][col]))
        a[col], a[pivot] = a[pivot], a[col]
        if abs(a[col][col]) < 1e-12:
            continue
        for r in range(n):
            if r != col:
                factor = a[r][col] / a[col][col]
                a[r] = [x - factor * y for x, y in zip(a[r], a[col])]
    return [a[i][n] / a[i][i] if abs(a[i][i]) > 1e-12 else 0.0 for i in range(n)]


def fit(samples, iterations=25, ridge=1e-3):
    """Logistic regression by Newton's method; samples are (features, label)."""
    coef = [0.0] * len(FEATURES)
    for _ in range(iterations):
        grad = [0.0] * len(coef)
        hess = [[0.0] * len(coef) for _ in coef]
        for x, y in samples:
            z = max(-30, min(30, sum(c * v for c, v in zip(coef, x))))
            p = 1 / (1 + math.exp(-z))
            w = p * (1 - p)
            for i, xi in enumerate(x):
                grad[i] += (y - p) * xi
                for j in range(i, len(x)):
                    hess[i][j] += w * xi * x[j]
        for i in range(len(coef)):
            grad[i] -= ridge * coef[i]
            hess[i][i] += ridge
            for j in range(i):
                hess[i][j] = hess[j][i]
        step = solve(hess, grad)
        coef = [c + s for c, s in zip(coef, step)]
        if max(abs(s) for s in step) < 1e-7:
            break
    return coef


def model(matches):
    samples = []
    for _, match in matches:
        won, states = chase_states(match)
        if won is None:
            continue
        for need, left, wih in states:
            if need > 0 and left > 0 and wih > 0:
                samples.append((features(need, left, wih), 1.0 if won else 0.0))
    coef = fit(samples)
    # Calibration check: mean predicted vs actual win rate per probability decile.
    buckets = defaultdict(lambda: [0, 0.0, 0.0])
    for x, y in samples:
        p = 1 / (1 + math.exp(-max(-30, min(30, sum(c * v for c, v in zip(coef, x))))))
        b = buckets[min(9, int(p * 10))]
        b[0] += 1; b[1] += p; b[2] += y
    calibration = [[k / 10, round(v[1] / v[0], 3), round(v[2] / v[0], 3), v[0]] for k, v in sorted(buckets.items())]
    return {'features': FEATURES, 'coef': [round(c, 6) for c in coef], 'samples': len(samples), 'calibration': calibration}


def match_data(match_id, match):
    info = match['info']
    record = venue_stats.match_record(match_id, match)
    innings_out = []
    for innings in [i for i in match.get('innings', []) if not i.get('super_over')]:
        balls, wickets = [], []
        batters = defaultdict(lambda: [0, 0, 0])
        bowlers = defaultdict(lambda: [0, 0, 0])
        for over in innings.get('overs', []):
            for delivery in over['deliveries']:
                extras = delivery.get('extras', {})
                flags = (1 if legal(delivery) else 0) | (2 if delivery.get('wickets') else 0)
                balls += [over['over'], delivery['runs']['total'], flags]
                b = batters[delivery['batter']]
                b[0] += delivery['runs']['batter']
                if 'wides' not in extras:
                    b[1] += 1
                w = bowlers[delivery['bowler']]
                w[0] += legal(delivery)
                w[1] += delivery['runs']['batter'] + extras.get('wides', 0) + extras.get('noballs', 0)
                for wicket in delivery.get('wickets', []):
                    batters[wicket['player_out']][2] = 1
                    if wicket['kind'] in venue_stats.BOWLER_WICKETS:
                        w[2] += 1
                    wickets.append([len(balls) // 3 - 1, wicket['player_out'], wicket['kind'], delivery['bowler']])
        entry = {'team': venue_stats.team(innings['team']), 'balls': balls, 'wickets': wickets,
                 'batters': sorted(([n, *v] for n, v in batters.items()), key=lambda r: (-r[1], r[2]))[:4],
                 'bowlers': sorted(([n, *v] for n, v in bowlers.items()), key=lambda r: (-r[3], r[2]))[:3]}
        if 'target' in innings:
            entry['target'] = innings['target'].get('runs')
            entry['targetOvers'] = innings['target'].get('overs')
        innings_out.append(entry)
    toss = info.get('toss', {})
    return {'id': match_id, 'date': record['date'], 'season': record['season'], 'venue': record['venue'],
            'venueSlug': venue_stats.slugify(record['venue']), 'city': record['city'], 'teams': record['teams'],
            'result': record['result'], 'winner': record['winner'], 'margin': record['margin'], 'reduced': record['reduced'],
            'toss': [venue_stats.team(toss['winner']) if 'winner' in toss else None, toss.get('decision')],
            'event': info.get('event', {}).get('stage') or (f"Match {info['event']['match_number']}" if info.get('event', {}).get('match_number') else ''),
            'innings': innings_out}


def build(zip_path, competition, out_root=ROOT):
    matches = list(venue_stats.matches_from_zip(zip_path))
    by_season = defaultdict(dict)
    index = []
    for match_id, match in matches:
        data = match_data(match_id, match)
        by_season[data['season']][match_id] = data
        index.append([match_id, data['date'], data['season'], *data['teams'], data['winner'], data['result'], data['margin'], data['venue']])
    index.sort(key=lambda row: (row[1], row[0]), reverse=True)
    folder = out_root / 'matches' / competition
    folder.mkdir(parents=True, exist_ok=True)
    for season, items in by_season.items():
        (folder / f'{season}.json').write_text(json.dumps({'season': season, 'matches': items}, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    payload = {'version': 1, 'competition': competition, 'label': SOURCES[competition][1], 'generated': date.today().isoformat(),
               'source': 'Cricsheet (cricsheet.org) ball-by-ball data',
               'columns': ['id', 'date', 'season', 'teamA', 'teamB', 'winner', 'result', 'margin', 'venue'],
               'winModel': model(matches), 'matches': index}
    (out_root / f'match-index-{competition}.json').write_text(json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    return payload, by_season


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--competition', choices=sorted(SOURCES), default='ipl')
    parser.add_argument('--zip', type=Path, help='Use a downloaded Cricsheet zip instead of fetching it')
    args = parser.parse_args()
    zip_path = args.zip
    if not zip_path:
        zip_path = Path(tempfile.gettempdir()) / SOURCES[args.competition][0]
        urllib.request.urlretrieve(f'https://cricsheet.org/downloads/{SOURCES[args.competition][0]}', zip_path)
    payload, by_season = build(zip_path, args.competition)
    print(f'Wrote match-index-{args.competition}.json ({len(payload["matches"])} matches) and {len(by_season)} season files; '
          f'model fitted on {payload["winModel"]["samples"]} balls')


if __name__ == '__main__':
    main()
