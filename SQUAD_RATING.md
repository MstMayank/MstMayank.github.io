# TCS squad rating v1

Browser-only, on-demand, no server or paid API. Open a retention room, retain players and press **Rate my squad**. The result is derived from the latest choices and is invalidated when choices change. It does not alter or enlarge the saved game.

The window is 2021–2026. Season weights 1–6, expressed as equivalent 2026 deliveries for sample thresholds. Batting: 55% run-rate percentile + 45% average percentile. Bowling: equal economy and wickets-per-ball percentiles. Cohort is current roster players with at least 60 weighted deliveries in that discipline. No-dismissal batting average uses denominator one for model stability. These model averages are separate from displayed scorecard averages.

Suggested XI: keeper first, up to five bowling options, then batting/remaining players ranked by their strongest discipline. At most four overseas players. This is a greedy suggestion, not an exhaustive best-XI optimiser. Bowling options include roster bowlers/all-rounders and players with 120 weighted bowling deliveries. Two-discipline options include roster all-rounders or 300 batting plus 120 bowling deliveries.

Weights: batting 25, bowling 25, XI balance 20 (six batting + five bowling options), two-discipline options 10 (two), keeper 10 (one), bench 10 (seven). Missing performance samples are omitted rather than zero-filled; if a whole performance component is unavailable no overall rating is given. Results with fewer than 11 players, inadequate samples or incomplete XI performance coverage are provisional. Delivery confidence is sample sufficiency, not a prediction or win probability. Fame and salary do not affect the score.

## Reproducible data

Run `python3 scripts/build-six-season-stats.py --archive /absolute/path/ipl.zip` with the local Cricsheet JSON ZIP. It reads existing player aliases from `player-career-index.json`, unique canonical first/last names, and explicit full-name aliases. Ambiguous/unmatched identities are left unavailable; no fuzzy surname matching. The artifact records the archive SHA256, provenance, match references, numerator/denominator audit and withheld identities.

2021–23 archive coverage: 60, 74, 74 matches. Cricsheet, https://cricsheet.org/downloads/, ODC-BY-1.0 https://opendatacommons.org/licenses/by/1-0/. 2024–26 retain the existing checked official IPL snapshot unchanged; 2025 coverage remains incomplete. Six historical leader anchors reconcile (Gaikwad/Harshal 2021, Buttler/Chahal 2022, Gill/Shami 2023). Source and scorecard total reconciliation for the official snapshot remains in its existing tests.

817 player-season records are available for the present roster, not all historical IPL players. No record does not establish a zero-stat season. Historical archive stats, role assumptions and incomplete coverage limit this model. It does not assess fitness, availability, fielding or phase specialisms.

Build: `node scripts/build-browser-auction.mjs`. Tests: `node --import tsx --test tests/*.test.ts`. Rating/stat modules and shared data are lazy chunks; source match URL lists stay in the auditable JSON but are stripped from browser bundles. Existing saved games and homepage routes are preserved.
