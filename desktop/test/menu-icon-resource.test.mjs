import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as info from '../src/share/plist.mjs';
const loaded=await import('../src/share/icon-resource.mjs').catch(()=>null);
test('menu icon resources change identity with image content',()=>assert.ok(loaded?.iconResourceName));
test('different menu destinations provide different containing-app icons',()=>{
 assert.equal(typeof info.destinationInfo,'function');
 const a=info.destinationInfo(1,'One','/Applications/App.app','blue.icns',10),b=info.destinationInfo(2,'Two','/Applications/App.app','green.icns',10);
 assert.notEqual(a.CFBundleIdentifier,b.CFBundleIdentifier);assert.equal(a.CFBundleIconFile,'blue.icns');assert.equal(b.CFBundleIconFile,'green.icns');
});
if(loaded)test('new pixels cannot reuse a stale AppIcon resource name',()=>{const a=loaded.iconResourceName(Buffer.from('avatar-a')),b=loaded.iconResourceName(Buffer.from('avatar-b'));assert.notEqual(a,b);assert.equal(a,loaded.iconResourceName(Buffer.from('avatar-a')));assert.ok(a.endsWith('.icns'));});

test('destination apps are installed under an ordinary folder',async()=>{const {menuHostName}=await import('../src/share/model.mjs');assert.equal(menuHostName,'Grok Bot Anywhere Menu');assert.ok(!menuHostName.endsWith('.app'));});
