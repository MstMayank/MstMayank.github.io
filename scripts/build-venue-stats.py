#!/usr/bin/env python3
"""Build venue-stats-<competition>.json for venues.html from Cricsheet ball-by-ball data.

    python scripts/build-venue-stats.py                  # IPL, downloads ipl_json.zip
    python scripts/build-venue-stats.py --competition wpl
    python scripts/build-venue-stats.py --zip path/to/ipl_json.zip

Venue names are merged with VENUE_ALIASES, the same list Player Battle uses (venueAliases in
player-battle.js; a test keeps the two in step). Averages, par scores and chase/toss rates
leave out no-result and rain-reduced (D/L) matches, and super overs are never counted.
Bowler type (pace or spin) is not in Cricsheet, so there is no pace/spin split yet.
"""
import argparse
import json
import re
import statistics
import tempfile
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {'ipl': ('ipl_json.zip', 'IPL'), 'wpl': ('wpl_json.zip', 'WPL')}
RECENT_SEASONS = 3
TOP = 5

# Keep in step with venueAliases in player-battle.js (tests/test_venue_stats.py checks this).
VENUE_ALIASES = [
    "Rajiv Gandhi International Stadium",
    "Narendra Modi Stadium|Sardar Patel Stadium",
    "Maharashtra Cricket Association Stadium|Subrata Roy Sahara Stadium",
    "M Chinnaswamy Stadium",
    "Wankhede Stadium",
    "Eden Gardens",
    "Arun Jaitley Stadium|Feroz Shah Kotla",
    "Punjab Cricket Association IS Bindra Stadium|Punjab Cricket Association Stadium",
    "MA Chidambaram Stadium",
    "Sawai Mansingh Stadium",
    "Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium|Andhra Cricket Association-Visakhapatnam District Cricket Association Stadium",
    "Sheikh Zayed Stadium|Zayed Cricket Stadium",
    "Brabourne Stadium",
    "Dr DY Patil Sports Academy",
    "Himachal Pradesh Cricket Association Stadium",
    "Maharaja Yadavindra Singh International Cricket Stadium",
    "Shaheed Veer Narayan Singh International Stadium",
]

# Franchise renames, so a team's record at a venue is not split across names.
TEAM_NAMES = {
    'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
    'Delhi Daredevils': 'Delhi Capitals',
    'Kings XI Punjab': 'Punjab Kings',
    'Rising Pune Supergiants': 'Rising Pune Supergiant',
}

BOWLER_WICKETS = {'bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket'}
PHASES = ((0, 6), (6, 15), (15, 20))  # overs 1-6, 7-15, 16-20


def venue_label(name):
    """Same rule as venueLabel() in player-battle.js."""
    label = re.sub(r'^M\.', 'M ', name.split(',')[0])
    for group in VENUE_ALIASES:
        names = group.split('|')
        if label in names:
            return names[0]
    return name


