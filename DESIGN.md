---
version: alpha
name: The-Cricket-Space
description: |
  The site is literally a space made of cricket. The homepage is a 3D universe (three.js): a red
  cricket-ball planet, four ball moons that are the doors (Stats, Players, Play, My story), and a
  galaxy with one star per real player. Every other page is deep space with faint stars, panels like
  scoreboard plates floating in it, white paint for the main action, one yellow light, red only for wickets.
  Headings and numbers use Barlow Condensed in capitals; reading text uses Barlow. Everything is flat:
  no glows, no gradients, no soft shadows. Numbers are the hero, hung on the board as plates or written
  into a scorecard, and every number is real data from the site.

colors:
  space: "#05080d"       # page background (with a faint fixed starfield)
  panel: "#0b1118"       # panels, cards, footer
  panel-2: "#111a24"     # raised panel / hover fill
  seam: "#1c2733"        # borders and dividers
  line-2: "#33414f"      # outlines on secondary buttons and inputs
  plate: "#0d130f"       # number plates, input fields, icon tiles
  paint: "#f1ede2"       # primary text and the main button
  paint-2: "#b9c0c6"     # secondary text
  subtle: "#95a0aa"      # captions, meta
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

# The Cricket Space

## Overview

The Cricket Space is a personal cricket stats site (IPL, WPL, internationals) with tools, player pages,
stories, a daily quiz and an IPL auction game. The brand story is one fan's innings with the game:
the 2003 World Cup final, Dravid, the Dhoni storm of 2005, Sachin, then Kohli, Rohit, Gill and Bumrah.

The site is **a space made of cricket**. Opening it, you fly into a universe: the red cricket ball is the
planet, the white, pink, tennis and old red balls are moons and doors, and every star in the galaxy is a real
player (933 of them, from `player/galaxy.json`). Hover a star for the player's numbers, click to open their
page, or search and the camera flies to them. Every other page is the same deep space: panels like scoreboard
plates, a flat white main button, one yellow light for "current" and red only for wickets.

### The homepage universe
- `space.js` (ES module) draws it with `vendor/three-0.170.0.module.min.js` (MIT). `scripts/build-player-pages.py` writes `player/galaxy.json`.
- Star colours: white batters, red bowlers, yellow all-rounders, pink WPL. Bigger career, bigger star.
- The four doors are real links. Without WebGL or JavaScript they show as a row of plain buttons.
- Motion: fly-in once, slow orbit and spin. Reduced motion: no fly-in, nothing moves on its own. Rendering pauses off-screen.
- Below the universe: the story ("Six balls that made me", `#about`: one over of six swipeable cards with an over tracker) and the contact form (`#contact`), which every page links to.

### The rules (from the site owner)
- No Inter. No purple gradients. No glowing buttons.
- No serif headline with one word in italic.
- No four stat cards in a row. Stats either hang as plates on one board, sit in a scorecard table, or
  join into one strip with seams (`.tiles`, `.fx-summary`, `.pp-big`).
- If a page looks like every other AI site, start over.

### Where the code lives

| File | Owns |
| --- | --- |
| `ds.css` | Shared tokens and site chrome. The `THE CRICKET SPACE` block at the end overrides every older token. |
| `ed.css` | Editorial components. Its `--ed-*` tokens are re-declared in the theme block because `ed.css` loads later. |
| `home.css` | Homepage only, scoped to `main.sb`. |
| `space.js` | The 3D universe on the homepage. |
| `browser-auction/game/room.css` | Auction game theme. Rebuild with `npm run build:auction`. |
| `scripts/build-player-pages.py` | Player pages; references `ds.css?v=…`. Rebuild after changing it. |
| `fonts/` | Self-hosted woff2. Never load fonts from a CDN. |

## Colors

- **Space** (`space`, `panel`, `panel-2`) are the only surfaces. Separate them with `seam`, never shadows. No purple.
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
- Homepage: the universe fills the first screen (name, four doors, find a player), then **Six balls that made me** and contact. Nothing else.
- Lists and tables are preferred over grids of cards. Button rows wrap. Wide tables scroll in their own container.
- Breakpoints: 900px (single column), 520px (phone tightening). Test at 1440 and 390.

## Components

- **Main button (`.btn.go`, `.ds-btn`)**: flat paint fill, plate text, 3px radius, 52px tall, condensed caps.
- **Secondary button (`.btn`, `.ghost`)**: transparent with a 2px paint or `line-2` outline.
- **Second action in a hero**: an underlined text link, not a second button.
- **Number plates**: black tiles, one digit each on the homepage board; the wicket count is red.
- **Scorecard table (`.card`)**: name in condensed caps, description in Barlow, number right-aligned.
- **Six balls (`.over`)**: the story as one over: six cards that snap sideways, each with a picture (the 2003 final scoreboard, the Wall, Dhoni, a hundred hundreds, my generation, the planet) and an over tracker of six balls that fills in red.
- **Panels**: `board-2` fill, 3px seam border, 4px radius.
- **Icons**: inline SVG line icons in `currentColor`. No emoji as icons, except in share text.

## Motion

- Only the homepage universe moves on its own (fly-in, slow orbit, spin). Other pages stay still.
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
