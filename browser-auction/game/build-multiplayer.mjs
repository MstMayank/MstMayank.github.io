import {build} from 'esbuild';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({entryPoints:['browser-auction/game/multiplayer.tsx'],bundle:true,minify:true,format:'esm',target:['safari14','chrome90','firefox90'],supported:{destructuring:true},outdir:'ipl-auction',entryNames:'multiplayer',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const version=createHash('sha256').update(await readFile('ipl-auction/multiplayer.js')).update(await readFile('ipl-auction/multiplayer.css')).digest('hex').slice(0,12);
await writeFile('ipl-auction/multiplayer.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07110f"><title>Multiplayer Auction · The Cricket Space</title><link rel="stylesheet" href="./multiplayer.css?v=${version}"></head><body><div id="auction-root"></div><script type="module" src="./multiplayer.js?v=${version}"></script></body></html>`);
