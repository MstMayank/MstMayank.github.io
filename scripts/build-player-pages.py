#!/usr/bin/env python3
"""Build static player pages: player/<slug>.html, player/index.html and player/links.json.

    python scripts/build-player-pages.py

One page for every player with an IPL, WPL, ODI or T20I record in player-career-data.json.
Each page is plain HTML with the summary already in it (career records, IPL/WPL ball-by-ball
numbers, phase splits, seasons, recent innings and main match-ups), so it reads and indexes
without JavaScript. /player/player.js adds the on-demand parts: the full match-up list loads
battle-<competition>.json only when asked.

URLs are stable: a slug is the player's full name (player-career-index.json). When two players
share a name the Cricsheet id is added. Slugs already in player/links.json are kept, so a link
never moves when the data is rebuilt.

player/links.json maps the short scorecard name used in battle-<competition>.json to the slug,
for links from Player Battle, venues, preview and fantasy pages. The script also rewrites the
player section of sitemap.xml.
"""
import html
import json
import re
import runpy
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = 'https://mstmayank.github.io'
OUT = ROOT / 'player'
LEAGUES = {'IPL': 'ipl', 'WPL': 'wpl'}
FORMATS = [('IPL', 'IPL'), ('WPL', 'WPL'), ('T20I', 'T20I'), ('ODI', 'ODI'), ('Test', 'Test'), ('FC', 'First-class'), ('List A', 'List A')]
PAGE_FORMATS = ('IPL', 'WPL', 'ODI', 'T20I')
PHASES = ['Powerplay', 'Middle', 'Death']
MATCHUP_MIN_BALLS = 12
SITEMAP_START, SITEMAP_END = '  <!-- player pages: built by scripts/build-player-pages.py -->', '  <!-- /player pages -->'

esc = html.escape
TEAM_CODES = {'Chennai Super Kings': 'CSK', 'Deccan Chargers': 'DC', 'Delhi Capitals': 'DC', 'Gujarat Lions': 'GL', 'Gujarat Titans': 'GT',
              'Kochi Tuskers Kerala': 'KTK', 'Kolkata Knight Riders': 'KKR', 'Lucknow Super Giants': 'LSG', 'Mumbai Indians': 'MI',
              'Pune Warriors': 'PWI', 'Punjab Kings': 'PBKS', 'Rajasthan Royals': 'RR', 'Rising Pune Supergiant': 'RPS',
              'Royal Challengers Bengaluru': 'RCB', 'Royal Challengers Bangalore': 'RCB', 'Sunrisers Hyderabad': 'SRH',
              'Gujarat Giants': 'GG', 'UP Warriorz': 'UPW'}


def teams(names):
    return ' v '.join(f'<abbr title="{esc(n)}">{esc(TEAM_CODES.get(n, n))}</abbr>' for n in names)


