# Editorial redesign review

Branch `redesign/editorial-yellow` starts at `cb82a2e`. Serve the worktree root using `python3 -m http.server 8791 --bind 127.0.0.1` and visit http://127.0.0.1:8791/. Root-relative asset paths require an HTTP server at the site root.

## Route inventory

| Route | Changes and coverage |
| --- | --- |
| / and /public/index.html | Responsive editorial cover, tool shortcuts, featured portraits, writing and auction entry. The older public copy forwards to the homepage. |
| /#onthisday, /#about, /#contact | Homepage sections retain their existing content and actions. |
| /tools.html | New filterable directory with ten working destinations and accessible result counts. |
| /ipl-auction/play.html | Franchise selection with trophy image, live bidding with franchise purse and squad count, shared setup and results styling. |
| /ipl-auction/multiplayer.html | Lobby and room use the same game styles and theme controls. |
| /ipl-auction/index.html, /ipl-lens.html | Existing compatibility entries forward visitors to the relevant tool. |
| /player-battle.html | Shared controls, text, surface and navigation styles for IPL, WPL and international comparisons. |
| /match.html, /preview.html, /venues.html, /record-book.html | Existing charts, previews, venue insights and records keep their data views behind the shared navigation and visual system. |
| /fantasy.html | The projected XI appears on a cricket field with captain and vice-captain indicated. Role breakdowns and point estimates follow. |
| /quiz.html, /ipl-retentions.html | Existing quiz and retention archive use shared page styling. |
| /player/ and generated pages | 984 HTML documents in the player directory, including index pages, share navigation and profile styling. Portraits appear where assets exist. |
| /writing.html, /what-makes-the-ipl-so-special.html | Illustrated story listing, article lead image, serif article text and bounded reading width. |
| /404.html, /for-you.html | Error recovery page uses shared styling. Private page retains its separate gate and now uses the shared palette. |

## Design system

The site and auction bundles consume styles/tokens.css. The default is light, with off-white pages, white surfaces, dark body text and yellow primary game actions. Saved theme choices are respected. DM Sans handles navigation and controls. Serif accents distinguish editorial text. The navigation uses an icon-only menu. The two new WebP images are stored locally.

## Verification checklist

- [x] Build both auction bundles with npm run build:auction. esbuild reports that the existing game TypeScript configuration references a missing base tsconfig.json.
- [x] Run 99 JavaScript and TypeScript tests with node --import tsx --test tests/*.test.ts.
- [x] Run 43 Python tests with python3 -m unittest discover -s tests.
- [x] Check 18 representative routes at 390, 768 and 1440 CSS pixels in the browser. All exposed a page heading and fit the document width at the time of measurement. This measures the outer document and allows intentional internal table scrolling.
- [x] Inspect homepage and auction setup screenshots, adjust mobile image placement and capture the final layouts.
- [x] Search the Tools directory and place a solo auction bid. The bidding view reported the selected franchise leading at the entered amount.
- [ ] Run an end-to-end multiplayer game between two devices against the configured backend.
- [ ] Manually review every generated profile, the gated page after unlocking, native mobile sharing and physical iOS/Android behavior before release.

No separate lint command is configured. The designs use the site's existing stories, archive and player assets. The sample video library and sample articles have no counterpart in the content repository.
