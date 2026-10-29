import {test} from 'node:test';
import assert from 'node:assert/strict';
const loaded=await import('../src/main/rpc.mjs').catch(()=>null);
test('private process RPC is available',()=>assert.ok(loaded?.RpcClient));
if(loaded){
 test('correlates concurrent replies and keeps events separate',async()=>{
  const requests=[],events=[];const rpc=new loaded.RpcClient({send:r=>requests.push(r),onEvent:e=>events.push(e)});
  const a=rpc.call('a'),b=rpc.call('b');rpc.receive({event:'state',data:{}});
  rpc.receive({id:requests[1].id,result:2});rpc.receive({id:requests[0].id,result:1});
  assert.deepEqual(await Promise.all([a,b]),[1,2]);assert.equal(events.length,1);rpc.close();
 });
 test('process exit rejects pending requests; future requests fail immediately',async()=>{
  const rpc=new loaded.RpcClient({send:()=>{}});const result=rpc.call('send');rpc.close();
  await assert.rejects(result,/SERVICE_EXITED/);await assert.rejects(rpc.call('snapshot'),/SERVICE_EXITED/);
 });
}
