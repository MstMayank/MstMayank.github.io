# TCS retained-core rating v2

Open a retention room, retain players and press **Rate my squad**. Every eligible retained player contributes, regardless of search filters. There is no generated XI, four-overseas selection cutoff, bench-depth component or penalty for leaving XI/bench slots vacant. A small core is labelled provisional. Choices changing invalidate the displayed report; the rating never modifies the save or purse.

## Weights

- Recent IPL form: 30. 2025–26 player role performance, weighted 1:2.
- Batting strength: 20. Six-season run-rate percentile (55%) plus runs-per-dismissal percentile (45%).
- Bowling strength: 20. Six-season economy and wickets-per-ball percentiles, equally weighted.
- Role coverage: 15. Six points each for batting/bowling options relative to the retained count (ceil 50% / ceil 40%), three for a wicketkeeper. These are model assumptions, not official squad requirements.
- Match consistency: 10. Percentile of useful-contribution frequency from available Cricsheet innings. Batting success: 20+ runs or 10+ runs at SR 150+. Bowling: 2+ wickets or economy <=8.5 over 12+ legal deliveries. At least eight weighted innings; (success+2)/(innings+4) sample smoothing. This is a custom contribution-frequency definition, not an official consistency statistic.
- Value for money: 5. Role performance / sqrt(published salary in lakh), percentile against the reference roster. Announced trade fees override old salaries. Missing salaries remain unavailable.

Historical weights rise 1–6 over 2021–2026. Performance needs 60 weighted deliveries per discipline. Batting no-dismissal samples use one as denominator for model stability. Role performance uses batting for batters/keepers, bowling for bowlers, average available disciplines for all-rounders. Historical bowling samples of 120 weighted deliveries also establish a bowling option.

Scores are relative percentiles rather than school grades; franchise identity, reputation, trophies or an expected target score do not change the formula. The same selected players receive the same result under any franchise label.

Unavailable components are omitted and the overall score explicitly rescaled by assessed model weight. Missing individual samples are never zero ability. Confidence includes sample sufficiency, primary-role and discipline coverage, and available component weights. With no primary performance data no overall score is returned. Fewer than three players, missing coverage or confidence below 70% are provisional. Confidence is not prediction accuracy.

## Data and reproduction

Performance: 849 current-roster player-season rows in `prisma/data/ipl-six-season-stats.json`, Cricsheet 2021–23 plus the existing checked official IPL 2024–26 snapshot (2025 incomplete). Run `python3 scripts/build-six-season-stats.py --archive /absolute/path/ipl.zip`.

Consistency: 820 current-roster player-season contribution rows in `prisma/data/ipl-rating-consistency.json`. Run `python3 scripts/build-rating-consistency.py --archive /absolute/path/ipl.zip`. Archive match coverage is 60/74/74/71/74/74 for 2021–26. The separate Cricsheet consistency coverage does not change official scorecard totals or fill missing performance figures. Both artifacts record input SHA256 and provenance. Exact aliases / unique canonical first-and-last identities only; ambiguous names remain unavailable.

Cricsheet attribution: https://cricsheet.org/downloads/ under ODC Attribution 1.0 https://opendatacommons.org/licenses/by/1-0/. Regular innings only; no super overs. Six historical leader anchors reconcile in tests. No record does not prove zero performance. Does not assess fielding, fitness, availability, domestic form or phase specialism.

Build: `node scripts/build-browser-auction.mjs`. Checks: `node --import tsx --test tests/*.test.ts`, `npm run typecheck`, `npm run lint`. Data and rating load on demand; existing saves and routes are preserved. v2 replaces v1; old and new scores are not directly comparable.

Explicit roster-to-canonical aliases are stored in `prisma/data/ipl-player-name-aliases.json` and used by both importers (including Cummins, Salt, David, Bhuvneshwar and Jadeja). Regression tests require these identities to resolve.
