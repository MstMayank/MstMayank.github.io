---
version: alpha
name: The-Cricket-Space-Scoreboard
description: |
  "Scoreboard" is the single theme of The Cricket Space: an old hand-operated cricket scoreboard.
  Painted green boards, black number plates, white paint, one yellow bulb, and red only for wickets.
  Headings and numbers use Barlow Condensed in capitals; reading text uses Barlow. Everything is flat:
  no glows, no gradients, no soft shadows. Numbers are the hero, hung on the board as plates or written
  into a scorecard, and every number is real data from the site.

colors:
  board: "#1d3b2a"       # page background, painted board
  board-2: "#183323"     # lower panels, cards, footer
  board-3: "#21442f"     # raised panel / hover fill
  seam: "#10261a"        # gaps between boards: borders and dividers
  line-2: "#2f5a41"      # outlines on secondary buttons and inputs
  plate: "#0d130f"       # number plates, input fields, icon tiles
  paint: "#f1ede2"       # primary text and the main button
  paint-2: "#c2ccc2"     # secondary text
  subtle: "#a3b2a4"      # captions, meta
  bulb: "#f5c518"        # the one light: current item, key mark, focus ring, link hover
  wicket: "#ff7c68"      # outs, losses, errors only
  sky: "#9ad7f5"         # second chart series only

typography:
  hero:     { fontFamily: Barlow Condensed, fontSize: "clamp(60px, 8.4vw, 124px)", fontWeight: 800, lineHeight: 0.9, textTransform: uppercase }
  h2:       { fontFamily: Barlow Condensed, fontSize: "clamp(40px, 5vw, 68px)", fontWeight: 800, lineHeight: 0.95, textTransform: uppercase }
  h3:       { fontFamily: Barlow Condensed, fontSize: "22px-38px", fontWeight: 800, lineHeight: 1.05, textTransform: uppercase }
  plate:    { fontFamily: Barlow Condensed, fontSize: "clamp(36px, 4vw, 52px)", fontWeight: 800, fontVariantNumeric: tabular-nums }
  stat:     { fontFamily: Barlow Condensed, fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800 }
  label:    { fontFamily: Barlow Condensed, fontSize: 15px-16px, fontWeight: 600, letterSpacing: "0.12em", textTransform: uppercase }
  nav:      { fontFamily: Barlow Condensed, fontSize: 18px, fontWeight: 600, letterSpacing: "0.06em", textTransform: uppercase }
  button:   { fontFamily: Barlow Condensed, fontSize: 19px, fontWeight: 800, letterSpacing: "0.06em", textTransform: uppercase }
  lede:     { fontFamily: Barlow, fontSize: "clamp(19px, 1.7vw, 22px)", fontWeight: 400, lineHeight: 1.55 }
  body:     { fontFamily: Barlow, fontSize: 17px, fontWeight: 400, lineHeight: 1.6 }

rounded:
  button: 3px
  plate: 2px
  panel: 4px
  pill: 999px   # only the existing filter pills (IPL / WPL)

borders:
  section-seam: "6px solid #10261a"   # between page sections, header, footer, big boards
  row-seam: "3px solid #10261a"       # table rows, list rows, panel borders

spacing:
  gutter: "clamp(16px, 4vw, 48px)"
  max-width: 1240px
  section-padding: "clamp(48px, 7vw, 96px)"
  tap-min: 48px

motion:
  plates: "number plates slide down into place once, 0.45s, cubic-bezier(.2,.8,.2,1)"
  hover: "colour change only, 0.15s"
---

# The Cricket Space: Scoreboard

## Overview

The Cricket Space is a personal cricket stats site (IPL, WPL, internationals) with tools, player pages,
stories, a daily quiz and an IPL auction game. The brand story is one fan's innings with the game:
the 2003 World Cup final, Dravid, the Dhoni storm of 2005, Sachin, then Kohli, Rohit, Gill and Bumrah.

The look is **the old hand-operated scoreboard** at a cricket ground. It comes from cricket itself, not
from a web trend. Pages are painted boards separated by dark seams; numbers hang on black plates; the main
action is a flat white board; one yellow bulb marks what is current.

