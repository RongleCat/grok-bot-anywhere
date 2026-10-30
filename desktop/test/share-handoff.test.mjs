import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shareHandoff} from '../src/share/handoff.mjs';

test('a WeChat share opens the window composer unless the Bot sends directly',()=>{
  assert.equal(shareHandoff({mode:'compose'}),'composer');
  assert.equal(shareHandoff({mode:'direct'}),'service');
});
