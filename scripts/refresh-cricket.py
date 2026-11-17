#!/usr/bin/env python3
"""Refresh international archives and date-indexed cricket history without API keys.
Inputs: Cricsheet JSON (ODC-BY); existing curated scorecards are preserved.
Run from repo root. Outputs are staged in memory before atomic file replacement.
"""
import argparse
from collections import defaultdict
from datetime import date, datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import time
import urllib.request
from zoneinfo import ZoneInfo
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
FORMATS = ('Test', 'ODI', 'T20I')
BOWLER_WICKETS = {'bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket'}


def load_archive(path):
    """Read a gzip-compressed JSON archive (archive-players-<format>.bin)."""
    try:
        result = json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, EOFError, ValueError) as error:
        raise ValueError(f'Invalid archive: {path}') from error
    if not isinstance(result, dict) or not result.get('rows') or not isinstance(result.get('aliases'), dict):
        raise ValueError(f'Empty or invalid archive: {path}')
    return result


def encode_archive(key, data):
    """Gzip bytes served as-is to the Record Book (no base64 wrapper)."""
    raw = json.dumps(data, separators=(',', ':'), ensure_ascii=True).encode()
    return gzip.compress(raw, mtime=0)


def match_format(info):
    if info.get('team_type') != 'international':
        return None
    key = info.get('match_type')
    return 'T20I' if key in {'T20', 'IT20', 'T20I'} else key if key in FORMATS else None


def match_rows(match, match_id, today):
    info = match['info']
    key = match_format(info)
    dates = sorted(info.get('dates', []))
    if not key or not dates or dates[-1] > today.isoformat() or not info.get('outcome'):
        return None
    if len(info.get('teams', [])) != 2:
        raise ValueError(f'Invalid teams: {match_id}')
    rows = []
    people = info.get('registry', {}).get('people', {})
    for innings in match.get('innings', []):
        if innings.get('super_over'):
            continue
        team = innings['team']
        opponent = next(t for t in info['teams'] if t != team)
        batting, bowling = defaultdict(int), defaultdict(lambda: [0, 0])
        # pre/post are the only innings-level penalty fields; avoid double-counting targets.
        penalty = innings.get('penalty_runs', {})
        total = penalty.get('pre', 0) + penalty.get('post', 0)
        for over in innings.get('overs', []):
            for ball in over['deliveries']:
                runs, extras = ball['runs'], ball.get('extras', {})
                total += runs['total']
                batting[ball['batter']] += runs['batter']
                figures = bowling[ball['bowler']]
                figures[1] += runs['total'] - sum(extras.get(k, 0) for k in ('byes', 'legbyes', 'penalty'))
                figures[0] += sum(w['kind'] in BOWLER_WICKETS for w in ball.get('wickets', []))
        common = [dates[0], info['gender'], info.get('event', {}).get('name', ''), str(info.get('season', ''))]
        # Keep all original column positions. Match ID and innings number are appended.
        suffix = ['', match_id, len([r for r in rows if r[0] == 'Team totals']) + 1, dates[-1]]
        rows.append(['Team totals', team, team, opponent, total, 0, *common, '', *suffix])
        rows.extend(['Batting', p, team, opponent, runs, 0, *common, people.get(p, ''), *suffix] for p, runs in batting.items())
        rows.extend(['Bowling', p, opponent, team, w, runs, *common, people.get(p, ''), *suffix] for p, (w, runs) in bowling.items())
    return key, rows, people


def match_history(match, today):
    info = match['info']
    dates = sorted(info.get('dates', []))
    event = info.get('event', {})
    outcome = info.get('outcome', {})
    if not match_format(info) or not dates or dates[-1] >= today.isoformat():
        return None
    if str(event.get('stage', '')).casefold() != 'final' or not outcome.get('winner') or not event.get('name'):
        return None
    winner = outcome['winner']
    opponent = next(t for t in info['teams'] if t != winner)
    margin = outcome.get('by', {})
    detail = ' and '.join(f"{value} {unit}" for unit, value in margin.items())
    suffix = f" by {detail}" if detail else ''
    return {'date': dates[-1], 'title': f"{winner} win {event['name']}",
            'summary': f"{winner} defeated {opponent}{suffix} in the final of {event['name']}.",
            'priority': 900}


def row_key(row):
    # Legacy archives have no match IDs. Replace the whole same-day matchup together,
    # so two same-day internationals are kept when both appear in the source archive.
    return (row[6], row[7], *sorted((row[2], row[3])))


