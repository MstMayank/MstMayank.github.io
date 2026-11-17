"""Build battle-name-aliases.json: extra searchable names for Player Battle.

Player Battle datasets use scorecard names such as "V Kohli" or "JJ Bumrah".
player-career-index.json links those to full names ("Virat Kohli",
"Jasprit Jasbirsingh Bumrah"). This keeps only the names that appear in the
battle datasets so the browser downloads a small file.

Run from the repository root: python scripts/build-battle-aliases.py
"""
import glob
import json

battle_names = set()
for path in glob.glob('battle-*.json'):
    if path.startswith('battle-insights') or path == 'battle-name-aliases.json':
        continue
    with open(path, encoding='utf-8') as handle:
        battle_names.update(json.load(handle).get('players', []))

with open('player-career-index.json', encoding='utf-8') as handle:
    index = json.load(handle)['players']

aliases = {}
for entry in index:
    names = [entry[1], *entry[4]]
    for name in names:
        if name in battle_names:
            extra = [other for other in names if other != name]
            if extra:
                bucket = aliases.setdefault(name, [])
                bucket.extend(other for other in extra if other not in bucket)

with open('battle-name-aliases.json', 'w', encoding='utf-8') as handle:
    json.dump(dict(sorted(aliases.items())), handle, ensure_ascii=False, separators=(',', ':'))
print(f'{len(aliases)} of {len(battle_names)} battle names have aliases')
