import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COLORS,SHAPES,STATES,pinnedColor,renderAvatarSvg,resolveAvatar} from 'grok-bot-avatar-engine';

test('the new main engine carries all 26 picker shapes including pumpkin',()=>{
 assert.equal(SHAPES.length,26);
 assert.equal(SHAPES.at(-1),'pumpkin');
 assert.equal(COLORS.length,11);
 assert.ok(STATES.includes('working'));
 assert.ok(STATES.includes('idle'));
});

test('pumpkin is the only pinned colour and renders orange with its stem',()=>{
 assert.equal(pinnedColor('pumpkin'),'orange');
 assert.equal(pinnedColor('cloud'),null);
 const svg=renderAvatarSvg({shape:'pumpkin',size:96,id:'pumpkin-test',state:'idle'});
 assert.match(svg,/fill="#FF6700"/);
 assert.match(svg,/id="pumpkin-test-body"/);
 assert.match(svg,/mask/);
 assert.match(svg,/fill="#3d3d3d"|fill="#525252"/);
});

test('an explicit pumpkin survives the gated resolver',()=>{
 assert.equal(resolveAvatar({agentId:'fixture',avatarShape:'pumpkin'}).shape,'pumpkin');
});

test('the adapter keeps theme colours and the pumpkin pin',async()=>{
 const adapter=await import('../src/renderer/avatar-adapter.mjs');
 assert.equal(adapter.colorHex('black','dark'),'#FFFFFF');
 assert.match(adapter.renderAvatarSvg({shape:'cloud',color:'black',size:64,theme:'dark'}),/fill="#FFFFFF"/);
 assert.match(adapter.renderAvatarSvg({shape:'cloud',color:'black',size:64,theme:'light'}),/fill="#000000"/);
 assert.match(adapter.renderAvatarSvg({shape:'pumpkin',color:'blue',size:64}),/fill="#FF6700"/);
 assert.match(adapter.renderAvatarSvg({shape:'cloud',avatarColor:'brown',size:64}),/fill="#A27952"/);
});

test('the adapter maps updates onto the client body and paint record',async()=>{
 const adapter=await import('../src/renderer/avatar-adapter.mjs');
 const pumpkin=adapter.engineProps({shape:'pumpkin',color:'blue',state:'wide'},64);
 assert.equal(pumpkin.shape,'pumpkin');
 assert.equal(pumpkin.body,'pumpkin');
 assert.equal(pumpkin.state,'listening');
 assert.equal(pumpkin.appearance.inkPaint,'#FF6700');
 const cloud=adapter.engineProps({shape:'cloud',color:'brown'},64);
 assert.equal(cloud.body,'cloud');
 assert.equal(cloud.appearance.inkPaint,'#A27952');
});
