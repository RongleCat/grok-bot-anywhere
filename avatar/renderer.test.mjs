import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../bridge/node_modules/esbuild/lib/main.js';
test('offline renderer preserves all catalogue states, masks and both orbit layers',async()=>{
 let renderer;try{const result=await build({entryPoints:['avatar/frame.ts'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});renderer=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}catch{}
 assert.equal(typeof renderer?.renderFrame,'function');
 for(const state of ['idle','thinking','wink','wide','alert','notify','exclaim','sleep','egg','hexagon','play','orbit','burst','comet']){
   const svg=renderer.renderFrame({state,shape:'cloud',color:'#936439',time:1.2});
   assert.ok(svg.includes('viewBox="-158 -158 316 316"'));
   assert.ok(svg.includes('<mask'));assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('undefined'));
   if(state==='orbit'){assert.ok(svg.includes('data-layer="back"'));assert.ok(svg.includes('data-layer="front"'));}
 }
});
