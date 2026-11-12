# IPL 2027 expert squad assessment

Open **Rate your squad** in the retention dashboard. The report refreshes with the
current roster and compares it with the nine other franchises' baseline squads.

The six weights are 30% batting, 30% bowling, 15% Playing XI balance, 10% bench,
10% phase coverage and 5% fielding and wicketkeeping. The score is the weighted
sum. V6 uses the ten supplied expert baselines for the full simulator rosters.
Current squads are rated with the same IPL model as the full roster and each
category moves by the net difference. The legacy exact-squad references remain
available in the uncalibrated evaluator.

The 274 supplied impact records are indexed by player ID. Manual estimates
take precedence in the listed discipline. Model estimates blend into existing
IPL evidence; entries without season evidence do not invent performance.
Impact estimates are provisional and do not increase IPL data confidence.

The evidence uses completed IPL 2025 (40%) and IPL 2026 (60%). A missing season
reduces evidence confidence and the available season supplies the estimate.
Limited samples are shrunk towards a conservative prior. Cricsheet innings
totals, overs and wickets were checked against official scorecards before
including the deliveries. Catch, stumping and run-out involvements are
recorded events. Dropped chances and general ground-fielding reliability
remain unavailable, so fielding is provisional.

The engine seeds XI selection with a constrained search and improves batting
order, balance and phase coverage through legal swaps. The suggested Impact
Player is an eligible nominated reserve. Overseas Impact options require
fewer than four overseas players in the starting XI, following the published
IPL playing conditions as a simulation assumption.

The existing site saves one user's retention session. Purchase snapshots are
supported by the evaluator. There is currently no bidding or purchase screen
and no active transaction stream for the other nine franchises.

Maintainers can review and commit IPL-only player profiles in
`lib/ipl-auction/rating/expert-config.ts`. Each entry needs a known player ID,
reviewer and evidence URL. Update the methodology version when changing
scoring inputs. The rating cache is in-memory and scoped to that version.

Run `node --import tsx --test tests/*.test.ts` and
`node --import tsx scripts/audit-ipl-rating.ts` to check the model.
