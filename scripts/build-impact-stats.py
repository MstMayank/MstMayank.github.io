#!/usr/bin/env python3
"""Build impact-<competition>.json: pressure and impact numbers per player, from Cricsheet.

    python scripts/build-impact-stats.py                  # IPL, downloads ipl_json.zip
    python scripts/build-impact-stats.py --competition wpl
    python scripts/build-impact-stats.py --zip path/to/ipl_json.zip

Definitions (also shown on the page):
- Pressure batting: balls faced in a chase when the required rate is above 10 an over, or after
  the batting side has lost 3+ wickets inside the first 8 overs.
- Pressure bowling: legal balls in overs 16-20 of close matches (won by under 15 runs or by
  2 wickets or fewer, or tied).
- Match-winning knock: 30+ runs at a strike rate of 150+ in a winning chase, or the top score
  (30+) for the winning side.
- Runs above expected (batting): runs scored minus what an average batter scores off the same
  balls, given the over and wickets down. Shown per 100 balls.
- Runs saved (bowling): what an average bowler concedes off the same balls minus what this
  bowler conceded. Shown per 24 balls (four overs). Wickets are not valued in either number.
  "Average" means the same period: all seasons for the all-time numbers, the last 3 seasons for
  the recent ones.
Rain-reduced (D/L) and no-result matches are left out; super overs are never counted.
"""
import argparse
import importlib.util
import json
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
MIN_BALLS = 60          # players below this (batting balls / bowling balls) are left out
RECENT_SEASONS = 3


def legal(delivery):
    extras = delivery.get('extras', {})
    return 'wides' not in extras and 'noballs' not in extras


def balls_of(match):
    """Yield (innings_index, innings, over, delivery, state) for every ball, with the match state
    before the ball: score, wickets, legal balls bowled and (in a chase) the target."""
    innings_list = [i for i in match.get('innings', []) if not i.get('super_over')]
    for index, innings in enumerate(innings_list):
        target = innings.get('target', {}).get('runs') if index == 1 else None
        if index == 1 and target is None and innings_list:
            target = sum(d['runs']['total'] for o in innings_list[0]['overs'] for d in o['deliveries']) + 1
        runs = wickets = legal_balls = 0
        for over in innings.get('overs', []):
            for delivery in over['deliveries']:
                yield index, innings, over['over'], delivery, {'runs': runs, 'wickets': wickets, 'balls': legal_balls, 'target': target}
                runs += delivery['runs']['total']
                wickets += len(delivery.get('wickets', []))
                legal_balls += legal(delivery)


def pressure_batting(over, state):
    if state['target'] is not None:
        left = 120 - state['balls']
        need = state['target'] - state['runs']
        if left > 0 and need / left * 6 > 10:
            return True
    return over < 8 and state['wickets'] >= 3


def close_match(info):
    outcome = info.get('outcome', {})
    if outcome.get('result') == 'tie':
        return True
    by = outcome.get('by', {})
    return ('runs' in by and by['runs'] < 15) or ('wickets' in by and by['wickets'] <= 2)


def usable(info):
    outcome = info.get('outcome', {})
    return 'method' not in outcome and outcome.get('result') != 'no result' and ('winner' in outcome or outcome.get('result') == 'tie')


def expected_tables(matches):
    """Average batter runs per ball and runs conceded per legal ball, by (over, wickets down)."""
    bat = defaultdict(lambda: [0, 0])
    bowl = defaultdict(lambda: [0, 0])
    for _, match in matches:
        if not usable(match['info']):
            continue
        for _, _, over, delivery, state in balls_of(match):
            key = (min(over, 19), min(state['wickets'], 9))
            extras = delivery.get('extras', {})
            if 'wides' not in extras:
                bat[key][0] += delivery['runs']['batter']
                bat[key][1] += 1
            if legal(delivery):
                bowl[key][0] += delivery['runs']['batter'] + extras.get('noballs', 0) + extras.get('wides', 0)
                bowl[key][1] += 1
    overall_bat = sum(v[0] for v in bat.values()) / max(1, sum(v[1] for v in bat.values()))
    overall_bowl = sum(v[0] for v in bowl.values()) / max(1, sum(v[1] for v in bowl.values()))

    def lookup(table, fallback):
        # Thin cells (late overs with many wickets down) fall back to the over average.
        by_over = defaultdict(lambda: [0, 0])
        for (over, _), (runs, balls) in table.items():
            by_over[over][0] += runs
            by_over[over][1] += balls
        def get(over, wickets):
            key = (min(over, 19), min(wickets, 9))
            runs, balls = table.get(key, (0, 0))
            if balls >= 200:
                return runs / balls
            runs, balls = by_over.get(key[0], (0, 0))
            return runs / balls if balls else fallback
        return get
    return lookup(bat, overall_bat), lookup(bowl, overall_bowl)


def empty_player():
    return {'bat': {'runs': 0, 'balls': 0, 'outs': 0, 'expected': 0.0},
            'pressureBat': {'runs': 0, 'balls': 0, 'outs': 0},
            'bowl': {'runs': 0, 'balls': 0, 'wickets': 0, 'expected': 0.0},
            'pressureBowl': {'runs': 0, 'balls': 0, 'wickets': 0},
            'winningKnocks': []}


