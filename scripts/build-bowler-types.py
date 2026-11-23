#!/usr/bin/env python3
"""Build data/bowler-types.json: pace or spin (and a sub-type) for every bowler name in the
Player Battle data, so pages can split numbers by bowler type.

    pip install pyreadr
    python scripts/build-bowler-types.py --meta player_meta.rda --zip ipl_json.zip --zip wpl_json.zip \\
        --zip t20s_json.zip --zip odis_json.zip --zip tests_json.zip

Sources:
- Bowling styles: player_meta from the cricketdata R package (Rob J Hyndman and contributors,
  GPL-3.0), https://github.com/robjhyndman/cricketdata/blob/master/data/player_meta.rda,
  originally from ESPNcricinfo. Keyed by Cricsheet player id.
- Names to ids: the "registry" in each Cricsheet match file (cricsheet.org, ODC-BY).

Names are resolved per competition (IPL, WPL, each international format and gender), because two
different players can share a scorecard name across competitions. Names that mean the same bowler
everywhere go in "players"; the rest go in "byCompetition". A name that still maps to more than
one Cricsheet id within one competition is marked "unknown" rather than guessed, and so is a player
with no style or a style that does not say pace or spin. The output records how
many names were classified and, per battle-<competition>.json, the share of legal balls bowled
by a known type, so pages can show their coverage.
"""
import argparse
import json
import re
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATTLE_KEYS = ['ipl', 'wpl', 'tests_male', 'odis_male', 't20s_male', 'tests_female', 'odis_female', 't20s_female']
SUBTYPE_LABELS = {
    'right-pace': 'Right-arm pace', 'left-pace': 'Left-arm pace',
    'off-spin': 'Off-spin', 'leg-spin': 'Leg-spin',
    'left-orthodox': 'Left-arm orthodox', 'left-wrist': 'Left-arm wrist spin',
}


def classify(style):
    """Return (type, subtype) for a cricketdata bowling_style string, or (None, None)."""
    if not style:
        return None, None
    primary = style.split(',')[0].strip().lower().replace('-', ' ')
    left = 'left' in primary
    if re.search(r'wrist|chinaman', primary):
        return 'spin', 'left-wrist' if left else 'leg-spin'
    if re.search(r'orthodox', primary):
        return 'spin', 'left-orthodox'
    if re.search(r'leg ?break|googly|leg spin', primary):
        return 'spin', 'leg-spin'
    if re.search(r'off ?break|off spin', primary):
        return 'spin', 'off-spin' if not left else 'left-orthodox'
    if re.search(r'fast|medium', primary):
        return 'pace', 'left-pace' if left else 'right-pace'
    if re.search(r'\bslow\b', primary):
        # "Right arm Slow" / "Slow left arm" without medium: a spinner.
        return 'spin', 'left-orthodox' if left else 'off-spin'
    return None, None


def load_styles(meta_path):
    import pyreadr  # only needed when building
    frame = next(iter(pyreadr.read_r(str(meta_path)).values()))
    styles = {}
    for row in frame[['cricsheet_id', 'bowling_style']].itertuples(index=False):
        if isinstance(row.cricsheet_id, str) and row.cricsheet_id and isinstance(row.bowling_style, str):
            styles[row.cricsheet_id] = row.bowling_style.strip()
    return styles


def competition_key(zip_name, info):
    """Which battle-<key>.json a Cricsheet match belongs to."""
    base = Path(zip_name).name.split('_json')[0]
    if base in ('ipl', 'wpl'):
        return base
    if base in ('tests', 'odis', 't20s'):
        return f"{base}_{info.get('gender', 'male')}"
    return base


def bowler_ids(zip_paths):
    """competition key -> bowler name -> set of Cricsheet ids, from each match's registry."""
    ids = defaultdict(lambda: defaultdict(set))
    for path in zip_paths:
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if not name.endswith('.json'):
                    continue
                match = json.loads(archive.read(name))
                info = match.get('info', {})
                people = info.get('registry', {}).get('people', {})
                key = competition_key(path, info)
                bowlers = {d['bowler'] for inn in match.get('innings', []) for over in inn.get('overs', []) for d in over['deliveries']}
                for bowler in bowlers:
                    if bowler in people:
                        ids[key][bowler].add(people[bowler])
    return ids


