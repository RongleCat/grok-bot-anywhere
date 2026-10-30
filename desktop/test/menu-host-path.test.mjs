import {test} from 'node:test';
import assert from 'node:assert/strict';
import {menuHostTemplate,sharingApplicationPath} from '../src/share/host-path.mjs';

test('development and packaged builds both resolve a menu host template',()=>{
  assert.equal(menuHostTemplate({packaged:false,resourcesPath:'/unused',devRoot:'/repo/desktop'}),'/repo/desktop/native/GrokBotMenuHost.app');
  assert.equal(menuHostTemplate({packaged:true,resourcesPath:'/App.app/Contents/Resources',devRoot:'/unused'}),'/App.app/Contents/Resources/native/GrokBotMenuHost.app');
});

test('share intake launches the real application bundle in both modes',()=>{
  assert.equal(sharingApplicationPath({packaged:false,appPath:'/repo/desktop',execPath:'/repo/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'}),'/repo/desktop/node_modules/electron/dist/Electron.app');
  assert.equal(sharingApplicationPath({packaged:true,appPath:'/Applications/Grok Bot Anywhere.app/Contents/Resources/app.asar',execPath:'/unused'}),'/Applications/Grok Bot Anywhere.app');
});