def merge_archive(old, incoming):
    incoming_keys = {row_key(row) for rows, _ in incoming.values() for row in rows}
    incoming_ids = set(incoming)
    rows = [r for r in old['rows'] if (len(r) > 12 and r[12] not in incoming_ids) or (len(r) <= 12 and row_key(r) not in incoming_keys)]
    aliases = {k: set(v) for k, v in old['aliases'].items()}
    for match_id in sorted(incoming):
        new_rows, people = incoming[match_id]
        rows.extend(new_rows)
        for name, identifier in people.items():
            aliases.setdefault(identifier, set()).add(name)
    rows.sort(key=lambda r: (r[6], r[2], r[3], str(r[12]) if len(r) > 12 else '', r[0], r[1], str(r[13]) if len(r) > 13 else ''))
    known = {r[12] for r in rows if len(r) > 12} | incoming_ids
    legacy = {row_key(r) for r in rows if len(r) <= 12}
    return {'matches': max(old['matches'], len(known) + len(legacy)), 'rows': rows,
            'aliases': {k: sorted(v) for k, v in sorted(aliases.items())}}


def history(archives, curated, today, match_events=()):
    days = defaultdict(list)
    for item in curated:
        if item['date'] < today.isoformat():
            days[item['date'][5:]].append({**item, 'priority': 10000})
    for item in match_events:
        if item['date'] < today.isoformat():
            days[item['date'][5:]].append(item)
    for key in ('ODI', 'T20I'):
        data = archives[key]
        seen = set()
        for r in data['rows']:
            if r[6] >= today.isoformat() or (len(r) > 14 and r[14] != r[6]):
                continue
            batting = r[0] == 'Batting' and r[4] >= 100
            bowling = r[0] == 'Bowling' and r[4] >= 5
            if not batting and not bowling:
                continue
            identity = (r[6], r[0], r[1], r[4], r[5], r[2], r[3])
            if identity in seen:
                continue
            seen.add(identity)
            names = data['aliases'].get(r[10], []) if len(r) > 10 else []
            # Prefer a full name when the registry supplies one, otherwise preserve identity.
            name = max([r[1], *names], key=lambda n: (len(n.split()[0]) > 2, len(n)))
            if batting:
                title = f'{name} scores {r[4]} against {r[3]}'
                detail = f'{name} scored {r[4]} for {r[2]} against {r[3]} in {key} cricket.'
                priority = r[4] + (150 if key == 'T20I' else 0)
            else:
                title = f'{name} takes {r[4]}/{r[5]} against {r[3]}'
                detail = f'{name} took {r[4]} wickets for {r[5]} runs for {r[2]} against {r[3]} in {key} cricket.'
                priority = 180 + r[4] * 20 - r[5] / 100
            gender = 'Women’s' if r[7] == 'female' else 'Men’s'
            days[r[6][5:]].append({'date': r[6], 'title': title, 'summary': detail,
                                 'competition': f'{gender} {key}', 'priority': priority})
    output = {}
    for day, events in sorted(days.items()):
        events.sort(key=lambda e: (-e['priority'], e['date'], e['title']))
        output[day] = [{k: v for k, v in e.items() if k != 'priority'} for e in events[:5]]
    return {'version': 1, 'timezone': 'Asia/Kolkata', 'days': output}


