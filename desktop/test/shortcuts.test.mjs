import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceleratorFromEvent,formatAccelerator,normalizeAccelerator} from '../src/shortcuts.mjs';

test('shortcut recording accepts a modifier combination and rejects bare keys',()=>{
  assert.equal(normalizeAccelerator('Ctrl+Alt+Space'),'Ctrl+Alt+Space');
  assert.equal(normalizeAccelerator(''),null);
  assert.throws(()=>normalizeAccelerator('K'),/SHORTCUT_INVALID/);
  assert.throws(()=>normalizeAccelerator('Shift+A'),/SHORTCUT_INVALID/);
  assert.equal(acceleratorFromEvent({key:' ',ctrlKey:true,altKey:true,metaKey:false,shiftKey:false,isComposing:false}),'Ctrl+Alt+Space');
  assert.equal(acceleratorFromEvent({key:'Control',ctrlKey:true,altKey:false,metaKey:false,shiftKey:false}),null);
  assert.equal(formatAccelerator('Ctrl+Alt+Space','darwin'),'⌃⌥Space');
  assert.equal(formatAccelerator('Ctrl+Alt+K','win32'),'Ctrl+Alt+K');
});