### The rules (from the site owner)
- No Inter. No purple gradients. No glowing buttons.
- No serif headline with one word in italic.
- No four stat cards in a row. Stats either hang as plates on one board, sit in a scorecard table, or
  join into one strip with seams (`.tiles`, `.fx-summary`, `.pp-big`).
- If a page looks like every other AI site, start over.

### Where the code lives

| File | Owns |
| --- | --- |
| `ds.css` | Shared tokens and site chrome. The `SCOREBOARD` block at the end overrides every older token. |
| `ed.css` | Editorial components. Its `--ed-*` tokens are re-declared in the Scoreboard block because `ed.css` loads later. |
| `home.css` | Homepage only, scoped to `main.sb`. |
| `browser-auction/game/room.css` | Auction game theme. Rebuild with `npm run build:auction`. |
| `scripts/build-player-pages.py` | Player pages; references `ds.css?v=…`. Rebuild after changing it. |
| `fonts/` | Self-hosted woff2. Never load fonts from a CDN. |

## Colors

- **Board greens** (`board`, `board-2`, `board-3`) are the only surfaces. Separate them with `seam`, never shadows.
- **Paint** (`#f1ede2`) is the text and the main button. **Plate** (`#0d130f`) holds numbers and inputs.
- **Bulb yellow** (`#f5c518`) is the one light: current nav item, the logo dot, focus ring, a highlighted
  number, link hover. Use it sparingly; one or two touches per screen.
- **Wicket red** (`#ff7c68`) is for outs, losses, wrong answers and errors only.
- **Sky** (`#9ad7f5`) only as a second series in charts.
- No gradients anywhere. No coloured shadows. No glow.

## Typography

- **Barlow Condensed 800, capitals**: every heading, number, button, nav item and the logo.
- **Barlow Condensed 600, spaced capitals**: table headers and small labels on a board.
- **Barlow 400/700**: reading text, captions and form text. Body is 17px.
- Numbers use `tabular-nums` so runs and strike rates line up.
- No serif and no italic display type.

## Layout

- Content width 1240px max, gutter `clamp(16px, 4vw, 48px)` (16px on phones).
- Sections are boards stacked with a 6px seam between them.
- Homepage order: hero with the Kohli v Bumrah board → **Batting card** (tools table) → **Team sheet**
  (numbered player list) → **Fall of wickets** (the story) → **In the nets** (games) → contact.
- Lists and tables are preferred over grids of cards. Button rows wrap. Wide tables scroll in their own container.
- Breakpoints: 900px (single column), 520px (phone tightening). Test at 1440 and 390.

## Components

- **Main button (`.btn.go`, `.ds-btn`)**: flat paint fill, plate text, 3px radius, 52px tall, condensed caps.
- **Secondary button (`.btn`, `.ghost`)**: transparent with a 2px paint or `line-2` outline.
- **Second action in a hero**: an underlined text link, not a second button.
- **Number plates**: black tiles, one digit each on the homepage board; the wicket count is red.
- **Scorecard table (`.card`)**: name in condensed caps, description in Barlow, number right-aligned.
- **Fall of wickets (`.fow`)**: "1– 2003" style entries with a short heading and one line.
- **Panels**: `board-2` fill, 3px seam border, 4px radius.
- **Icons**: inline SVG line icons in `currentColor`. No emoji as icons, except in share text.

## Motion

- Plates slide into place once when the board comes into view. Nothing else moves on its own.
- Hover changes colour only, and only on real pointers (`@media (hover: hover) and (pointer: fine)`).
- No marquees, no glows, no pulsing dots, no bouncy lifts.
- `prefers-reduced-motion: reduce` shows everything in place.

## Copy

- Plain, warm, first person in the story. Hinglish only where it is the joke.
- Show, don't tell: one real number beats an adjective. Never invent a stat.
- No em dashes (—) in shipped copy. Empty data cells use an en dash (–).
- No hype words: "unleash", "elevate", "seamless", "revolutionary", "next-level".

## Don'ts

- Bring back the theme toggle or a light theme.
- Use `data-year` for anything: `design-v2.js` fills every `[data-year]` with the current year.
- Use copyrighted player photos; portraits are the illustrated set in `battle-art/`.
- Merge without re-checking the header on a few pages.
