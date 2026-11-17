# The Cricket Space

Cricket stories, records and player comparisons by Mayank Shekhar Tiwari, live at <https://mstmayank.github.io/>.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Homepage: writing, On This Day, tools and contact |
| `player-battle.html` | Batter vs bowler, player vs player and team matchups for IPL, WPL and international cricket, plus player profiles |
| `record-book.html` | Searchable international batting, bowling and team-total records |
| `ipl-auction/play.html` | IPL mini-auction game (solo) and `ipl-auction/multiplayer.html` (rooms with friends) |
| `what-makes-the-ipl-so-special.html` | Article |

## Data

- **Record Book** loads `archive-players-<format>.bin` (gzip-compressed JSON). The
  `Refresh cricket records and history` GitHub Action runs `scripts/refresh-cricket.py`
  on a schedule, adds newly completed international matches and commits only when data
  changes. `cricket-records-status.json` holds each archive's revision for cache busting.
- **Player Battle** loads `battle-<competition>.json` and `battle-insights-<competition>.json`.
  Search also matches full names through `battle-name-aliases.json`; regenerate it after
  updating `player-career-index.json`:

  ```sh
  python scripts/build-battle-aliases.py
  ```

- **IPL Auction** is built from `browser-auction/` (shared with the Next.js source in `app/`,
  `components/` and `lib/`). Official 2027 lists go in `browser-auction/game/mini-auction.json`;
  the game stays locked until retentions and registrations are confirmed. Rebuild with:

  ```sh
  npm install
  npm run build:auction
  ```

## Tests

```sh
python -m unittest discover -s tests -p 'test_*.py'
npm run test:auction
```