def fetch(url, path):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'TheCricketSpace-Archive/1.0'})
            with urllib.request.urlopen(request, timeout=120) as response, path.open('wb') as dest:
                while block := response.read(1024 * 1024):
                    dest.write(block)
            with ZipFile(path) as archive:
                if not any(n.endswith('.json') for n in archive.namelist()):
                    raise ValueError('Download has no matches')
            return
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, help='Reuse pre-downloaded JSON ZIPs for local checks')
    parser.add_argument('--history-only', action='store_true')
    parser.add_argument('--recent-only', action='store_true', help='Refresh recent scorecards without redownloading historical ZIPs')
    parser.add_argument('--today', type=date.fromisoformat, default=datetime.now(ZoneInfo('Asia/Kolkata')).date())
    args = parser.parse_args()
    archives = {key: load_archive(ROOT / f'archive-players-{key}.bin') for key in FORMATS}
    events_path = ROOT / 'data/cricket-history-match-events.json'
    match_events = json.loads(events_path.read_text()) if events_path.exists() else {}
    if not args.history_only and not args.recent_only:
        incoming = {key: {} for key in FORMATS}
        with tempfile.TemporaryDirectory() as temp:
            # T20 includes international T20 and IT20 naming variants; club matches are filtered out.
            for name in ('tests', 'odis', 't20s', 'it20s', 'recently_added_30', 'recently_played_30'):
                path = (args.cache / f'{name}.zip') if args.cache else Path(temp) / f'{name}.zip'
                if not path.exists():
                    fetch(f'https://cricsheet.org/downloads/{name}_json.zip', path)
                count = 0
                with ZipFile(path) as archive:
                    for filename in sorted(archive.namelist()):
                        if not filename.endswith('.json'):
                            continue
                        match = json.loads(archive.read(filename))
                        parsed = match_rows(match, Path(filename).stem, args.today)
                        if parsed:
                            key, rows, people = parsed
                            # Later recent feeds take precedence for corrected scorecards.
                            incoming[key][Path(filename).stem] = (rows, people)
                            event = match_history(match, args.today)
                            if event:
                                match_events[Path(filename).stem] = event
                            else:
                                match_events.pop(Path(filename).stem, None)
                            count += 1
                print(f'{name}: {count} completed international matches', flush=True)
        if any(not incoming[key] for key in FORMATS):
            raise ValueError('Incomplete source refresh; previous archives left intact')
        archives = {key: merge_archive(archives[key], incoming[key]) for key in FORMATS}
    recent_path = ROOT / 'data/recent-international-scorecards.json'
    recent_state = json.loads(recent_path.read_text()) if recent_path.exists() else {'matches': {}, 'pending': {}}
    if not args.history_only:
        sys.path.insert(0, str(ROOT / 'scripts'))
        from recent_scorecards import refresh_recent
        covered = {key: {r[12] for r in data['rows'] if len(r) > 12 and not (len(r) > 15 and r[15] == 'recent-scorecard')} for key, data in archives.items()}
        try:
            recent_state = refresh_recent(args.today, recent_path, covered, args.cache)
        except Exception as error:
            print(f'Recent scorecard refresh unavailable; preserving previous records: {error}', flush=True)
        for key in FORMATS:
            supplements = {identifier: item for identifier, item in recent_state['matches'].items() if item['format'] == key and item['rows'] and identifier not in covered[key]}
            # Merge row sets first, then register full names from the roster by player ID.
            archives[key] = merge_archive(archives[key], {identifier: (item['rows'], {}) for identifier, item in supplements.items()})
            aliases = archives[key]['aliases']
            for item in supplements.values():
                for identifier, names in item['aliases'].items():
                    aliases[identifier] = sorted(set(aliases.get(identifier, [])) | set(names))
            archives[key]['aliases'] = dict(sorted(aliases.items()))
    curated = json.loads((ROOT / 'data/cricket-history-curated.json').read_text())
    generated_history = history(archives, curated, args.today, match_events.values())
    if len(generated_history['days']) != 366:
        raise ValueError('History calendar is incomplete; previous files left intact')
    outputs = {ROOT / 'cricket-history.json': json.dumps(generated_history, ensure_ascii=False, indent=2, sort_keys=True) + '\n'}
    if not args.history_only:
        outputs[recent_path] = json.dumps(recent_state, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
        outputs[events_path] = json.dumps(match_events, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
        for key, data in archives.items():
            outputs[ROOT / f'archive-players-{key}.bin'] = encode_archive(key, data)
    metadata = {'version': 1, 'formats': {key: {'matches': data['matches'], 'through': max(r[6] for r in data['rows']), 'revision': hashlib.sha256(encode_archive(key, data)).hexdigest()[:16]} for key, data in archives.items()}}
    metadata['pendingScorecards'] = len(recent_state.get('pending', {})) + len(recent_state.get('discoveryPending', []))
    outputs[ROOT / 'cricket-records-status.json'] = json.dumps(metadata, indent=2) + '\n'
    for path, content in outputs.items():
        current = path.read_bytes() if path.exists() else None
        encoded = content if isinstance(content, bytes) else content.encode()
        if current != encoded:
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_bytes(encoded)
            temporary.replace(path)
    print(json.dumps(metadata), flush=True)
    print(f'History calendar: {len(generated_history["days"])} dates', flush=True)


if __name__ == '__main__':
    main()
