import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {players} from '../browser-auction/game/engine';
import {playerPortrait} from '../browser-auction/game/portraits';
test('available auction AI portraits resolve to existing local assets',()=>{
 const matched=players.filter(p=>playerPortrait(p.name));
 assert.equal(matched.length,48);
 for(const player of matched) assert.ok(existsSync('.'+playerPortrait(player.name)),player.name);
 assert.equal(playerPortrait('Mahendra Singh Dhoni'),'/battle-art/dhoni.jpg');
 assert.equal(playerPortrait('Virat Kohli'),'/battle-art/kohli-rcb.jpg');
 assert.equal(playerPortrait('Krunal Pandya'),undefined);
 assert.equal(playerPortrait('Unknown player'),undefined);
});