def collect(matches, expected_bat, expected_bowl, seasons=None):
    players = defaultdict(empty_player)
    for match_id, match in matches:
        info = match['info']
        if not usable(info) or (seasons and info['dates'][0][:4] not in seasons):
            continue
        close = close_match(info)
        winner = info.get('outcome', {}).get('winner')
        innings_runs = defaultdict(lambda: defaultdict(lambda: [0, 0]))  # innings index -> batter -> [runs, balls]
        chase_index = None
        for index, innings, over, delivery, state in balls_of(match):
            extras = delivery.get('extras', {})
            batter, bowler = delivery['batter'], delivery['bowler']
            if state['target'] is not None:
                chase_index = index
            if 'wides' not in extras:
                row = players[batter]['bat']
                row['runs'] += delivery['runs']['batter']
                row['balls'] += 1
                row['expected'] += expected_bat(over, state['wickets'])
                innings_runs[(index, innings['team'])][batter][0] += delivery['runs']['batter']
                innings_runs[(index, innings['team'])][batter][1] += 1
                if pressure_batting(over, state):
                    p = players[batter]['pressureBat']
                    p['runs'] += delivery['runs']['batter']
                    p['balls'] += 1
            conceded = delivery['runs']['batter'] + extras.get('wides', 0) + extras.get('noballs', 0)
            row = players[bowler]['bowl']
            row['runs'] += conceded
            if legal(delivery):
                row['balls'] += 1
                row['expected'] += expected_bowl(over, state['wickets'])
            death_close = close and over >= 15
            if death_close:
                p = players[bowler]['pressureBowl']
                p['runs'] += conceded
                p['balls'] += legal(delivery)
            for wicket in delivery.get('wickets', []):
                if wicket['player_out'] in (batter, delivery.get('non_striker')):
                    players[wicket['player_out']]['bat']['outs'] += 1
                    if pressure_batting(over, state):
                        players[wicket['player_out']]['pressureBat']['outs'] += 1
                if wicket['kind'] in venue_stats.BOWLER_WICKETS:
                    players[bowler]['bowl']['wickets'] += 1
                    if death_close:
                        players[bowler]['pressureBowl']['wickets'] += 1
        if not winner:
            continue
        for (index, side), batters in innings_runs.items():
            if side != winner:
                continue
            top = max(runs for runs, _ in batters.values())
            for name, (runs, balls) in batters.items():
                chase_knock = index == chase_index and runs >= 30 and balls and runs / balls * 100 >= 150
                top_score = runs >= 30 and runs == top
                if chase_knock or top_score:
                    players[name]['winningKnocks'].append({'runs': runs, 'balls': balls, 'date': info['dates'][0],
                                                           'against': venue_stats.team(next((t for t in info['teams'] if t != side), '')), 'matchId': match_id})
    return players


def ratio(numerator, denominator, multiplier=1):
    return round(numerator * multiplier / denominator, 2) if denominator else None


def summarise(players):
    out = {}
    for name, p in players.items():
        bat, bowl = p['bat'], p['bowl']
        if bat['balls'] < MIN_BALLS and bowl['balls'] < MIN_BALLS:
            continue
        entry = {}
        if bat['balls'] >= MIN_BALLS:
            pb = p['pressureBat']
            entry['batting'] = {
                'balls': bat['balls'], 'runs': bat['runs'], 'strikeRate': ratio(bat['runs'], bat['balls'], 100),
                'aboveExpectedPer100': ratio(bat['runs'] - bat['expected'], bat['balls'], 100),
                'pressure': {'balls': pb['balls'], 'runs': pb['runs'], 'outs': pb['outs'],
                             'strikeRate': ratio(pb['runs'], pb['balls'], 100), 'average': ratio(pb['runs'], pb['outs'])},
                'winningKnocks': len(p['winningKnocks']),
                'bestKnocks': sorted(p['winningKnocks'], key=lambda k: (-k['runs'], k['balls']))[:3],
            }
        if bowl['balls'] >= MIN_BALLS:
            pw = p['pressureBowl']
            entry['bowling'] = {
                'balls': bowl['balls'], 'runs': bowl['runs'], 'wickets': bowl['wickets'],
                'economy': ratio(bowl['runs'], bowl['balls'], 6),
                'runsSavedPer24': ratio(bowl['expected'] - bowl['runs'], bowl['balls'], 24),
                'pressure': {'balls': pw['balls'], 'runs': pw['runs'], 'wickets': pw['wickets'],
                             'economy': ratio(pw['runs'], pw['balls'], 6)},
            }
        out[name] = entry
    return dict(sorted(out.items()))


def build(zip_path, competition):
    matches = list(venue_stats.matches_from_zip(zip_path))
    expected_bat, expected_bowl = expected_tables(matches)
    seasons = sorted({m['info']['dates'][0][:4] for _, m in matches})
    recent = set(seasons[-RECENT_SEASONS:])
    # The recent numbers are compared with recent scoring, not all-time averages.
    recent_bat, recent_bowl = expected_tables([m for m in matches if m[1]['info']['dates'][0][:4] in recent])
    return {
        'version': 1, 'competition': competition, 'label': SOURCES[competition][1],
        'generated': date.today().isoformat(), 'source': 'Cricsheet (cricsheet.org) ball-by-ball data',
        'minBalls': MIN_BALLS, 'recentSeasons': sorted(recent),
        'all': summarise(collect(matches, expected_bat, expected_bowl)),
        'recent': summarise(collect(matches, recent_bat, recent_bowl, recent)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--competition', choices=sorted(SOURCES), default='ipl')
    parser.add_argument('--zip', type=Path, help='Use a downloaded Cricsheet zip instead of fetching it')
    args = parser.parse_args()
    zip_path = args.zip
    if not zip_path:
        zip_path = Path(tempfile.gettempdir()) / SOURCES[args.competition][0]
        urllib.request.urlretrieve(f'https://cricsheet.org/downloads/{SOURCES[args.competition][0]}', zip_path)
    data = build(zip_path, args.competition)
    out = ROOT / f'impact-{args.competition}.json'
    out.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Wrote {out.name}: {len(data["all"])} players (all), {len(data["recent"])} (recent)')


if __name__ == '__main__':
    main()
