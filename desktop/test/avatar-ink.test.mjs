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