def slugify(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def team(name):
    return TEAM_NAMES.get(name, name)


def legal(delivery):
    extras = delivery.get('extras', {})
    return 'wides' not in extras and 'noballs' not in extras


def innings_summary(innings):
    """Totals for one innings, plus the score at the end of overs 6 and 15 and per-phase totals."""
    runs = wickets = balls = 0
    at = {}
    phases = [{'runs': 0, 'balls': 0, 'wickets': 0, 'boundaries': 0} for _ in PHASES]
    batters = defaultdict(lambda: {'runs': 0, 'balls': 0, 'out': False})
    bowlers = defaultdict(lambda: {'runs': 0, 'balls': 0, 'wickets': 0})
    for over in innings.get('overs', []):
        number = over['over']
        phase = next(i for i, (start, end) in enumerate(PHASES) if start <= number < end) if number < 20 else 2
        for delivery in over['deliveries']:
            total = delivery['runs']['total']
            extras = delivery.get('extras', {})
            runs += total
            phases[phase]['runs'] += total
            batter = batters[delivery['batter']]
            batter['runs'] += delivery['runs']['batter']
            if 'wides' not in extras:
                batter['balls'] += 1
            if delivery['runs']['batter'] in (4, 6) and not delivery['runs'].get('non_boundary'):
                phases[phase]['boundaries'] += 1
            bowler = bowlers[delivery['bowler']]
            bowler['runs'] += delivery['runs']['batter'] + extras.get('wides', 0) + extras.get('noballs', 0)
            if legal(delivery):
                balls += 1
                phases[phase]['balls'] += 1
                bowler['balls'] += 1
            for wicket in delivery.get('wickets', []):
                wickets += 1
                phases[phase]['wickets'] += 1
                batters[wicket['player_out']]['out'] = True
                if wicket['kind'] in BOWLER_WICKETS:
                    bowler['wickets'] += 1
        if number == 5:
            at[6] = (runs, wickets)
        if number == 14:
            at[15] = (runs, wickets)
    at.setdefault(6, (runs, wickets))
    at.setdefault(15, (runs, wickets))
    return {'runs': runs, 'wickets': wickets, 'balls': balls, 'at': at, 'phases': phases,
            'batters': batters, 'bowlers': bowlers, 'team': team(innings['team'])}


def matches_from_zip(path):
    with zipfile.ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            if name.endswith('.json'):
                yield name[:-5], json.loads(archive.read(name))


def season_key(record):
    """The calendar year the match was played. Cricsheet labels IPL 2008 as "2007/08"."""
    return record['date'][:4]


def empty_block():
    return {'matches': [], 'innings': [], 'teams': defaultdict(lambda: {'played': 0, 'won': 0, 'lost': 0}),
            'batters': defaultdict(lambda: {'runs': 0, 'balls': 0, 'innings': 0, 'outs': 0, 'best': 0}),
            'bowlers': defaultdict(lambda: {'wickets': 0, 'balls': 0, 'runs': 0, 'innings': 0})}


def add_match(block, record):
    block['matches'].append(record)
    for side in record['teams']:
        block['teams'][side]['played'] += 1
        if record['winner'] == side:
            block['teams'][side]['won'] += 1
        elif record['winner'] and record['result'] == 'win':
            block['teams'][side]['lost'] += 1
    for innings in record['innings']:
        block['innings'].append((record, innings))
        for name, stats in innings['batters'].items():
            row = block['batters'][name]
            row['runs'] += stats['runs']
            row['balls'] += stats['balls']
            row['innings'] += 1
            row['outs'] += stats['out']
            row['best'] = max(row['best'], stats['runs'])
        for name, stats in innings['bowlers'].items():
            row = block['bowlers'][name]
            row['wickets'] += stats['wickets']
            row['balls'] += stats['balls']
            row['runs'] += stats['runs']
            row['innings'] += 1


def rounded(value, digits=1):
    return None if value is None else round(value, digits)


def ratio(numerator, denominator, multiplier=1):
    return numerator * multiplier / denominator if denominator else None


def summarise(block):
    """Turn one venue's matches into the numbers venues.html shows."""
    matches = block['matches']
    full = [m for m in matches if m['result'] in ('win', 'tie') and not m['reduced'] and len(m['innings']) >= 2]
    decided = [m for m in full if m['result'] == 'win']
    first = [m['innings'][0] for m in full]
    second = [m['innings'][1] for m in full]
    chase_wins = sum(1 for m in decided if m['winner'] == m['innings'][1]['team'])
    tossed = [m for m in matches if m['toss_winner'] and m['result'] == 'win']
    phase_rows = []
    counted = [innings for m, innings in block['innings'] if not m['reduced'] and m['result'] != 'no result']
    for index in range(len(PHASES)):
        runs = sum(i['phases'][index]['runs'] for i in counted)
        balls = sum(i['phases'][index]['balls'] for i in counted)
        wickets = sum(i['phases'][index]['wickets'] for i in counted)
        boundaries = sum(i['phases'][index]['boundaries'] for i in counted)
        reached = sum(1 for i in counted if i['phases'][index]['balls'])
        phase_rows.append({'runRate': rounded(ratio(runs, balls, 6), 2), 'wicketsPerInnings': rounded(ratio(wickets, reached), 2),
                           'boundaryPct': rounded(ratio(boundaries, balls, 100)), 'innings': reached})
    completed = [(m, i) for m, i in block['innings'] if not m['reduced'] and (i['wickets'] >= 10 or i['balls'] >= 120)]

    def total(entry):
        m, i = entry
        return {'runs': i['runs'], 'wickets': i['wickets'], 'team': i['team'],
                'opponent': next((t for t in m['teams'] if t != i['team']), ''), 'date': m['date'], 'season': m['season'], 'matchId': m['id']}

    highest = sorted(block['innings'], key=lambda e: (-e[1]['runs'], e[0]['date']))[:3]
    lowest = sorted(completed, key=lambda e: (e[1]['runs'], e[0]['date']))[:3]
    batters = sorted(block['batters'].items(), key=lambda kv: (-kv[1]['runs'], kv[1]['balls'], kv[0]))[:TOP]
    bowlers = sorted(block['bowlers'].items(), key=lambda kv: (-kv[1]['wickets'], ratio(kv[1]['runs'], kv[1]['balls']) or 99, kv[0]))[:TOP]
    return {
        'matches': len(matches),
        'counted': len(full),
        'firstInnings': {'average': rounded(statistics.mean(i['runs'] for i in first)) if first else None,
                         'median': rounded(statistics.median(i['runs'] for i in first)) if first else None},
        'secondInnings': {'average': rounded(statistics.mean(i['runs'] for i in second)) if second else None},
        'par': {str(over): {'runs': rounded(statistics.mean(i['at'][over][0] for i in first)) if first else None,
                            'wickets': rounded(statistics.mean(i['at'][over][1] for i in first)) if first else None}
                for over in (6, 15)},
        'results': {'decided': len(decided), 'chaseWins': chase_wins, 'defendWins': len(decided) - chase_wins,
                    'chaseWinPct': rounded(ratio(chase_wins, len(decided), 100)),
                    'ties': sum(1 for m in full if m['result'] == 'tie'),
                    'noResult': sum(1 for m in matches if m['result'] == 'no result'),
                    'reduced': sum(1 for m in matches if m['reduced'])},
        'toss': {'fieldFirstPct': rounded(ratio(sum(1 for m in matches if m['toss_decision'] == 'field'), sum(1 for m in matches if m['toss_decision']), 100)),
                 'tossWinnerWonPct': rounded(ratio(sum(1 for m in tossed if m['toss_winner'] == m['winner']), len(tossed), 100))},
        'phases': phase_rows,
        'highest': [total(e) for e in highest],
        'lowest': [total(e) for e in lowest],
        'teams': sorted(({'team': name, **stats, 'winPct': rounded(ratio(stats['won'], stats['won'] + stats['lost'], 100))}
                         for name, stats in block['teams'].items()), key=lambda t: (-t['played'], t['team'])),
        'topBatters': [{'name': name, 'runs': s['runs'], 'balls': s['balls'], 'innings': s['innings'], 'best': s['best'],
                        'strikeRate': rounded(ratio(s['runs'], s['balls'], 100)), 'average': rounded(ratio(s['runs'], s['outs']))}
                       for name, s in batters],
        'topBowlers': [{'name': name, 'wickets': s['wickets'], 'balls': s['balls'], 'runs': s['runs'],
                        'economy': rounded(ratio(s['runs'], s['balls'], 6), 2), 'average': rounded(ratio(s['runs'], s['wickets']))}
                       for name, s in bowlers if s['wickets']],
    }


def match_record(match_id, match):
    info = match['info']
    outcome = info.get('outcome', {})
    innings = [innings_summary(i) for i in match.get('innings', []) if not i.get('super_over')]
    if 'winner' in outcome:
        result, winner = 'win', team(outcome['winner'])
    elif outcome.get('result') == 'tie':
        # A tie settled by a super over is listed under 'eliminator'.
        result, winner = 'tie', team(outcome['eliminator']) if 'eliminator' in outcome else None
    else:
        result, winner = 'no result', None
    toss = info.get('toss', {})
    return {
        'id': match_id, 'date': info['dates'][0], 'season': info['dates'][0][:4],
        'venue': venue_label(info['venue']), 'rawVenue': info['venue'], 'city': info.get('city'),
        'teams': [team(t) for t in info['teams']], 'result': result, 'winner': winner,
        'reduced': 'method' in outcome or any(i.get('target', {}).get('overs', 20) < 20 for i in match.get('innings', [])),
        'toss_winner': team(toss['winner']) if 'winner' in toss else None, 'toss_decision': toss.get('decision'),
        'innings': innings,
    }


def build(zip_path, competition):
    records = [match_record(match_id, match) for match_id, match in matches_from_zip(zip_path)]
    seasons = sorted({season_key(r) for r in records})
    recent = set(seasons[-RECENT_SEASONS:])
    by_venue = defaultdict(list)
    for record in records:
        by_venue[record['venue']].append(record)
    venues = []
    for name, matches in by_venue.items():
        matches.sort(key=lambda m: m['date'])
        everything, latest = empty_block(), empty_block()
        for record in matches:
            add_match(everything, record)
            if season_key(record) in recent:
                add_match(latest, record)
        cities = Counter(m['city'] for m in matches if m['city'])
        venues.append({
            'name': name,
            'slug': slugify(name),
            'city': matches[-1]['city'] or (cities.most_common(1)[0][0] if cities else None),
            'names': sorted({m['rawVenue'] for m in matches}),
            'firstMatch': matches[0]['date'], 'lastMatch': matches[-1]['date'],
            'seasons': sorted({season_key(m) for m in matches}),
            'all': summarise(everything),
            'recent': summarise(latest) if latest['matches'] else None,
        })
    venues.sort(key=lambda v: (-v['all']['matches'], v['name']))
    slugs = Counter(v['slug'] for v in venues)
    if any(count > 1 for count in slugs.values()):
        raise ValueError(f'Duplicate venue slugs: {[s for s, c in slugs.items() if c > 1]}')
    return {
        'version': 1,
        'competition': competition,
        'label': SOURCES[competition][1],
        'generated': date.today().isoformat(),
        'source': 'Cricsheet (cricsheet.org) ball-by-ball data',
        'matches': len(records),
        'recentSeasons': sorted(recent),
        'venues': venues,
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
    out = ROOT / f'venue-stats-{args.competition}.json'
    out.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Wrote {out.name}: {len(data["venues"])} venues from {data["matches"]} matches')


if __name__ == '__main__':
    main()
