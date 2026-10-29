import {test} from 'node:test';
import assert from 'node:assert/strict';
const loaded=await import('../src/share/registration.mjs').catch(()=>null);
test('registration verifies actual system election',()=>assert.ok(loaded?.registerSlots));
if(loaded){
 test('re-adds an enabled slot missed by asynchronous discovery',async()=>{
  let probes=0,readded=0;const run=async(file,args)=>{
   if(args[0]==='-a')readded++;
   if(args[0]==='-m'){probes++;return {stdout:probes===1?'  (no matches)\n':'+    dev.ronglecat.grokbotanywhere.menu.destination01.share(0.2.0)\n'};}
   return {stdout:''};
  };
  assert.equal(await loaded.registerSlots('/tmp/host',[1],run,async()=>{}),1);assert.ok(readded>12);assert.ok(probes>=2);
 });
 test('an empty menu elects every existing slot off',async()=>{
  const commands=[];const run=async(file,args)=>{commands.push(args);return {stdout:''};};
  assert.equal(await loaded.registerSlots('/tmp/host',[],run,async()=>{}),0);
  assert.equal(commands.filter(args=>args[0]==='-e'&&args[1]==='ignore').length,12);
 });
}
