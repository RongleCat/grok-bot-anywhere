import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eyeInk} from '../src/renderer/avatar-ink.mjs';

test('avatar eyes choose the higher-contrast ink',()=>{
 assert.equal(eyeInk('#000'),'#fff');
 assert.equal(eyeInk('#000000'),'#fff');
 assert.equal(eyeInk('#fff'),'#111');
 assert.equal(eyeInk('#ffffff'),'#111');
 assert.equal(eyeInk('#808080'),'#111');
 assert.equal(eyeInk('not-a-color'),'#fff');
});

test('the static palette keeps light and dark ink pairs', async()=>{
 const {colorHex,AVATAR_PALETTE}=await import('../src/renderer/avatar-ink.mjs');
 assert.equal(colorHex('black','light'),'#000000');
 assert.equal(colorHex('black','dark'),'#FFFFFF');
 assert.equal(colorHex('brown','light'),'#A27952');
 assert.equal(colorHex('brown','dark'),'#855C36');
 assert.equal(colorHex('#123456','dark'),'#123456');
 assert.equal(colorHex('', 'light'),'');
 assert.equal(AVATAR_PALETTE.orange.dark,'#FF6700');
});
