import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {acceptWindowControl,captionGlyph,editCommand,mainWindowOptions,maximizedContentInset,windowCaptionButtons,windowCaptionLabel} from '../src/shell/window-chrome.mjs';

test('main window options drop the frame only on Windows',()=>{
  const win=mainWindowOptions('win32');
  const mac=mainWindowOptions('darwin');
  assert.equal(win.frame,false);
  assert.equal(win.thickFrame,undefined);
  assert.equal(win.transparent,false);
  assert.equal(win.titleBarStyle,'default');
  assert.equal(win.hasShadow,true);
  assert.equal(mac.frame,undefined);
  assert.equal(mac.thickFrame,undefined);
  assert.equal(mac.titleBarStyle,'hiddenInset');
  assert.equal(mac.transparent,true);
  assert.equal(mac.vibrancy,'fullscreen-ui');
  assert.deepEqual(mac.trafficLightPosition,{x:14,y:18});
  assert.equal(mainWindowOptions('linux').frame,undefined);
});

test('window control accepts only minimize, toggleMaximize, and close',()=>{
  assert.equal(acceptWindowControl('minimize'),'minimize');
  assert.equal(acceptWindowControl('toggleMaximize'),'toggleMaximize');
  assert.equal(acceptWindowControl('close'),'close');
  for(const action of ['quit','hide','maximize','restore','',null,undefined,'CLOSE',0])assert.equal(acceptWindowControl(action),null);
});

test('maximized inset is the Windows overflow past the work area',()=>{
  const work={x:0,y:0,width:1200,height:800};
  const overflow={x:-7,y:-7,width:1214,height:814};
  assert.equal(maximizedContentInset('win32',true,overflow,work),7);
  assert.equal(maximizedContentInset('win32',false,overflow,work),0);
  assert.equal(maximizedContentInset('darwin',true,overflow,work),0);
  assert.equal(maximizedContentInset('win32',true,{x:0,y:0,width:1200,height:800},work),0);
  assert.equal(maximizedContentInset('win32',true,null,work),0);
});

test('edit commands cover the accelerators the Windows menu used to own',()=>{
  const down=(key,extra={})=>editCommand({type:'keyDown',key,control:true,...extra});
  assert.equal(down('c'),'copy');
  assert.equal(down('C'),'copy');
  assert.equal(down('v'),'paste');
  assert.equal(down('x'),'cut');
  assert.equal(down('a'),'selectAll');
  assert.equal(down('z'),'undo');
  assert.equal(down('z',{shift:true}),'redo');
  assert.equal(down('y'),'redo');
  assert.equal(down('c',{shift:true}),null);
  assert.equal(down('r'),null);
  assert.equal(editCommand({type:'keyDown',key:'c',control:false}),null);
  assert.equal(editCommand({type:'keyDown',key:'c',control:true,alt:true}),null);
  assert.equal(editCommand({type:'keyDown',key:'c',control:true,meta:true}),null);
  assert.equal(editCommand({type:'keyUp',key:'c',control:true}),null);
  assert.equal(editCommand({type:'keyDown',key:'v',control:true,isComposing:true}),null);
});

test('caption buttons and labels exist only for the Windows main window',()=>{
  assert.deepEqual(windowCaptionButtons('win32').map(item=>item.action),['minimize','toggleMaximize','close']);
  assert.deepEqual(windowCaptionButtons('darwin'),[]);
  assert.deepEqual(windowCaptionButtons('linux'),[]);
  assert.equal(windowCaptionLabel('minimize',{zh:true}),'最小化');
  assert.equal(windowCaptionLabel('minimize',{zh:false}),'Minimize');
  assert.equal(windowCaptionLabel('toggleMaximize',{zh:true}),'最大化');
  assert.equal(windowCaptionLabel('toggleMaximize',{zh:false}),'Maximize');
  assert.equal(windowCaptionLabel('toggleMaximize',{zh:true,maximized:true}),'还原');
  assert.equal(windowCaptionLabel('toggleMaximize',{zh:false,maximized:true}),'Restore');
  assert.equal(windowCaptionLabel('close',{zh:true}),'关闭');
  assert.equal(windowCaptionLabel('close',{zh:false}),'Close');
  assert.equal(windowCaptionLabel('quit',{zh:true}),'');
  assert.deepEqual(captionGlyph('minimize'),['M1 5h8']);
  assert.deepEqual(captionGlyph('maximize'),['M1.5 1.5h7v7h-7z']);
  assert.equal(captionGlyph('restore').length,2);
  assert.equal(captionGlyph('close').length,2);
  assert.deepEqual(captionGlyph('nope'),[]);
});

