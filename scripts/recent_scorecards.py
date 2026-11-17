"""Public recent international scorecards, checked against innings totals before import.
The ball-by-ball archive remains authoritative when a match arrives there later.
No credentials, internal API references, or live/in-progress player figures are used.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

API = 'https://site.web.api.espn.com/apis/site/v2/sports/cricket'
SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/cricket'
CLASS = {'1': ('Test', 'male'), '2': ('ODI', 'male'), '3': ('T20I', 'male'),
         '8': ('Test', 'female'), '9': ('ODI', 'female'), '10': ('T20I', 'female')}


def get_json(url, cache=None):
    path = None
    if cache:
        import hashlib
        path = Path(cache) / 'recent-feeds' / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if path.exists():
            return json.loads(path.read_text())
    request = urllib.request.Request(url, headers={'User-Agent': 'TheCricketSpace-Records/1.0', 'Accept': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == 2:
                raise
            time.sleep(attempt + 1)
        except urllib.error.URLError:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    if path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
    return data


def get_scorecard(league, match_id, cache=None):
    if not str(league).isdigit() or not str(match_id).isdigit():
        raise ValueError('Invalid scorecard identifier')
    try:
        return get_json(f'{SUMMARY}/{league}/summary?event={match_id}', cache)
    except urllib.error.HTTPError as error:
        if error.code not in {404, 500, 502, 503, 504}:
            raise
    except urllib.error.URLError:
        pass
    # Same public scorecard, separate public web delivery route for transient failures.
    return get_json(f'{API}/{league}/summary?region=us&lang=en&event={match_id}', cache)


def stats(obj):
    return {s['name']: s.get('value') for c in obj.get('statistics', {}).get('categories', []) for s in c.get('stats', [])}


def integer(value):
    if isinstance(value, bool) or value is None or not re.fullmatch(r'\d+(?:\.0+)?', str(value)):
        raise ValueError(f'Invalid score: {value!r}')
    return int(float(value))


def team_name(name):
    return re.sub(r' (?:Women|Men)$', '', name).strip()


def parse_scorecard(data, today):
    header = data.get('header', {})
    competitions = header.get('competitions', [])
    if len(competitions) != 1:
        return None
    match = competitions[0]
    class_id = str(match.get('class', {}).get('internationalClassId', ''))
    if class_id not in CLASS or match.get('status', {}).get('type', {}).get('state') != 'post':
        return None
    key, gender = CLASS[class_id]
    match_date = date.fromisoformat(match['date'][:10])
    if match_date > today:
        return None
    match_id = str(header['id'])
    if not match_id.isdigit():
        raise ValueError('Invalid match ID')
    competitors = match.get('competitors', [])
    if len(competitors) != 2:
        raise ValueError('Scorecard must identify both teams')
    teams = [team_name(c['team']['displayName']) for c in competitors]
    if len(set(teams)) != 2:
        raise ValueError('Duplicate teams')
    event = header.get('league', {}).get('name', '')
    season = str(header.get('season', {}).get('year', match_date.year))
    common = [match_date.isoformat(), gender, event, season]
    max_innings = 4 if key == 'Test' else 2
    totals = {}
    for c in competitors:
        team = team_name(c['team']['displayName'])
        for line in c.get('linescores', []):
            period = integer(line['period'])
            if line.get('isBatting') is not True or period > max_innings:
                continue
            total = integer(line['runs'])
            wickets = integer(line.get('wickets', 0))
            if wickets > 10 or period in totals:
                raise ValueError('Invalid innings total')
            totals[period] = (team, total, wickets, stats(line))
    roster = data.get('rosters', [])
    rows, aliases, seen = [], {}, set()
    for squad in roster:
        team = team_name(squad['team']['displayName'])
        if team not in teams:
            raise ValueError('Unknown roster team')
        opponent = next(t for t in teams if t != team)
        for player in squad.get('roster', []):
            athlete = player['athlete']
            identifier = 'espn:' + str(athlete['id'])
            name = athlete.get('displayName') or athlete.get('name')
            if not name:
                raise ValueError('Player name missing')
            aliases[identifier] = sorted({athlete[k] for k in ('name', 'displayName', 'fullName', 'battingName') if athlete.get(k)})
            for line in player.get('linescores', []):
                period = integer(line['period'])
                if period > max_innings:
                    continue
                values = stats(line)
                batting = integer(values.get('batted', 0)) > 0
                bowling = integer(values.get('inningsBowled', 0)) > 0 or integer(values.get('balls', 0)) > 0
                if not batting and not bowling:
                    continue
                if period not in totals:
                    raise ValueError('Player innings has no team total')
                if batting and totals[period][0] != team or bowling and totals[period][0] == team:
                    raise ValueError('Player figures assigned to wrong innings')
                category = 'Batting' if batting else 'Bowling'
                identity = (period, identifier, category)
                if identity in seen:
                    raise ValueError('Duplicate player figures')
                seen.add(identity)
                runs = integer(values.get('runs') if batting else values.get('wickets'))
                conceded = 0 if batting else integer(values.get('conceded'))
                rows.append([category, name, team, opponent, runs, conceded, *common,
                             identifier, '', match_id, period, match_date.isoformat() if key != 'Test' else '', 'recent-scorecard'])
    for period, (team, total, wickets, values) in totals.items():
        batting = [r for r in rows if r[13] == period and r[0] == 'Batting']
        bowling = [r for r in rows if r[13] == period and r[0] == 'Bowling']
        if not batting or not bowling:
            raise ValueError('Incomplete player scorecard')
        if 'extras' not in values or sum(r[4] for r in batting) + integer(values['extras']) != total:
            raise ValueError('Batter runs plus extras do not match innings total')
        if sum(r[4] for r in bowling) > wickets or sum(r[5] for r in bowling) > total:
            raise ValueError('Bowling figures exceed innings total')
        opponent = next(t for t in teams if t != team)
        rows.append(['Team totals', team, team, opponent, total, 0, *common, '', '', match_id, period,
                     match_date.isoformat() if key != 'Test' else '', 'recent-scorecard'])
    return {'format': key, 'date': match_date.isoformat(), 'rows': rows, 'aliases': aliases}


def candidate_leagues(data, today, start):
    output = []
    for league in data.get('leagues', []):
        name = league.get('name', '')
        if re.search(r'under.?19|youth|unofficial|\bLions\b|\bEmerging\b|\bA (?:in|tour|Women)\b', name, re.I):
            continue
        try:
            end = date.fromisoformat(league.get('season', {}).get('endDate', '')[:10])
        except ValueError:
            continue
        if start <= end <= today + timedelta(days=60):
            output.append(str(league['id']))
    return sorted(set(output))


def discovery_start(previous, today, backfill_days):
    previous_day = previous.get('scannedThrough')
    if not previous_day:
        return today - timedelta(days=backfill_days)
    # A finished Test can have started five days earlier. Keep a ten-day overlap,
    # and catch up from the previous scan after an outage instead of skipping dates.
    return min(today - timedelta(days=10), date.fromisoformat(previous_day) - timedelta(days=10))


def refresh_recent(today, cache_path, covered, cache=None, backfill_days=30):
    previous = json.loads(cache_path.read_text()) if cache_path.exists() else {'matches': {}, 'pending': {}}
    saved = previous.get('matches', {})
    pending = previous.get('pending', {})
    start = discovery_start(previous, today, backfill_days)
    leagues = get_json('https://site.api.espn.com/apis/site/v2/leagues/dropdown?region=us&lang=en&sport=cricket', cache)
    selected = candidate_leagues(leagues, today, start)
    if not selected:
        raise ValueError('No recent series discovered')
    events, errors = {}, []

    def scoreboard(league, day=None):
        url = f'{API}/{league}/scoreboard?region=us&lang=en'
        if day:
            url += '&dates=' + day.replace('-', '')
        return get_json(url, cache)

    def accept(board, league):
        for event in board.get('events', []):
            for competition in event.get('competitions', []):
                if str(competition.get('class', {}).get('internationalClassId', '')) not in CLASS:
                    continue
                when = date.fromisoformat(competition['date'][:10])
                state = competition.get('status', event.get('status', {})).get('type', {}).get('state')
                if start <= when <= today and state == 'post':
                    events[str(event['id'])] = league

    calendars = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(scoreboard, league): league for league in selected}
        for future in as_completed(jobs):
            league = jobs[future]
            try:
                board = future.result()
                accept(board, league)
                for item in board.get('leagues', []):
                    for day in item.get('calendar', []):
                        when = date.fromisoformat(day[:10])
                        if start <= when <= today:
                            calendars.append((league, when.isoformat()))
            except Exception as error:
                errors.append(f'series {league}: {error}')
        jobs = {pool.submit(scoreboard, league, day): (league, day) for league, day in set(calendars)}
        for future in as_completed(jobs):
            league, day = jobs[future]
            try:
                accept(future.result(), league)
            except Exception as error:
                errors.append(f'series {league} on {day}: {error}')
    discovery_errors = list(errors)
    # Retry scorecards that were incomplete on an earlier run even after they leave
    # the short discovery window. Already covered ball-by-ball records take priority.
    wanted = {**pending, **events}
    all_covered = set().union(*covered.values())
    for match_id in all_covered:
        saved.pop(match_id, None)
        wanted.pop(match_id, None)
        pending.pop(match_id, None)
    imported = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(get_scorecard, league, match_id, cache): (match_id, league)
                for match_id, league in wanted.items()}
        for future in as_completed(jobs):
            match_id, league = jobs[future]
            try:
                parsed = parse_scorecard(future.result(), today)
                if parsed:
                    saved[match_id] = parsed
                    pending.pop(match_id, None)
                    imported += 1
                elif match_id not in saved:
                    pending[match_id] = league
            except Exception as error:
                pending[match_id] = league
                errors.append(f'match {match_id}: {error}')
    if not events and not calendars and errors:
        raise ValueError('Recent scorecard discovery failed: ' + '; '.join(errors[:3]))
    state = {'version': 1, 'scannedThrough': previous.get('scannedThrough') if discovery_errors else today.isoformat(), 'matches': dict(sorted(saved.items())),
             'pending': dict(sorted(pending.items())), 'discoveryPending': sorted(discovery_errors)}
    for error in errors:
        print('Recent scorecard warning:', error, flush=True)
    print(f'Recent scorecards: {len(events)} completed discovered, {imported} validated, {len(pending)} pending', flush=True)
    return state
