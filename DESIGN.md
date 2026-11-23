---
version: alpha
name: The-Cricket-Space-Floodlights
description: |
  "Floodlights" is the single theme of The Cricket Space: a night match under lights. A near-black
  ground, floodlight lime for every action, scoreboard cyan for data, and wicket red for outs.
  Headings and numbers use Chakra Petch, a squared scoreboard face; reading text uses Barlow.
  The site is dark only, with no light theme and no theme switch. Numbers are the hero:
  every section earns its place with a real stat from the ball-by-ball data, never an adjective.
  Glow is the one decorative device and belongs to interactive things and key numbers only.

colors:
  night: "#06080a"          # page background
  ground: "#0b1110"         # second background band
  panel: "#0f1716"          # cards, inputs, table bodies
  panel-2: "#142120"        # raised card, hover fill
  panel-3: "#1a2a28"        # pressed / selected fill
  line: "#1f2e2c"           # hairlines, card borders
  line-2: "#2c403d"         # stronger borders, outline buttons
  chalk: "#eaf2ee"          # primary text
  chalk-2: "#d4dfda"        # long-form body text
  mist: "#a7b8b2"           # secondary text
  subtle: "#8a9e97"         # captions, meta
  dim: "#7d918a"            # smallest meta only (≥ 14px)
  lime: "#c8ff3c"           # ACTION: primary buttons, current nav, links in focus, key accent
  lime-2: "#d8ff6a"         # lime gradient start
  lime-deep: "#9ad11a"      # lime gradient end, pressed
  on-lime: "#071006"        # text on lime
  cyan: "#3fe3ff"           # DATA: highlighted stats, focus ring, charts series 1
  red: "#ff4f6d"            # OUTS: wickets, losses, errors, destructive
  lime-soft: "rgba(200,255,60,.12)"
  red-soft: "rgba(255,79,109,.12)"

typography:
  display-hero:   { fontFamily: Chakra Petch, fontSize: "clamp(58px, 8.6vw, 128px)", fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: uppercase }
  display-big-num:{ fontFamily: Chakra Petch, fontSize: "clamp(64px, 10vw, 150px)", fontWeight: 700, lineHeight: 0.85 }
  h2-section:     { fontFamily: Chakra Petch, fontSize: "clamp(40px, 5.6vw, 80px)", fontWeight: 700, lineHeight: 1.0 }
  h3-card:        { fontFamily: Chakra Petch, fontSize: "clamp(32px, 3.6vw, 52px)", fontWeight: 700, lineHeight: 1.05 }
  quote:          { fontFamily: Chakra Petch, fontSize: "clamp(28px, 3.4vw, 46px)", fontWeight: 700, lineHeight: 1.12 }
  stat:           { fontFamily: Chakra Petch, fontSize: "clamp(24px, 2.6vw, 34px)", fontWeight: 700, lineHeight: 1.0, fontVariantNumeric: tabular-nums }
  tool-title:     { fontFamily: Chakra Petch, fontWeight: 700, textTransform: uppercase }
  lede:           { fontFamily: Barlow, fontSize: "clamp(18px, 1.6vw, 21px)", fontWeight: 400, lineHeight: 1.5 }
  body:           { fontFamily: Barlow, fontSize: 17px, fontWeight: 400, lineHeight: 1.6 }
  meta:           { fontFamily: Barlow, fontSize: 14px, fontWeight: 700, letterSpacing: "0.02em" }
  button:         { fontFamily: Chakra Petch, fontSize: 16px, fontWeight: 700, letterSpacing: "0.03em" }

rounded:
  s: 10px      # buttons, inputs, small tiles
  m: 16px      # cards
  l: 22px      # large feature panels, hero media
  pill: 999px  # chips, tags, progress

spacing:
  gutter: "clamp(16px, 4vw, 56px)"
  max-width: 1320px
  section-padding: "clamp(44px, 6vw, 84px)"
  tap-min: 48px

motion:
  ease: "cubic-bezier(.16, 1, .3, 1)"
  fast: 0.25s       # hover, press
  reveal: 0.35s     # scroll-in
  progress: 0.6s    # story pitch bar (transform: scaleX)

