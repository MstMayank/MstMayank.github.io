# The Cricket Space

Cricket stories, records and player comparisons by Mayank Shekhar Tiwari, live at <https://mstmayank.github.io/>.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Homepage: writing, On This Day, tools and contact |
| `player-battle.html` | Batter vs bowler, player vs player and team matchups for IPL, WPL and international cricket, player profiles, and a match-up finder that ranks every opponent of one player |
| `record-book.html` | Searchable international batting, bowling and team-total records |
| `venues.html` | IPL and WPL ground-by-ground stats: average scores, par scores, chasing record, toss trends, phase run rates, top performers and team records |
| `preview.html` | Match preview for any two IPL or WPL teams and a ground: head to head, venue summary, key battles, phase strengths and players in form |
| `match.html` | Every IPL and WPL match: worm, Manhattan and ball-by-ball win-probability charts, with top batters and bowlers |
| `ipl-retentions.html` | IPL 2027 retained squads for all 10 teams, rated and ranked |
| `ipl-auction/play.html` | IPL mini-auction game (solo) and `ipl-auction/multiplayer.html` (rooms with friends) |
| `what-makes-the-ipl-so-special.html` | Article |

## Data

- **Record Book** loads `archive-players-<format>.bin` (gzip-compressed JSON, rows stored
  column by column to keep downloads small; see `pack_rows` in `scripts/refresh-cricket.py`). The
  `Refresh cricket records and history` GitHub Action runs `scripts/refresh-cricket.py`
  on a schedule, adds newly completed international matches and commits only when data
  changes. `cricket-records-status.json` holds each archive's revision for cache busting.
- **Player Battle** loads `battle-<competition>.json` and `battle-insights-<competition>.json`.
  Search also matches full names through `battle-name-aliases.json`; regenerate it after
  updating `player-career-index.json`:

  ```sh
  python scripts/build-battle-aliases.py
  ```

- **Match-up finder** (Player Battle, `?view=finder&player=V%20Kohli&role=batting`) ranks every
  opponent of one player with `matchup-core.js`: strike rate and dismissal rate against the
  player's own record for the selection, with small samples pulled toward that record (60 balls
  of the player's average are added to each pair). Tests: `tests/matchup-core.test.ts`.
- **Phase profiles** (Match-ups tab, and Batter vs Batter / Bowler vs Bowler) show each player's
  powerplay, middle and death numbers against the average for that phase in the same selection,
  with role labels such as "Death finisher". Maths and label rules: `phase-core.js`
  (`LABEL_RULES`). Tests: `tests/phase-core.test.ts`. Not shown for Tests.
- **Form tracker** (Match-ups tab): a player's last 10 innings or matches with a sparkline,
  last-10 vs career numbers and an In form / Steady / Out of form badge; with no player picked
  it lists the form leaders of the latest season. Maths and badge rules: `form-core.js`
  (`FORM_RULES`). Tests: `tests/form-core.test.ts`.
- **Impact & clutch** (Match-ups tab, IPL and WPL): runs above expected, runs saved, pressure
  batting and bowling, and match-winning knocks from `impact-<competition>.json`, built by
  `scripts/build-impact-stats.py` (definitions at the top of the script; weekly workflow).
  Tests: `tests/test_impact_stats.py`.
- **Batting position** (Match-ups tab, IPL and WPL batters): how a batter does by the over and
  score he walks in at, a strike-rate strip by entry over, and a suggested role (top order,
  middle order, finisher or floater). Data: `entry-<competition>.json`, written by the same
  script (rules in `ENTRY_ROLES`).
- **Match charts** (`match.html?id=<cricsheet id>`) load `match-index-<competition>.json` (match list
  and the fitted win-probability model) and one `matches/<competition>/<season>.json` file, built by
  `scripts/build-match-charts.py` (model details at the top of the script; weekly workflow).
  Tests: `tests/test_match_charts.py`.
- **Pace vs spin**: `data/bowler-types.json` (all bowlers) and `data/bowler-types/<competition>.json`
  (small per-page files) give each bowler a type (pace or spin) and sub-type (right-/left-arm pace,
  off-spin, leg-spin, left-arm orthodox, left-arm wrist spin). Styles come from `player_meta` in the
  cricketdata R package (GPL-3.0, from ESPNcricinfo) and are matched to scorecard names through the
  Cricsheet registry, per competition; names that stay ambiguous are left unknown. Coverage: 99% of
  IPL balls, 89–99% elsewhere. Rebuild when needed (not in the weekly workflow):

  ```sh
  pip install pyreadr
  curl -LO https://raw.githubusercontent.com/robjhyndman/cricketdata/master/data/player_meta.rda
  python scripts/build-bowler-types.py --meta player_meta.rda --zip ipl_json.zip --zip wpl_json.zip --zip t20s_json.zip --zip odis_json.zip --zip tests_json.zip
  ```

  Used by Player Battle (a "Vs pace & spin" card and a bowler-type filter in the match-up finder) and
  by the venue pages (pace vs spin economy, average and wicket share; `paceSpin` in venue stats).
  Tests: `tests/test_bowler_types.py`, `tests/test_venue_stats.py`.
- **Venues** loads `venue-stats-ipl.json` and `venue-stats-wpl.json`, built from Cricsheet
  ball-by-ball data by `scripts/build-venue-stats.py` (the `Refresh venue stats` workflow runs it
  weekly). Venue names are merged with the same list as Player Battle (`venueAliases` in
  `player-battle.js`; a test keeps them in step). Averages leave out no-result and rain-reduced
  matches. Tests: `tests/test_venue_stats.py`.

  ```sh
  python scripts/build-venue-stats.py                  # IPL
  python scripts/build-venue-stats.py --competition wpl
  ```

- **Match preview** loads `team-stats-<competition>.json` (per-team, per-season results and
  phase totals, latest squads and a compact match list), `venue-stats-<competition>.json` and
  `battle-<competition>.json`. Key battles use `matchup-core.js` and form uses `form-core.js`.
  `scripts/build-venue-stats.py` writes the team stats in the same run as the venue stats.

- **IPL Retentions** reads `ipl-retentions-data.json`, generated from the verified squads in
  `data/ipl-2027-retentions.json` with the V6 squad rating (same weights as the original
  retention game):

  ```sh
  npx tsx scripts/build-retention-ratings.ts
  ```

  The script applies `data/ipl-rating-identity-fixes.json`, which links roster players whose
  IPL records sit under Cricsheet ids (for example Vaibhav Sooryavanshi and Rohit Sharma).

- **IPL Auction** is built from `browser-auction/` (shared with the Next.js source in `app/`,
  `components/` and `lib/`). Official 2027 lists go in `browser-auction/game/mini-auction.json`;
  the game stays locked until retentions and registrations are confirmed. Rebuild with:

  ```sh
  npm install
  npm run build:auction
  ```

## Fonts

Fonts are self-hosted from `fonts/` (`fonts/fonts.css`, latin and latin-ext subsets from the
`@fontsource` packages, SIL Open Font License). Link `/fonts/fonts.css` instead of Google Fonts.

## Tests

```sh
python -m unittest discover -s tests -p 'test_*.py'
npm run test:auction
```
