import {build} from 'esbuild';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({
  entryPoints:['browser-auction/game/main.tsx'],
  bundle:true,
  minify:true,
  format:'esm',
  target:['safari14','chrome90','firefox90'],
  supported:{destructuring:true},
  outdir:'ipl-auction',
  entryNames:'auction-game',
  jsx:'automatic',
  define:{'process.env.NODE_ENV':'"production"'}
});

const version=createHash('sha256').update(await readFile('ipl-auction/auction-game.js')).update(await readFile('ipl-auction/auction-game.css')).digest('hex').slice(0,12);
await writeFile('ipl-auction/play.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07110f"><title>IPL Auction Room · The Cricket Space</title><meta property="og:type" content="website"><meta property="og:site_name" content="The Cricket Space"><meta property="og:title" content="IPL Auction Room · The Cricket Space"><meta property="og:description" content="Play an IPL auction against nine computer franchises. Bid, build your squad and save your game."><meta property="og:url" content="https://mstmayank.github.io/ipl-auction/play.html"><meta property="og:image" content="https://mstmayank.github.io/og-auction.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="IPL Auction Room · The Cricket Space"><meta name="twitter:card" content="summary_large_image"><meta name="description" content="Play an IPL auction against nine computer franchises. Bid, build your squad and save your game."><link rel="stylesheet" href="./auction-game.css?v=${version}"></head><body><div id="auction-root"></div><script type="module" src="./auction-game.js?v=${version}"></script></body></html>`);
