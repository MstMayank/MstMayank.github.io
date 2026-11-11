# IPL-only team rating engine v3

This is an integrated update to the existing Next.js / GitHub Pages simulator. Rating lives behind the existing compact **Rate your squad** disclosure; direct squad-image sharing is unchanged. No database migration, new authentication or hosting service is required.

## Data boundary

The rating adapter imports only `prisma/data/ipl-rating-data.json` and verified/published acquisition-cost references. Domestic/international/career performance is never imported or read. The separate player-details feature may still display older career records; those do not enter the rating engine.

IPL 2024, 2025 and 2026 completion is linked to official final reports in the data manifest. Fixed season weights are 20%, 30%, 50%. Validation rejects non-IPL records, other years, incomplete/unverified seasons, duplicate player seasons/match IDs, missing counters and unreconciled phase totals.

The reproducible importer validates delivery arithmetic and matches each game to a unique checked official scorecard by date and teams. It reconciles regular-innings runs, wickets and legal balls before atomically committing any player totals. Super overs are excluded. Coverage: 2024 71/71 archive games; 2025 72/74; 2026 74/74. The inconsistent 4 April 2025 scorecard and suspended original 8 May fixture are excluded. No-play fixtures do not become zero-valued player records. There are 612 player-season records and 375 player metadata entries (including current players without records).

Source: Cricsheet, https://cricsheet.org/downloads/, ODC Attribution 1.0 https://opendatacommons.org/licenses/by/1-0/. The JSON retains match IDs, independent official scorecard URLs, completion links, exclusions and archive/metadata SHA256 fingerprints. Bowling styles and keeper/bowler classifications come from the existing source-labelled profile metadata snapshot; missing classifications remain unknown. This metadata contains no performance inputs to the rating. Profile classifications take precedence over incorrect legacy roster categories (e.g. Phil Salt keeper / Bhuvneshwar bowler).

Rebuild:

```
python3 scripts/build-ipl-rating-data.py --archive /absolute/path/ipl.zip --metadata-csv /absolute/path/player_meta.csv
```

## Configurable formulas

`lib/ipl-auction/rating/config.ts` owns season weights, all ten team weights, role profiles, sample priors, selection weights, role targets and default XI constraints.

Team weights: batting 20; bowling 20; balance 15; form 10; death 10; depth 8; experience 5; powerplay 5; spin/pace 5; value 2.

Player cohorts are split by season and role: observed IPL batting positions distinguish opener/middle/finisher; profile metadata distinguishes keeper, pace/spin and qualifying all-round options. Insufficient cohorts are unavailable, without a cross-role fallback. Batting scores independent efficiency/survival groups (SR / runs per dismissal); bowling scores control/strike groups (economy / wickets per legal ball). Boundary-ball %, dot %, bowling average and bowling strike rate are also explained as diagnostics, not separately added to correlated scoring groups.

A sample's percentile shrinks towards a disclosed neutral prior of 50 using `balls/(balls+prior) * matches/(matches+12)`. Delivery priors: batting 180, bowling 120, phase 48. The minimum comparison-cohort sample is 36 balls (12 for phases), with five peers. Zero denominators remain null; no-dismissal model survival uses denominator one for stability, separately from the undefined displayed average. Form is sample-adjusted useful-contribution frequency (batting 20+ or 10+ at SR150; bowling 2+ wickets or economy <=8.5 over at least two overs).

Season scores combine as 0.2/0.3/0.5, renormalising only measured seasons while reporting lost season coverage. Confidence reflects delivery/appearance support, available model weight and metric coverage; it is not a probability of winning.

Team batting/bowling foundations use middle-over evidence; PP and death have their own non-overlapping phase buckets. Phases are scheduled overs 1–6, 7–15, 16–20, even for shortened games. Player phase ratings and phase raw metrics remain separate. Depth scores bench quantity and evidence-backed backup roles, without adding the same rate-quality score again. Experience is verified 2024–26 appearances only, not full-career experience. Value compares role performance / sqrt(verified salary in lakh), against the roster cost cohort; it has only 2% weight.

## Legal XI / scope

Exact 0/1 dynamic programming maximises the configured additive selection utility (70% role quality, 20% phase suitability, 10% experience), not the nonlinear full-squad score or predicted wins. This is explicitly disclosed. It is tested against brute force. Defaults: 11 players, maximum four overseas, one keeper, six batting and five bowling options. These are configurable simulation constraints, not a claim of official 2027 retention rules. Optional `session.rules.playingXI` overrides them independently of the unrestricted retention count.

Full Squad assesses every owned eligible retained/acquired player using sample-reliability weights, without silently selecting only eleven. Starting XI assesses only the legal selection. Its bench weight is non-applicable: 92 applicable points rescale explicitly to 100. Full Squad uses all 100. If no legal XI exists, Starting XI and depth remain unavailable; the owned core can still receive a clearly provisional assessment. Unknown performance is never zero ability. Unrated players may use the disclosed neutral prior **only for selection utility**; their performance fields stay null and confidence falls.

## Reactivity and purchases

The open dashboard recalculates on session ownership, price, decision or rule changes. Stale results are hidden while the latest snapshot is evaluated; the disclosure stays open after retain/release. `ipl-auction:squad-updated` triggers a session reload for future mutation integrations.

`SessionView.ratingPurchases` accepts acquired player snapshots with verified cost. The same engine includes them, rejects duplicate retained/purchased IDs and re-evaluates the XI. Tests cover this integration contract. The existing product is retention-only: it has no bidding/purchase route or purchase UI. This change does **not** pretend that flow exists or add one; a future auction mutation must persist ownership and populate this field in its session response before dispatching the reload event.

## Validation / run

```
node --import tsx --test tests/*.test.ts
npm run typecheck
npm run lint
npx eslint browser-auction --max-warnings=0
node scripts/build-browser-auction.mjs
npm run build
```

42 tests pass, including role cohorts, 20/30/50 weighting, tiny samples, data rejection, missing values, exact/legal XI, configured rules, foreign-stat independence, purchase snapshots, duplicates and retain/release. All ten franchise baseline pools have been audited in memory, without touching user saves; hypothetical whole-pool audits do not establish affordability or predictive validity.

The Next app runs with the project's existing `npm run dev`/database configuration. The published Pages version uses generated `ipl-auction/` files, requires no backend and preserves the existing latest local save. Data loads lazily when rating opens. Browser checks confirmed auto-refresh, legal XI/full-squad switching and no page overflow at 390px.

The model remains an explainable custom simulation, not calibrated as a win probability or an official IPL score. Correlation between economic value/form/quality concepts can still exist; algebraically redundant rate metrics and repeated phase awards are avoided. Source coverage, metadata age and small IPL samples limit confidence.