shadows:
  glow-lime: "0 0 0 1px rgba(200,255,60,.55), 0 8px 34px -6px rgba(200,255,60,.45)"
  glow-lime-lg: "0 0 0 1px rgba(200,255,60,.55), 0 18px 50px -16px rgba(200,255,60,.45)"
  glow-cyan: "0 0 0 1px rgba(63,227,255,.5), 0 8px 30px -8px rgba(63,227,255,.45)"
  glow-red: "0 0 0 1px rgba(255,79,109,.55), 0 8px 34px -6px rgba(255,79,109,.45)"
  ring-cyan: "0 0 0 3px rgba(63,227,255,.3)"
  lift: "0 10px 30px -8px rgba(0,0,0,.9)"
---

# The Cricket Space: Floodlights

## Overview

The Cricket Space is a personal cricket stats site (IPL, WPL, internationals) with tools, player
pages, stories, a daily quiz and an IPL auction game. Its brand story is one fan's innings with the
game: Ind v Aus 2003 final, Dravid, the Dhoni storm of 2005, Sachin, then Kohli, Rohit, Gill and Bumrah.

The look is **a night match**. The page is the dark ground; colour only appears where the floodlights hit:
the thing you can press (lime), the number you came for (cyan), the wicket (red). It should feel like a
stadium scoreboard and a game menu, while still being calm and easy to read for a long session of stats.

Where the code lives:

| File | Owns |
| --- | --- |
| `ds.css` | Shared tokens and site chrome. The `FLOODLIGHTS` block near the end overrides every older token. |
| `ed.css` | Editorial component layer. Its `--ed-*` tokens are re-declared in the Floodlights block because `ed.css` loads later. |
| `home.css` | Homepage only, scoped to `main.fl`. Holds the canonical token names used in this file. |
| `player/player.css` | Generated player pages (`scripts/build-player-pages.py`). |
| `browser-auction/game/room.css` | Auction game; rebuild with `npm run build:auction`. |
| `fonts/` | Self-hosted woff2. Never load fonts from a CDN. |

## Colors

### Ground and surfaces
Four steps from `night` to `panel-3`. Each step up means "closer to you": page → band → card → hover → selected.
Separate surfaces with `line` hairlines, not shadows.

### The three lights (each has one job)
- **Lime `#c8ff3c` = action.** Primary button, current nav item, the one key word or mark per section, the logo dot.
  Text on lime is always `on-lime #071006`. One lime button per view.
- **Cyan `#3fe3ff` = data.** The headline number in a stat group, the focus ring, the first chart series.
- **Red `#ff4f6d` = outs.** Wickets, losses, wrong quiz answers, errors, destructive actions. Never decoration.

Do not swap these jobs. A lime number or a cyan button breaks the code the reader has learned.

### Text
`chalk` for headings and key text, `chalk-2` for long articles, `mist` for secondary, `subtle` / `dim` for meta.
All pass WCAG AA on `night` and `panel` (dim is about 6:1; keep it ≥ 14px).

### Gradient
Only `linear-gradient(135deg, #d8ff6a, #c8ff3c 55%, #a8e21f)` on lime fills. No purple, no blue-to-purple,
no rainbow mesh. Background atmosphere is allowed only as a faint radial lime or cyan glow (≤ .22 alpha) behind a hero or feature band.

## Typography