test('shipped window chrome stays on the main Windows window',async()=>{
  const root=fileURLToPath(new URL('../src/',import.meta.url));
  const main=await readFile(`${root}main/main.mjs`,'utf8');
  const app=await readFile(`${root}renderer/app.mjs`,'utf8');
  const html=await readFile(`${root}renderer/index.html`,'utf8');
  const preload=await readFile(`${root}preload.cjs`,'utf8');
  const css=await readFile(`${root}renderer/styles.css`,'utf8');
  const composer=await readFile(`${root}renderer/composer.mjs`,'utf8');
  const chrome=await readFile(`${root}shell/window-chrome.mjs`,'utf8');
  assert.doesNotMatch(chrome,/thickFrame/);
  assert.match(main,/mainWindowOptions\(process\.platform\)/);
  assert.match(main,/process\.platform==='win32'\?\{icon:nativeImage\.createFromBuffer\(coalBallPng\(256\)\)\}/);
  assert.match(main,/setBackgroundMaterial\('acrylic'\)/);
  assert.match(main,/bindWindowsEditKeys\(window\.webContents\)/);
  assert.match(main,/bindWindowsEditKeys\(target\.webContents\)/);
  assert.match(main,/acceptWindowControl\(/);
  assert.match(main,/anywhere:window-control/);
  assert.match(main,/anywhere:window-state/);
  assert.match(main,/else window\.close\(\)/);
  assert.match(main,/windowCloseAction\(/);
  const nullAt=main.indexOf('Menu.setApplicationMenu(null)');
  assert.notEqual(nullAt,-1);
  assert.match(main.slice(nullAt-40,nullAt),/win32/);
  assert.match(preload,/windowControl:/);
  assert.match(preload,/onWindowState:/);
  assert.doesNotMatch(preload,/BrowserWindow/);
  assert.doesNotMatch(html,/win-controls/);
  assert.doesNotMatch(html,/win-control/);
  assert.doesNotMatch(composer,/win-controls/);
  const paint=app.slice(app.indexOf('function paintWindowControls'),app.indexOf('function render'));
  assert.match(paint,/state\?\.host\?\.platform==='win32'/);
  assert.match(paint,/if\(!win\)\{bar\?\.remove\(\)/);
  assert.match(paint,/windowCaptionButtons\('win32'\)/);
  assert.match(paint,/api\.windowControl\(/);
  assert.match(app,/classList\.toggle\('os-windows',state\.host\?\.platform==='win32'\)/);
  assert.match(css,/\.os-windows \.shell\{grid-template-rows:32px/);
  assert.match(css,/\.os-windows \.win-control\{width:46px;height:32px/);
  assert.match(css,/-webkit-app-region:drag/);
  assert.match(css,/\.os-windows \.win-controls\{[^}]*-webkit-app-region:no-drag/);
  assert.match(css,/rgba\(0,0,0,\.06\)/);
  assert.match(css,/rgba\(255,255,255,\.08\)/);
  assert.match(css,/#c42b1c/);
  assert.match(css,/opacity:\.5/);
  assert.match(css,/\.os-windows\.maximized body\{padding:var\(--win-inset,0px\)\}/);
  const preview=await readFile(fileURLToPath(new URL('../../orchestration/results/12_titlebar_preview.html',import.meta.url)),'utf8');
  for(const name of ['minimize','maximize','restore','close'])for(const d of captionGlyph(name))assert.ok(preview.includes(d),d);
  assert.match(preview,/#c42b1c/);
  assert.match(preview,/rgba\(0,0,0,\.06\)/);
  assert.match(preview,/rgba\(255,255,255,\.08\)/);
});