def describe(found, styles):
    if len(found) != 1:
        return {'type': 'unknown', 'reason': 'name used by more than one player'}
    style = styles.get(next(iter(found)), '')
    kind, sub = classify(style)
    if not kind:
        return {'type': 'unknown', 'style': style or None}
    return {'type': kind, 'sub': sub, 'style': style}


def build(styles, ids):
    """Shared entries in players; names whose meaning differs by competition in byCompetition."""
    per_key = {key: {name: describe(found, styles) for name, found in names.items()} for key, names in ids.items()}
    seen = defaultdict(list)
    for key, names in per_key.items():
        for name, info in names.items():
            seen[name].append((key, info))
    players, by_competition, counts = {}, defaultdict(dict), defaultdict(int)
    for name, entries in sorted(seen.items()):
        infos = {json.dumps(info, sort_keys=True) for _, info in entries}
        if len(infos) == 1:
            players[name] = entries[0][1]
        else:
            for key, info in entries:
                by_competition[key][name] = info
        for _, info in entries:
            counts[info['type'] if 'reason' not in info else 'ambiguous'] += 1
    return players, {k: dict(sorted(v.items())) for k, v in sorted(by_competition.items())}, dict(counts)


def lookup(players, by_competition, key, name):
    return by_competition.get(key, {}).get(name) or players.get(name) or {'type': 'unknown'}


def coverage(players, by_competition):
    """Share of legal balls in each battle file bowled by a bowler of known type."""
    out = {}
    for key in BATTLE_KEYS:
        path = ROOT / f'battle-{key}.json'
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        known = total = 0
        for row in data['rows']:
            total += row[11]
            if lookup(players, by_competition, key, data['players'][row[2]])['type'] in ('pace', 'spin'):
                known += row[11]
        out[key] = round(known / total * 100, 1) if total else None
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--meta', type=Path, required=True, help='player_meta.rda from the cricketdata package')
    parser.add_argument('--zip', type=Path, action='append', required=True, help='Cricsheet *_json.zip (repeat)')
    args = parser.parse_args()
    players, by_competition, counts = build(load_styles(args.meta), bowler_ids(args.zip))
    payload = {
        'version': 1, 'generated': date.today().isoformat(),
        'source': 'Bowling styles: cricketdata player_meta (GPL-3.0, from ESPNcricinfo); names to ids: Cricsheet registry',
        'licence': 'GPL-3.0 (bowling style data)', 'subtypes': SUBTYPE_LABELS, 'counts': counts,
        'coveragePctOfBalls': coverage(players, by_competition), 'players': players, 'byCompetition': by_competition,
    }
    out = ROOT / 'data' / 'bowler-types.json'
    out.write_text(json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Wrote {out.relative_to(ROOT)}: {counts} (entries per competition); coverage {payload["coveragePctOfBalls"]}')
    # Small per-competition files for the pages: bowler name -> sub-type (pace sub-types start
    # with right-/left-pace). Only names that appear in that competition's battle data.
    folder = ROOT / 'data' / 'bowler-types'
    folder.mkdir(exist_ok=True)
    for key in BATTLE_KEYS:
        path = ROOT / f'battle-{key}.json'
        if not path.exists():
            continue
        names = json.loads(path.read_text())['players']
        subs = {name: info['sub'] for name in names if (info := lookup(players, by_competition, key, name)).get('sub')}
        compact = {'subtypes': SUBTYPE_LABELS, 'pace': ['right-pace', 'left-pace'], 'coveragePctOfBalls': payload['coveragePctOfBalls'].get(key), 'bowlers': subs}
        (folder / f'{key}.json').write_text(json.dumps(compact, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    print('Wrote data/bowler-types/<competition>.json for', ', '.join(k for k in BATTLE_KEYS if (ROOT / f'battle-{k}.json').exists()))


if __name__ == '__main__':
    main()