- **Chakra Petch 700**: every heading, every number, buttons, nav labels, the logo. Tool and player page titles are UPPERCASE.
- **Chakra Petch 400**: rare; secondary numbers only.
- **Barlow 400/700**: all reading text, captions, form text. Body is 17px.
- Numbers always use `font-variant-numeric: tabular-nums` so columns of runs and strike rates line up.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`; measure ≤ 52ch.
- Sentence case for labels. Small uppercase tracked "eyebrow" labels are allowed only when they carry
  information (for example "Question 2 of 5"), never as section decoration.
- Only Chakra Petch and Barlow are in use. The other families in `fonts/` are legacy; do not add new uses.

## Layout

- Content width `max 1320px` with gutter `clamp(16px, 4vw, 56px)` (16px on phones).
- Sections get space from a parent gap or adjacent-section rule, never from an optional heading or notice (see `AGENTS.md`).
- Sections are not three equal cards in a row. Prefer a scorecard list, a split (text + media), a big single stat,
  or a sticky rail (the homepage story). Vary the shape section to section.
- Button rows wrap. Grid and flex children get `min-width: 0`. Wide tables scroll inside their own container.
- Breakpoints: `920px` (layouts go single column), `520px` (phone tightening). Test at 1920, 1000 and 390.

## Elevation and depth

Depth comes from surface steps and hairlines. Glows are reserved:
- `glow-lime` / `glow-lime-lg`: primary button hover, the selected card.
- `glow-cyan`: a highlighted stat or chart focus.
- `glow-red`: a wicket moment or error.
- `lift`: dark drop shadow under a hovered card; never a coloured soft shadow.
Never transition `box-shadow`; fade a pseudo-element's opacity instead if a glow must animate.

## Shapes

Radius scale `s 10 / m 16 / l 22 / pill 999`. Use the tokens; no new literal radii.
Player portraits are illustrated, face-cropped (`battle-art/faces`) and positioned with `battle-art/focus.json`
so heads are never cut off. Do not use copyrighted photographs.

## Components

### Buttons
- **Primary (`.btn.go`)**: lime fill, `on-lime` text, radius `s`, min height 48px, Chakra Petch 16px/700.
- **Secondary (`.btn`)**: `panel` fill, `line-2` border, chalk text.
- **Text link (`.hero-link`)**: the second action in a hero is a text link, not a second button.
- Icons are inline SVG (`.btn-ic`, 18px, `currentColor`). **No emoji as icons**, except inside share text
  for WhatsApp and similar.

### Stat / scoreboard
Big Chakra Petch number with a small Barlow label beneath. A group shows at most one cyan number.
Rows in the homepage scorecard pair a tool name with one real stat (`<em class="stat"><strong>159</strong> off 108</em>`).

### Cards
`panel` fill, `line` border, radius `m`, padding 20–28px. Hover (pointer devices only): `translateY(-2px)` plus `lift`.

### Inputs
`panel` fill, `line-2` border, radius `s`, 48px tall, chalk text, `ring-cyan` focus.

### Navigation
Sticky bar, `rgba(6,8,10,.84)` (no blur), `line` bottom border. Logo in Chakra Petch uppercase with a lime mark.
Current page is lime with a lime glowing underline on desktop. Phone menu opens with ☰ and closes with Escape.

### Tables
Header row in `mist` Chakra Petch; body in Barlow with tabular numbers; rows split by `line` hairlines;
wicket or loss cells in red. An empty cell shows an en dash (–).

## Motion

- Ease `cubic-bezier(.16,1,.3,1)`. Hover and press 0.25s; reveal 0.35s; never more than 0.6s.
- Animate `transform` and `opacity` only. Never `transition: all`, never `width`, `height` or `box-shadow`.
- Scroll reveals use `.js .fl [data-in]` and fall back to fully visible without JS or IntersectionObserver.
- All hover rules sit inside `@media (hover: hover) and (pointer: fine)` so taps never leave a stuck state.
- `prefers-reduced-motion: reduce` turns off reveals, the pitch bar and any looping motion.
- Daily-use tools (record book, venues, battle search) stay mostly still. Motion is for the homepage story and the games.

## Copy

- Plain, warm, first person on the homepage ("I always wanted to know why"). Hinglish only where it is the joke.
- Show, don't tell: a real number beats "powerful insights". Never invent a stat; take it from the data JSON.
- **No em dashes (—)** in shipped copy. Use a period, comma or colon. Empty data cells use an en dash (–).
- No hype words: "unleash", "elevate", "seamless", "revolutionary", "next-level".

## Do's and Don'ts

### Do
- Use the tokens above; extend the Floodlights block rather than adding a new theme.
- Give every section one real stat or one real piece of the story.
- Check desktop and 390px mobile, with optional blocks present and absent.
- Bump `?v=` on `ds.css` / `home.css` when you change them.

### Don't
- Bring back the theme toggle or a light theme.
- Use `data-year` for anything: `design-v2.js` fills every `[data-year]` with the current year.
- Use purple gradients, glassmorphism stacks, or three equal feature cards.
- Use emoji as UI icons, em dashes in copy, or copyrighted player photos.
- Merge without re-checking the header: the editorial layer in `ds.css` has been lost in a merge before.