def slugify(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or 'player'


PARTICLES = {'de', 'du', 'van', 'von', 'der', 'den', 'la', 'le', 'da', 'di', 'ul', 'al', 'bin', 'ten', 'ter'}


def short_slug(full_name):
    """First and last name ("Jasprit Jasbirsingh Bumrah" -> jasprit-bumrah), keeping particles (de Villiers)."""
    words = full_name.split()
    if len(words) <= 2:
        return slugify(full_name)
    last = [words[-1]]
    for w in reversed(words[1:-1]):
        if w.lower() not in PARTICLES:
            break
        last.insert(0, w)
    return slugify(' '.join([words[0]] + last))


def fmt(value, digits=2):
    if value is None or value == '':
        return '–'
    if isinstance(value, float):
        return f'{value:,.{digits}f}'.rstrip('0').rstrip('.') if digits else f'{value:,.0f}'
    if isinstance(value, int):
        return f'{value:,}'
    return str(value)


def ratio(a, b, m=1):
    return a * m / b if b else None


def load(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


# ---------------------------------------------------------------- ball-by-ball summaries

def league_stats(data, pid):
    """Batting and bowling summary for one player id in a battle-<competition>.json dataset."""
    matches = data['matches']
    bat_m, bowl_m = defaultdict(lambda: [0, 0, 0, 0, 0]), defaultdict(lambda: [0, 0, 0])  # runs balls 4s 6s outs / wkts conceded legal
    bat_ph = [[0, 0, 0, 0, 0, 0] for _ in PHASES]   # runs balls outs dots fours sixes
    bowl_ph = [[0, 0, 0, 0] for _ in PHASES]        # legal conceded wickets dots
    faced, bowled_to = defaultdict(lambda: [0, 0, 0]), defaultdict(lambda: [0, 0, 0])  # runs/conceded balls outs/wkts
    for r in data['rows']:
        m, bat, bowl, ph = r[0], r[1], r[2], r[3]
        if bat == pid:
            e = bat_m[m]; e[0] += r[4]; e[1] += r[5]; e[2] += r[7]; e[3] += r[8]; e[4] += r[15]
            p = bat_ph[ph]; p[0] += r[4]; p[1] += r[5]; p[2] += r[15]; p[3] += r[6]; p[4] += r[7]; p[5] += r[8]
            f = faced[bowl]; f[0] += r[4]; f[1] += r[5]; f[2] += r[9]
        if bowl == pid:
            e = bowl_m[m]; e[0] += r[9]; e[1] += r[10]; e[2] += r[11]
            p = bowl_ph[ph]; p[0] += r[11]; p[1] += r[10]; p[2] += r[9]; p[3] += r[14]
            t = bowled_to[bat]; t[0] += r[10]; t[1] += r[11]; t[2] += r[9]
    # A batter who faced no legal ball but was out (run out at the non-striker's end) has no row;
    # dismissals add those innings.
    for d in data.get('dismissals', []):
        if d[1] == pid and d[0] not in bat_m:
            bat_m[d[0]] = [0, 0, 0, 0, 1]
    if not bat_m and not bowl_m:
        return None
    seasons = defaultdict(lambda: {'inn': 0, 'runs': 0, 'balls': 0, 'outs': 0, 'mat': set(), 'wkts': 0, 'legal': 0, 'conceded': 0})
    for m, e in bat_m.items():
        s = seasons[matches[m][0]]; s['inn'] += 1; s['runs'] += e[0]; s['balls'] += e[1]; s['outs'] += e[4]; s['mat'].add(m)
    for m, e in bowl_m.items():
        s = seasons[matches[m][0]]; s['mat'].add(m); s['wkts'] += e[0]; s['conceded'] += e[1]; s['legal'] += e[2]
    runs = sum(e[0] for e in bat_m.values()); balls = sum(e[1] for e in bat_m.values()); outs = sum(e[4] for e in bat_m.values())
    hs = max(bat_m.values(), key=lambda e: (e[0], -e[4]), default=None)
    wk = sum(e[0] for e in bowl_m.values()); conc = sum(e[1] for e in bowl_m.values()); legal = sum(e[2] for e in bowl_m.values())
    best = max(bowl_m.values(), key=lambda e: (e[0], -e[1]), default=None)
    order = lambda ms: sorted(ms, key=lambda m: (matches[m][2], m), reverse=True)
    all_matches = set(bat_m) | {m for m, e in bowl_m.items() if e[2]}
    return {
        'matches': len(all_matches),
        'first': min(matches[m][2] for m in all_matches) if all_matches else None,
        'last': max(matches[m][2] for m in all_matches) if all_matches else None,
        'batting': {'innings': len(bat_m), 'runs': runs, 'balls': balls, 'outs': outs, 'avg': ratio(runs, outs), 'sr': ratio(runs, balls, 100),
                    'fours': sum(e[2] for e in bat_m.values()), 'sixes': sum(e[3] for e in bat_m.values()),
                    'fifties': sum(1 for e in bat_m.values() if 50 <= e[0] < 100), 'hundreds': sum(1 for e in bat_m.values() if e[0] >= 100),
                    'highest': f'{hs[0]}{"" if hs[4] else "*"}' if hs else None} if bat_m else None,
        'bowling': {'matches': sum(1 for e in bowl_m.values() if e[2]), 'wickets': wk, 'legal': legal, 'conceded': conc, 'econ': ratio(conc, legal, 6),
                    'avg': ratio(conc, wk), 'sr': ratio(legal, wk), 'best': f'{best[0]}/{best[1]}' if best else None} if legal else None,
        'batPhases': bat_ph, 'bowlPhases': bowl_ph,
        'seasons': sorted(((k, v) for k, v in seasons.items()), reverse=True),
        'recentBat': [(m, bat_m[m]) for m in order(bat_m)[:10]],
        'recentBowl': [(m, bowl_m[m]) for m in order(m for m, e in bowl_m.items() if e[2])[:10]],
        'faced': sorted(((data['players'][b], v) for b, v in faced.items() if v[1] >= MATCHUP_MIN_BALLS), key=lambda x: -x[1][1])[:6],
        'bowledTo': sorted(((data['players'][b], v) for b, v in bowled_to.items() if v[1] >= MATCHUP_MIN_BALLS), key=lambda x: -x[1][1])[:6],
    }


# ---------------------------------------------------------------- HTML pieces

PHOTOS = {}          # slug -> /battle-art/thumbs/<name>.webp
LEAGUE_PHASES = {}   # competition -> {'bat': [SR per phase], 'bowl': [economy per phase]}
# Portraits drawn for the site (battle-art/), matched to player pages by name. Where the art's
# file name differs from the page slug, the pair is listed here.
PORTRAIT_SLUGS = {'kohli-rcb': 'virat-kohli', 'abd-rcb': 'ab-de-villiers', 'steyn': 'dale-steyn', 'mandhana': 'smriti-mandhana',
                  'harmanpreet': 'harmanpreet-bhullar', 'dhoni': 'ms-dhoni', 'sai-sudharsan': 'bhardwaj-sudharsan', 'phil-salt': 'philip-salt',
                  'bhuvneshwar-kumar': 'bhuvneshwar-singh', 'pat-cummins': 'patrick-cummins', 'varun-chakaravarthy': 'varun-vinod',
                  'vaibhav-sooryavanshi': 'v-suryavanshi', 'bumrah': 'jasprit-bumrah', 'hardik': 'hardik-pandya', 'rohit': 'rohit-sharma',
                  'rashid-khan': 'rashid-arman', 'noor-ahmad': 'noor-lakanwal', 'tilak-varma': 'namboori-varma'}
DISPLAY = {}         # slug -> the name fans know (from the portrait list), e.g. Tilak Varma


def known_names(slug_of_name):
    """Display names from browser-auction/game/portraits.ts, keyed by page slug."""
    text = (ROOT / 'browser-auction' / 'game' / 'portraits.ts').read_text(encoding='utf-8')
    out = {}
    for name, stem in re.findall(r'"([^"]+)":\s*"/battle-art/([^"]+)\.jpg"', text):
        slug = slug_of_name(stem)
        if slug:
            out[slug] = name
    out.update({'virat-kohli': 'Virat Kohli', 'ab-de-villiers': 'AB de Villiers', 'dale-steyn': 'Dale Steyn', 'smriti-mandhana': 'Smriti Mandhana',
                'harmanpreet-bhullar': 'Harmanpreet Kaur', 'ms-dhoni': 'MS Dhoni'})
    return out
SKIP_ART = {'kohli-india', 'auction-preview-bumrah', 'auction-preview-dhoni'}

# Names fans use, for the homepage galaxy. The registry has full legal names ("Suresh Kumar Raina");
# the scorecard short name ("SK Raina") tells us which given name to keep. A few players are known by a
# name neither gives, so they are listed here by page slug.
NICKNAMES = {
    'ravindrasinh-jadeja': 'Ravindra Jadeja', 'krishnakumar-karthik': 'Dinesh Karthik', 'umeshkumar-yadav': 'Umesh Yadav',
    'separamadu-malinga': 'Lasith Malinga', 'praveenkumar-singh': 'Praveen Kumar', 'johannes-morkel': 'Albie Morkel',
    'rudra-singh': 'RP Singh', 'christopher-morris': 'Chris Morris', 'samuel-curran': 'Sam Curran', 'timothy-david': 'Tim David',
    'timothy-southee': 'Tim Southee', 'jonathan-bairstow': 'Jonny Bairstow', 'christopher-lynn': 'Chris Lynn',
    'christopher-jordan': 'Chris Jordan', 'christopher-woakes': 'Chris Woakes', 'william-jacks': 'Will Jacks',
    'samuel-billings': 'Sam Billings', 'narangoda-perera': 'Thisara Perera', 'pinnaduwage-de-silva': 'Wanindu Hasaranga',
    'morawakage-theekshana': 'Maheesh Theekshana', 'pathira-chameera': 'Dushmantha Chameera', 'gade-vihari': 'Hanuma Vihari',
    'benjamin-cutting': 'Ben Cutting', 'benjamin-hilfenhaus': 'Ben Hilfenhaus', 'douglas-bollinger': 'Doug Bollinger',
    'bradley-hodge': 'Brad Hodge', 'lungisani-ngidi': 'Lungi Ngidi', 'george-hogg': 'Brad Hogg', 'steven-smith': 'Steve Smith',
    'kulasekara-kulasekara': 'Nuwan Kulasekara', 'hendrik-van-der-dussen': 'Rassie van der Dussen',
}
NAME_PARTICLES = {'de', 'du', 'van', 'der', 'von', 'al', 'ul', 'le', 'da', 'di', 'ten'}


def common_name(full, short, slug):
    if slug in NICKNAMES:
        return NICKNAMES[slug]
    words = full.split()
    if len(words) <= 2 or not short:
        return full
    toks = short.split()
    is_init = lambda t: bool(re.fullmatch(r'[A-Z]{1,4}', t))
    if not any(is_init(t) for t in toks):
        return short                                   # the scorecard already uses the real name: "Mohammed Shami"
    inits, rest = [t for t in toks if is_init(t)], [t for t in toks if not is_init(t)]
    if len(rest) >= 2 and rest[0].lower() not in NAME_PARTICLES:
        return ' '.join(rest)                          # "R Vinay Kumar" -> "Vinay Kumar"
    lower_rest = [r.lower() for r in rest]
    first = next((w for w in words if w[0].upper() == inits[0][0] and w.lower() not in lower_rest), None)
    return f'{first} {" ".join(rest)}' if first else full



def initials(name):
    words = [w for w in re.split(r'\s+', name) if w]
    return (words[0][0] + (words[-1][0] if len(words) > 1 else '')).upper()


def hue(name):
    return sum(ord(c) * (i + 7) for i, c in enumerate(name)) % 360


def face(name, slug, cls='pp-face', eager=False):
    """Portrait thumbnail if the site has one, otherwise an initials badge coloured from the name."""
    photo = PHOTOS.get(slug)
    if photo:
        lazy = '' if eager else ' loading="lazy"'
        stem = photo.rsplit('/', 1)[-1].split('.')[0]
        if cls in ('pp-mini',) and (ROOT / 'battle-art' / 'faces' / f'{stem}.webp').exists():
            return f'<span class="{cls} has-photo"><img src="/battle-art/faces/{stem}.webp" alt="" width="96" height="96"{lazy} decoding="async"></span>'
        return f'<span class="{cls} has-photo"><img src="{photo}" alt="" width="360" height="540" style="{focus_style(slug)}"{lazy} decoding="async"></span>'
    return f'<span class="{cls}" style="--h:{hue(name)}" aria-hidden="true">{esc(initials(name))}</span>'


def table(caption, head, rows, cls='pp-table'):
    out = [f'<div class="pp-scroll"><table class="{cls}"><caption>{esc(caption)}</caption><thead><tr>']
    out += [f'<th scope="col">{esc(h)}</th>' for h in head]
    out.append('</tr></thead><tbody>')
    for row in rows:
        out.append('<tr>' + ''.join(f'<{"th scope=row" if i == 0 else "td"}>{c}</{"th" if i == 0 else "td"}>' for i, c in enumerate(row)) + '</tr>')
    out.append('</tbody></table></div>')
    return ''.join(out)


def details(summary, inner):
    return f'<details class="pp-details"><summary>{esc(summary)}</summary>{inner}</details>'


def card(title, body, wide=False, extra=''):
    return f'<section class="pp-card{" wide" if wide else ""}"{extra}><h2>{esc(title)}</h2>{body}</section>'


def match_link(league, match):
    q = f'id={match[6]}' if league == 'ipl' else f'c={league}&amp;id={match[6]}'
    return f'<a href="/match.html?{q}">{esc(match[2])}</a>'


def bar_chart(items, label):
    """Inline SVG bar chart. items: [(axis label, value, value text, highlight)]."""
    if not items:
        return ''
    h, top, bottom, slot = 160, 24, 26, 44
    width = len(items) * slot
    peak = max(v for _, v, _, _ in items) or 1
    out = [f'<svg class="pp-chart" viewBox="0 0 {width} {h}" style="min-width:{width * 0.72:.0f}px" role="img" aria-label="{esc(label)}">']
    for i, (axis, v, text, hi) in enumerate(items):
        bh = max(2.0, (h - top - bottom) * v / peak)
        x, y, w = i * slot + 7, h - bottom - bh, slot - 14
        out.append(f'<rect class="pp-bar{" hi" if hi else ""}" x="{x}" y="{y:.1f}" width="{w}" height="{bh:.1f}" rx="6"><title>{esc(axis)}: {esc(text)}</title></rect>')
        out.append(f'<text class="pp-val" x="{x + w / 2:.1f}" y="{y - 7:.1f}" text-anchor="middle">{esc(text)}</text>')
        out.append(f'<text class="pp-axis" x="{x + w / 2:.1f}" y="{h - 8}" text-anchor="middle">{esc(axis)}</text>')
    out.append('</svg>')
    return f'<div class="pp-chart-wrap">{"".join(out)}</div>'


def phase_bars(rows, unit, lower_better=False):
    """rows: [(phase, value, league average, note)] as horizontal bars with a league-average tick."""
    rows = [r for r in rows if r[1] is not None]
    if not rows:
        return ''
    peak = max(max(r[1], r[2] or 0) for r in rows) * 1.1
    digits = 1 if unit == 'SR' else 2
    out = ['<div class="pp-phases">']
    for phase, v, avg, note in rows:
        good = bool(avg) and ((v < avg) if lower_better else (v > avg))
        tone = 'up' if good else 'down'
        out.append(f'<div class="pp-phase"><div class="pp-phase-head"><b>{esc(phase)}</b><span><strong class="{tone}">{v:.{digits}f}</strong> {unit}</span></div>'
                   f'<div class="pp-track"><i class="{tone}" style="width:{v / peak * 100:.1f}%"></i>'
                   + (f'<em style="left:{avg / peak * 100:.1f}%" title="League average {avg:.{digits}f}"></em>' if avg else '')
                   + f'</div><small>{esc(note)}' + (f' · league average {avg:.{digits}f}' if avg else '') + '</small></div>')
    out.append('</div>')
    return ''.join(out)


def overs(balls):
    return f'{balls // 6}.{balls % 6}'


def season_label(matches, v):
    """Year the season was played (Cricsheet calls IPL 2008 "2007/08" and IPL 2020 "2020/21")."""
    return "'" + min(matches[i][2] for i in v['mat'])[2:4]


def league_cards(label, key, short, s, data, slugs):
    from urllib.parse import quote
    m = data['matches']
    b, w = s['batting'], s['bowling']
    # Cards for the player's main role, plus the other role only with 600+ balls of it, so
    # part-time bowling or tail-end batting does not fill the page with noisy charts.
    bat_balls, bowl_balls = (b['balls'] if b else 0), (w['legal'] if w else 0)
    bat = bat_balls > 0 and (bat_balls >= bowl_balls or bat_balls >= 600)
    if w and not (bowl_balls > bat_balls or bowl_balls >= 600):
        w = None
    lp = LEAGUE_PHASES[key]
    cards = []
    seasons = sorted(s['seasons'])
    if bat and len(seasons) > 1:
        best = max(v['runs'] for _, v in seasons)
        cards.append(card(f'{label} runs by season', bar_chart(
            [(season_label(m, v), v['runs'], fmt(v['runs']), v['runs'] == best and best > 0) for se, v in seasons], f'{label} runs by season')
            + details('Season table', table('Season by season', ['Season', 'Matches', 'Runs', 'SR', 'Wickets', 'Economy'],
                [[esc(se), fmt(len(v['mat'])), fmt(v['runs']) if v['inn'] else '–', fmt(ratio(v['runs'], v['balls'], 100), 1) if v['balls'] else '–',
                  fmt(v['wkts']) if v['legal'] else '–', fmt(ratio(v['conceded'], v['legal'], 6)) if v['legal'] else '–'] for se, v in reversed(seasons)])), wide=True))
    if w and len(seasons) > 1 and (not bat or w['legal'] >= 300):
        best = max(v['wkts'] for _, v in seasons)
        cards.append(card(f'{label} wickets by season', bar_chart(
            [(season_label(m, v), v['wkts'], str(v['wkts']), v['wkts'] == best and best > 0) for se, v in seasons if v['legal']], f'{label} wickets by season'), wide=True))
    if bat:
        cards.append(card('Batting by phase', phase_bars(
            [(PHASES[i], ratio(p[0], p[1], 100), lp['bat'][i], f'{fmt(p[0])} runs off {fmt(p[1])} balls, out {p[2]}') for i, p in enumerate(s['batPhases']) if p[1] >= 6], 'SR')
            + details('Phase table', table('Batting by phase (powerplay overs 1–6, middle 7–15, death 16–20)', ['Phase', 'Runs', 'Balls', 'SR', 'Outs', 'Dots', 'Boundary %'],
                [[PHASES[i], fmt(p[0]), fmt(p[1]), fmt(ratio(p[0], p[1], 100), 1), fmt(p[2]), fmt(ratio(p[3], p[1], 100), 0) + '%', fmt(ratio(p[4] + p[5], p[1], 100), 0) + '%']
                 for i, p in enumerate(s['batPhases']) if p[1]]))))
    if w:
        cards.append(card('Bowling by phase', phase_bars(
            [(PHASES[i], ratio(p[1], p[0], 6), lp['bowl'][i], f'{p[2]} wicket{"" if p[2] == 1 else "s"} in {overs(p[0])} overs') for i, p in enumerate(s['bowlPhases']) if p[0] >= 12], 'econ', lower_better=True)
            + details('Phase table', table('Bowling by phase', ['Phase', 'Overs', 'Runs', 'Wickets', 'Economy', 'Dots'],
                [[PHASES[i], overs(p[0]), fmt(p[1]), fmt(p[2]), fmt(ratio(p[1], p[0], 6)), fmt(ratio(p[3], p[0], 100), 0) + '%'] for i, p in enumerate(s['bowlPhases']) if p[0]]))))
    if s['recentBat'] and bat:
        last = list(reversed(s['recentBat']))
        cards.append(card('Last 10 innings', bar_chart(
            [(str(int(m[i][2][8:10])) + '/' + str(int(m[i][2][5:7])), e[0], f'{e[0]}{"" if e[4] else "*"}', e[0] >= 50) for i, e in last], 'Runs in the last 10 innings')
            + details('Scorecards', table('Last 10 innings', ['Date', 'Match', 'Score', 'SR'],
                [[match_link(key, m[i]), teams(m[i][3]), f'{e[0]}{"" if e[4] else "*"} ({e[1]})', fmt(ratio(e[0], e[1], 100), 1)] for i, e in s['recentBat']], 'pp-table pp-recent'))))
    if s['recentBowl'] and w and (not bat or w['legal'] >= 300):
        last = list(reversed(s['recentBowl']))
        cards.append(card('Last 10 bowling matches', bar_chart(
            [(str(int(m[i][2][8:10])) + '/' + str(int(m[i][2][5:7])), e[0], f'{e[0]}/{e[1]}', e[0] >= 3) for i, e in last], 'Wickets in the last 10 matches')
            + details('Figures', table('Last 10 bowling matches', ['Date', 'Match', 'Figures', 'Economy'],
                [[match_link(key, m[i]), teams(m[i][3]), f'{overs(e[2])}-{e[1]}-{e[0]}', fmt(ratio(e[1], e[2], 6))] for i, e in s['recentBowl']], 'pp-table pp-recent'))))

    def rows(items, rate):
        out = []
        for n, v in items:
            slug = slugs.get((key, n))
            who = f'<a href="/player/{slug}.html">{esc(n)}</a>' if slug else esc(n)
            stat = (f'{fmt(v[0])} off {fmt(v[1])} · SR {fmt(ratio(v[0], v[1], 100), 1)} · out {v[2]}' if rate == 'sr'
                    else f'{fmt(v[0])} runs in {overs(v[1])} overs · econ {fmt(ratio(v[0], v[1], 6))} · {v[2]} wkts')
            out.append(f'<li>{face(n, slug or "", "pp-mini")}<div>{who}<small>{stat}</small></div></li>')
        return '<ul class="pp-mu">' + ''.join(out) + '</ul>'
    mu = []
    if s['faced'] and bat:
        mu.append(('Bowlers faced most', rows(s['faced'], 'sr')))
    if s['bowledTo'] and w:
        mu.append(('Batters bowled to most', rows(s['bowledTo'], 'econ')))
    for title, body in mu:   # one list alone spans the row in two columns
        cards.append(card(title, body.replace('class="pp-mu"', 'class="pp-mu cols"') if len(mu) == 1 else body, wide=len(mu) == 1))
    role = 'bowling' if w and (not b or w['legal'] > b['balls']) else 'batting'
    cards.append(f'<div class="pp-more wide" data-competition="{key}" data-player="{esc(short)}" data-role="{role}">'
                 f'<button type="button" class="pp-load">Show every {label} match-up</button>'
                 f'<a href="/player-battle.html?competition={key}&amp;first={quote(short)}">Compare in Player Battle ↗</a>'
                 f'<a href="/player-battle.html?competition={key}&amp;view=finder&amp;player={quote(short)}&amp;role={role}">Best and worst match-ups ↗</a>'
                 f'<div class="pp-more-out" aria-live="polite"></div></div>')
    return cards


def international_figures():
    """Index the same decoded scorecards used by the Record Book, by registry ID."""
    read = runpy.run_path(str(ROOT / 'scripts/refresh-cricket.py'))['load_archive']
    figures = defaultdict(dict)
    for key in ('Test', 'ODI', 'T20I'):
        archive = read(ROOT / f'archive-players-{key}.bin')
        for row in archive['rows']:
            if row[0] not in ('Batting', 'Bowling') or not row[10]:
                continue
            totals = figures['cs:' + row[10]].setdefault(key, {})
            stat = 'runs' if row[0] == 'Batting' else 'wickets'
            totals[stat] = totals.get(stat, 0) + row[4]
    return figures


def international_card(profile, figures):
    rows = []
    for key in ('Test', 'ODI', 'T20I'):
        record = profile['formats'].get(key, {})
        bat = record.get('batting') or {}
        bowl = record.get('bowling') or {}
        if bat.get('runs') is not None or bowl.get('wickets') is not None:
            rows.append([key, 'Career snapshot', fmt(bat.get('runs')), fmt(bowl.get('wickets'))])
        if key in figures:
            totals = figures[key]
            rows.append([key, 'Archived innings', fmt(totals.get('runs')), fmt(totals.get('wickets'))])
    body = (table('Archived innings cover the scorecards on this site. A dash means unavailable.',
                  ['Format', 'Coverage', 'Runs', 'Wickets'], rows) if rows else
            '<p>International figures are unavailable for this player.</p>')
    return card('International records', body, wide=True)


def career_card(profile):
    rows = []
    for key, label in FORMATS:
        r = profile['formats'].get(key)
        if not r:
            continue
        b, w = r.get('batting') or {}, r.get('bowling') or {}
        kind = {'archive': 'Archive', 'career_snapshot': 'Snapshot'}.get(r.get('status'), 'Record')
        rows.append([esc(label), fmt(b.get('matches')), fmt(b.get('runs')), fmt(b.get('average')), fmt(b.get('strikeRate')), esc(fmt(b.get('highest'))),
                     fmt(w.get('wickets')) if w.get('balls') or w.get('wickets') else '–', fmt(w.get('economy')) if w.get('balls') else '–',
                     f'<a href="{esc(r["source"])}" rel="noopener noreferrer" target="_blank">{kind}</a>' + (f' · {esc(r["asOf"])}' if r.get('asOf') else '')])
    return card('Career by format', table('From the site’s sources. A missing format does not mean the player never played it.',
                                          ['Format', 'Mat', 'Runs', 'Avg', 'SR', 'HS', 'Wkts', 'Econ', 'Source'], rows), wide=True)


def headline(profile, leagues):
    """Big numbers for the header: the main league if there is one, else the busiest format."""
    if leagues:
        label, _k, _s, s, _d = leagues[0]
        b, w = s['batting'], s['bowling']
        bat_balls = b['balls'] if b else 0
        bowl_balls = w['legal'] if w else 0
        items = [(f'{label} matches', fmt(s['matches']))]
        if bat_balls >= bowl_balls or bat_balls >= 300:
            items += [('Runs', fmt(b['runs'])), ('Strike rate', fmt(b['sr'], 1)), ('Average', fmt(b['avg'], 1)), ('50s / 100s', f'{b["fifties"]} / {b["hundreds"]}')]
        if bowl_balls > bat_balls or bowl_balls >= 300:
            items += [('Wickets', fmt(w['wickets'])), ('Economy', fmt(w['econ'])), ('Best', w['best'] or '–')]
        return items[:6]
    for key, label in FORMATS:
        r = profile['formats'].get(key)
        b = (r or {}).get('batting') or {}
        if b.get('runs'):
            return [(f'{label} matches', fmt(b.get('matches'))), ('Runs', fmt(b.get('runs'))), ('Average', fmt(b.get('average'))), ('Highest', fmt(b.get('highest')))]
    return []


def page(shell, slug, row, profile, leagues, slugs, international=None):
    pid, full_name, country, gender, aliases, _ = row
    name = DISPLAY.get(slug, full_name)
    tags = [t for t in (country, {'female': 'Women', 'male': 'Men'}.get(gender)) if t]
    facts = []
    for label, _key, _short, s, _d in leagues:
        if s['batting'] and s['batting']['runs']:
            facts.append(f'{fmt(s["batting"]["runs"])} {label} runs at a strike rate of {fmt(s["batting"]["sr"], 1)}')
        if s['bowling'] and s['bowling']['wickets']:
            facts.append(f'{fmt(s["bowling"]["wickets"])} {label} wickets at an economy of {fmt(s["bowling"]["econ"])}')
    if not facts:
        for key, label in FORMATS:
            r = profile['formats'].get(key)
            if r and (r.get('batting') or {}).get('runs'):
                facts.append(f'{fmt(r["batting"]["runs"])} {label} runs'); break
    leagues_text = ' and '.join(label for label, *_ in leagues)
    title = f'{name}: {leagues_text} stats, phases and match-ups | The Cricket Space' if leagues else f'{name}: career stats by format | The Cricket Space'
    desc = f'{name}' + (f' ({", ".join(tags)})' if tags else '') + ': ' + ('; '.join(facts) or 'career records by format') + ('. Phase splits, seasons, recent form and match-ups from ball-by-ball data.' if leagues else '. Career records by format with sources.')
    url = f'{SITE}/player/{slug}.html'
    ld = {'@context': 'https://schema.org', '@type': 'ProfilePage', 'url': url, 'name': title,
          'mainEntity': {'@type': 'Person', 'name': name, **({'nationality': country} if country else {}), **({'alternateName': ([full_name] if full_name != name else []) + aliases} if aliases or full_name != name else {})}}
    head = shell['head'].replace('{{TITLE}}', esc(title)).replace('{{DESC}}', esc(desc)).replace('{{URL}}', url).replace('{{OGTITLE}}', esc(name + ' | The Cricket Space'))
    if PHOTOS.get(slug):
        head = head.replace('https://mstmayank.github.io/og-player-battle.jpg', SITE + PHOTOS[slug].replace('/thumbs/', '/').replace('.webp', '.jpg'))
    short = leagues[0][2] if leagues else ''
    cards = [international_card(profile, international or {})] if leagues else []
    for label, key, sh, s, data in leagues:
        cards += league_cards(label, key, sh, s, data, slugs)
    cards.append(career_card(profile))
    # The opening scoreline uses the player’s league when available.
    big = headline(profile, leagues)
    chips = ''.join(f'<span>{esc(t)}</span>' for t in tags + [label for label, *_ in leagues])
    span = ''
    if leagues:
        s0 = leagues[0][3]
        span = f'<span>{esc(s0["first"][:4])}–{esc(s0["last"][:4])}</span>'
    return (head + f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n</head>\n<body class="ds">'
            + shell['nav'] + '<main class="wrap page tool-page archive-page cricket-tools pp" id="top">'
            + '<nav class="pp-crumbs" aria-label="Breadcrumb"><a href="/player/">Players</a><span aria-hidden="true">/</span><span>' + esc(name) + '</span></nav>'
            + '<header class="pp-hero">' + face(name, slug, 'pp-portrait', eager=True)
            + '<div class="pp-hero-body"><p class="pp-chips">' + chips + span + '</p>'
            + f'<h1>{esc(name)}</h1>'
            + (f'<p class="pp-fullname">{esc(full_name)}</p>' if full_name != name else '')
            + (f'<p class="pp-lede">{esc("; ".join(facts))}.</p>' if facts else '')
            + ('<dl class="pp-big">' + ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(str(v))}</dd></div>' for k, v in big) + '</dl>' if big else '')
            + '<div class="pp-actions"><button type="button" class="pp-share" data-title="' + esc(name) + '">Share ↗</button>'
            + (f'<a href="/player-battle.html?competition={leagues[0][1]}&amp;first={esc(short)}">Battle this player ↗</a>' if leagues else '')
            + f'<a href="/player-battle.html?competition=international&amp;view=careers&amp;player={esc(pid)}">All formats ↗</a></div>'
            + '</div></header>'
            + '<div class="pp-grid">' + ''.join(cards) + '</div>'
            + '<p class="pp-note pp-sources">Ball-by-ball numbers come from Cricsheet scorecards (ODC-BY) and cover the matches in the archive, not necessarily a full career. '
            + 'League averages compare with every batter or bowler in the same phase. Career records list their own source and date. Portraits are illustrations made for this site. Short scorecard name'
            + ('s' if len(aliases) > 1 else '') + ': ' + esc(', '.join(aliases) or short or '–') + '.</p>'
            + '</main>' + shell['footer'].replace('<script defer src="/design-v2.js', '<script defer src="/player/player.js?v=2"></script><script defer src="/design-v2.js'))


def shell_from(source):
    """Head, nav and footer from fantasy.html, so player pages share the site's current layout."""
    text = source.read_text(encoding='utf-8')
    nav = re.search(r'<nav class="nav site-nav".*?</nav>', text, re.S).group(0)
    footer = re.search(r'<footer class="site-footer">.*</html>', text, re.S).group(0)
    styles = re.search(r'<link rel="stylesheet" href="/fonts/fonts.css">.*?\n', text).group(0)
    styles = styles.replace('href="record-lens.css', 'href="/record-lens.css').replace('href="tools.css', 'href="/tools.css')
    head = ('<!doctype html>\n<html lang="en"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<script>try{var t=localStorage.getItem(\'tcs-theme\');if(t===\'light\'||t===\'dark\')document.documentElement.setAttribute(\'data-theme\',t)}catch(e){}</script><title>{{TITLE}}</title>\n<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png">\n'
            '<link rel="canonical" href="{{URL}}">\n<meta name="description" content="{{DESC}}">\n<meta name="theme-color" content="#09090f" media="(prefers-color-scheme: dark)"><meta name="theme-color" content="#f6f6fb" media="(prefers-color-scheme: light)">\n'
            '<meta property="og:type" content="profile"><meta property="og:site_name" content="The Cricket Space">\n'
            '<meta property="og:title" content="{{OGTITLE}}">\n<meta property="og:description" content="{{DESC}}">\n<meta property="og:url" content="{{URL}}">\n'
            '<meta property="og:image" content="https://mstmayank.github.io/og-player-battle.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
            '<meta name="twitter:card" content="summary_large_image">\n' + styles.strip() + '<link rel="stylesheet" href="/player/player.css?v=ed-2">\n')
    return {'head': head, 'nav': nav.replace('<a href="/player/">Players</a>', '<a href="/player/" aria-current="page">Players</a>'), 'footer': footer}


def index_page(shell, entries, featured=()):
    groups = defaultdict(list)
    for name, slug, meta in sorted(entries, key=lambda e: e[0].lower()):
        letter = name[0].upper() if name[0].isalpha() else '#'
        groups[letter].append(f'<li><a href="/player/{slug}.html">{esc(name)}</a> <span>{esc(meta)}</span></li>')
    head = shell['head'].replace('{{TITLE}}', 'Player pages: IPL, WPL and international | The Cricket Space') \
        .replace('{{DESC}}', f'{len(entries)} player pages with career records, phase splits, seasons and match-ups from ball-by-ball data.') \
        .replace('{{URL}}', f'{SITE}/player/').replace('{{OGTITLE}}', 'Player pages | The Cricket Space')
    letters = ''.join(f'<a href="#l-{k}">{k}</a>' for k in sorted(groups))
    body = ''.join(f'<section class="pp-letter" id="l-{k}"><h2>{k}</h2><ul class="pp-list">{"".join(v)}</ul></section>' for k, v in sorted(groups.items()))
    return (head + '</head>\n<body class="ds">' + shell['nav'] + '<main class="wrap page tool-page archive-page cricket-tools pp" id="top">'
            + '<header class="pp-head"><p class="pp-eyebrow">Players</p><h1>Player pages</h1>'
            + f'<p class="pp-lede">{len(entries)} players with IPL, WPL, ODI or T20I records. Each page has career numbers by format, phase splits, seasons, recent form and main match-ups.</p></header>'
            + ('<section class="pp-featured" aria-labelledby="pp-feat"><h2 id="pp-feat">Featured players</h2><div class="pp-feat-grid">'
               + ''.join(f'<a class="pp-feat" href="/player/{slug}.html">{face(name, slug, "pp-feat-face")}<b>{esc(name)}</b><small>{esc(line)}</small></a>' for name, slug, line, _ in featured)
               + '</div></section>' if featured else '')
            + '<label class="pp-filter">Find a player <input type="search" id="pp-filter" placeholder="e.g. Kohli, Mandhana, Bumrah" autocomplete="off"></label>'
            + f'<nav class="pp-letters" aria-label="Jump to letter">{letters}</nav>{body}'
            + '<p class="pp-note" id="pp-empty" hidden>No player page matches. Try a surname.</p></main>'
            + shell['footer'].replace('<script defer src="/design-v2.js', '<script defer src="/player/player.js?v=2"></script><script defer src="/design-v2.js'))


def make_thumbnails(slug_of_name):
    """battle-art/<name>.jpg -> battle-art/thumbs/<name>.webp (360 px wide), only when missing or older.
    Pillow is only needed when a thumbnail has to be (re)made."""
    art, thumbs = ROOT / 'battle-art', ROOT / 'battle-art' / 'thumbs'
    thumbs.mkdir(exist_ok=True)
    out = {}
    for src in sorted(art.glob('*.jpg')):
        if src.stem in SKIP_ART:
            continue
        slug = slug_of_name(src.stem)
        if not slug:
            continue
        dst = thumbs / f'{src.stem}.webp'
        if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
            from PIL import Image
            with Image.open(src) as im:
                im = im.convert('RGB')
                im.thumbnail((360, 540))
                im.save(dst, 'WEBP', quality=78, method=6)
        out[slug] = f'/battle-art/thumbs/{src.stem}.webp'
    return out


def league_phase_averages(data):
    bat, bowl = [[0, 0] for _ in PHASES], [[0, 0] for _ in PHASES]
    for r in data['rows']:
        bat[r[3]][0] += r[4]; bat[r[3]][1] += r[5]
        bowl[r[3]][0] += r[10]; bowl[r[3]][1] += r[11]
    return {'bat': [ratio(a, b, 100) for a, b in bat], 'bowl': [ratio(a, b, 6) for a, b in bowl]}


HOME_START, HOME_END = '<!-- star-players:start (built by scripts/build-player-pages.py) -->', '<!-- star-players:end -->'


FOCUS = {}           # portrait file stem -> [x, y, face width] from battle-art/focus.json


def focus_style(slug):
    """CSS object-position that keeps the face in frame for a portrait (battle-art/focus.json)."""
    photo = PHOTOS.get(slug)
    if not photo:
        return ''
    cx, cy, _w = FOCUS.get(photo.rsplit('/', 1)[-1].split('.')[0], (.5, .25, .3))
    # Leave headroom: aligning the face's own height would cut the top of the head in wide frames.
    return f'object-position:{cx * 100:.0f}% {max(0, cy * 100 - 18):.0f}%'


def star_rail(featured):
    cards = ''.join(f'<a class="star-card" href="/player/{slug}.html"><div class="ed-photo"><img src="{PHOTOS[slug]}" alt="" style="{focus_style(slug)}" loading="lazy" decoding="async"></div>'
                    f'<b>{esc(name)}</b><small>{esc(line)}</small></a>' for name, slug, line, _ in featured[:16] if PHOTOS.get(slug))
    return (HOME_START + '<section class="ed-stack" data-reveal aria-labelledby="star-title"><div class="ed-row-head"><h2 class="ed-h2" id="star-title">Star players</h2>'
            '<a class="ed-more" href="/player/">All 983 players</a></div><div class="ed-marquee"><div class="track">' + cards + cards.replace('<a class="star-card"', '<a class="star-card" tabindex="-1" aria-hidden="true"') + '</div></div></section>' + HOME_END)


def faceoff(battle, ids, bat='V Kohli', bowl='JJ Bumrah'):
    data = battle['ipl']
    a, b = ids['ipl'].get(bat), ids['ipl'].get(bowl)
    runs = balls = outs = dots = 0
    for r in data['rows']:
        if r[1] == a and r[2] == b:
            runs += r[4]; balls += r[5]; outs += r[9]; dots += r[6]
    return {'runs': runs, 'balls': balls, 'outs': outs, 'sr': ratio(runs, balls, 100), 'dots': ratio(dots, balls, 100)}


def update_home(featured, fo):
    path = ROOT / 'index.html'
    text = path.read_text(encoding='utf-8')
    if HOME_START not in text:
        return False
    text = re.sub(re.escape(HOME_START) + '.*?' + re.escape(HOME_END), lambda _m: star_rail(featured), text, flags=re.S)
    text = re.sub(r'(<span data-fo="runs">)[^<]*', lambda m: m.group(1) + fmt(fo['runs']), text)
    text = re.sub(r'(<span data-fo="balls">)[^<]*', lambda m: m.group(1) + fmt(fo['balls']), text)
    text = re.sub(r'(<span data-fo="outs">)[^<]*', lambda m: m.group(1) + str(fo['outs']), text)
    text = re.sub(r'(<span data-fo="sr">)[^<]*', lambda m: m.group(1) + fmt(fo['sr'], 1), text)
    text = re.sub(r'(<span data-fo="dots">)[^<]*', lambda m: m.group(1) + fmt(fo['dots'], 0) + '%', text)
    path.write_text(text, encoding='utf-8')
    return True


def update_sitemap(slugs):
    path = ROOT / 'sitemap.xml'
    text = path.read_text(encoding='utf-8')
    text = re.sub(re.escape(SITEMAP_START) + r'.*?' + re.escape(SITEMAP_END) + r'\n', '', text, flags=re.S)
    block = SITEMAP_START + '\n' + f'  <url><loc>{SITE}/player/</loc></url>\n' + ''.join(f'  <url><loc>{SITE}/player/{s}.html</loc></url>\n' for s in sorted(slugs)) + SITEMAP_END + '\n'
    path.write_text(text.replace('</urlset>', block + '</urlset>'), encoding='utf-8')


def main():
    index = load('player-career-index.json')['players']
    records = load('player-career-data.json')['players']
    battle = {key: load(f'battle-{key}.json') for key in LEAGUES.values()}
    ids = {key: {n: i for i, n in enumerate(d['players'])} for key, d in battle.items()}
    previous = {}
    if (OUT / 'links.json').exists():
        previous = load('player/links.json').get('byId', {})
    chosen = [r for r in index if r[0] in records and any(f in records[r[0]]['formats'] for f in PAGE_FORMATS)]
    # Stable slugs: keep earlier ones; new names get their full-name slug, or name + id on a clash.
    taken, slug_of = set(previous.values()), {}
    for r in chosen:
        if r[0] in previous:
            slug_of[r[0]] = previous[r[0]]
    counts = defaultdict(int)
    for r in chosen:
        counts[short_slug(r[1])] += 1
        counts[slugify(r[1])] += 1 if short_slug(r[1]) != slugify(r[1]) else 0
    for r in chosen:
        if r[0] in slug_of:
            continue
        slug = short_slug(r[1])
        if counts[slug] > 1 or slug in taken or slug == 'index':
            slug = slugify(r[1])
            if counts[slug] > 1 or slug in taken or slug == 'index':
                slug = f'{slug}-{r[0].split(":")[-1][:6]}'
        taken.add(slug)
        slug_of[r[0]] = slug
    # Which scorecard name a player has in each league's ball-by-ball data.
    short_of, by_short = {}, defaultdict(dict)
    for r in chosen:
        fmts = records[r[0]]['formats']
        for label, key in LEAGUES.items():
            if label not in fmts:
                continue
            names = [n for n in r[4] + [r[1]] if n in ids[key]]
            if len(names) >= 1:
                short_of[(r[0], key)] = names[0]
    claimed = defaultdict(list)
    for (pid, key), short in short_of.items():
        claimed[(key, short)].append(pid)
    for (key, short), pids in claimed.items():
        if len(pids) == 1:
            by_short[key][short] = slug_of[pids[0]]
        else:
            for pid in pids:
                short_of.pop((pid, key), None)   # two players share a scorecard name: do not guess
    slugs = {(key, short): slug for key, names in by_short.items() for short, slug in names.items()}
    shell = shell_from(ROOT / 'fantasy.html')
    all_slugs = set(slug_of.values())
    PHOTOS.clear()
    FOCUS.clear()
    FOCUS.update(load('battle-art/focus.json'))
    match_art = lambda stem: PORTRAIT_SLUGS.get(stem) or (stem if stem in all_slugs else None)
    PHOTOS.update(make_thumbnails(match_art))
    DISPLAY.clear()
    DISPLAY.update(known_names(match_art))
    for key, data in battle.items():
        LEAGUE_PHASES[key] = league_phase_averages(data)
    featured = []
    OUT.mkdir(exist_ok=True)
    keep = {'player.js', 'player.css', 'links.json', 'galaxy.json', 'index.html'}
    wanted = {f'{s}.html' for s in slug_of.values()}
    for old in OUT.glob('*.html'):
        if old.name not in wanted and old.name not in keep:
            old.unlink()
    international = international_figures()
    entries, total, galaxy = [], 0, []
    for r in chosen:
        leagues = []
        for label, key in LEAGUES.items():
            short = short_of.get((r[0], key))
            if short is None:
                continue
            s = league_stats(battle[key], ids[key][short])
            if s:
                leagues.append((label, key, short, s, battle[key]))
        if PHOTOS.get(slug_of[r[0]]) and leagues:
            label, _k, _sh, s0, _d = leagues[0]
            bb, ww = s0['batting'], s0['bowling']
            line = (f'{label} · {fmt(bb["runs"])} runs · SR {fmt(bb["sr"], 1)}' if bb and (not ww or bb['balls'] >= ww['legal'])
                    else f'{label} · {fmt(ww["wickets"])} wkts · econ {fmt(ww["econ"])}')
            featured.append((DISPLAY.get(slug_of[r[0]], r[1]), slug_of[r[0]], line, s0['matches']))
        if leagues:
            label, _k, _sh, s0, _d = leagues[0]
            bb, ww = s0['batting'] or {}, s0['bowling'] or {}
            shown = DISPLAY.get(slug_of[r[0]]) or common_name(r[1], _sh, slug_of[r[0]])
            galaxy.append([shown, slug_of[r[0]], label, s0['matches'], bb.get('runs', 0), ww.get('wickets', 0)] + ([r[1]] if r[1] != shown else []))
        text = page(shell, slug_of[r[0]], r, records[r[0]], leagues, slugs, international.get(r[0]))
        (OUT / f'{slug_of[r[0]]}.html').write_text(text, encoding='utf-8')
        total += len(text.encode())
        meta = ' · '.join(x for x in [r[2]] + [f for f, _ in FORMATS if f in records[r[0]]['formats'] and f in PAGE_FORMATS] if x)
        entries.append((r[1], slug_of[r[0]], meta))
    featured.sort(key=lambda f: -f[3])
    (OUT / 'index.html').write_text(index_page(shell, entries, featured), encoding='utf-8')
    home = update_home(featured, faceoff(battle, ids))
    links = {'generated': date.today().isoformat(), 'note': 'Short scorecard name -> /player/<slug>.html, per competition. Built by scripts/build-player-pages.py.',
             'ipl': dict(sorted(by_short['ipl'].items())), 'wpl': dict(sorted(by_short['wpl'].items())),
             'byId': dict(sorted(slug_of.items())), 'photos': dict(sorted(PHOTOS.items())),
             'faces': {slug: url.replace('/thumbs/', '/faces/') for slug, url in sorted(PHOTOS.items()) if (ROOT / url.lstrip('/').replace('/thumbs/', '/faces/')).exists()}}
    (OUT / 'links.json').write_text(json.dumps(links, separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    # The homepage galaxy: one star per player with IPL or WPL data. [name, slug, league, matches, runs, wickets, full name if different]
    (OUT / 'galaxy.json').write_text(json.dumps(sorted(galaxy, key=lambda g: -g[3]), separators=(',', ':'), ensure_ascii=False) + '\n', encoding='utf-8')
    update_sitemap(slug_of.values())
    print(f'Wrote {len(chosen)} player pages ({total / 1e6:.1f} MB), player/index.html, player/links.json '
          f'({len(by_short["ipl"])} IPL and {len(by_short["wpl"])} WPL scorecard names linked, {len(PHOTOS)} portraits); updated sitemap.xml'
          + (' and the homepage star rail' if home else ''))


if __name__ == '__main__':
    main()
