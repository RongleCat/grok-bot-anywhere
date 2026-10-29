import test from 'node:test';
import assert from 'node:assert/strict';
let extract={};
try{extract=await import('../extract.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}

test('extracts a service method and resolves its request/response schema without executing code',()=>{
  assert.equal(typeof extract.parseProtocol,'function');
  const source='var Req=class e extends Base{static $(){return["ReadRequest|1 id 9|2 limit 5?"]}},Res=class e extends Base{static $(){return["ReadResponse|1 count 5"]}};var Service={typeName:"sample.Service",methods:{read:{name:"Read",I:Req,O:Res,kind:i.Unary},watch:{name:"Watch",I:Req,O:Res,kind:i.ServerStreaming}}};';
  const result=extract.parseProtocol(source);
  assert.equal(result.services[0].methods[0].request.name,'ReadRequest');
  assert.equal(result.services[0].methods[0].request.fields[1].optional,true);
  assert.equal(result.services[0].methods[1].kind,'ServerStreaming');
});

test('resolves a wrapped gateway schema without evaluating its transformation',()=>{
  const source='Fields={prompt:(0,p.rpcString)(),agentId:(0,p.rpcString)()};Wrapped=wF((0,p.rpcObject)(Fields),transform);Edge=Zo("gateway",{methods:{sendPrompt:k().args(Wrapped)}});';
  assert.deepEqual(extract.parseGateway(source)[0].fields.map(x=>x.name),['prompt','agentId']);
});

test('nested gateway validators do not change the outer field type or optionality',()=>{
  const source='Edge=Zo("gateway",{methods:{settings:k().args({mapping:(0,p.rpcOptional)((0,p.rpcRecord)((0,p.rpcArray)((0,p.rpcString)()))),route:(0,p.rpcOptional)((0,p.rpcUnion)((0,p.rpcObject)({kind:(0,p.rpcString)()}),(0,p.rpcObject)({kind:(0,p.rpcString)()}))),requiredObject:(0,p.rpcObject)({nested:(0,p.rpcOptional)((0,p.rpcArray)((0,p.rpcString)()))})})}});';
  const fields=extract.parseGateway(source)[0].fields;
  assert.deepEqual(fields.map(x=>[x.type,x.optional]),[['record',true],['union',true],['object',false]]);
});

test('balanced blocks survive quoted braces and escaped quotes',()=>{
  assert.equal(typeof extract.balanced,'function');
  const source='{a:"quoted } and \\"",b:{c:1}} trailing';
  assert.equal(extract.balanced(source,0).end,source.indexOf(' trailing'));
});

test('gateway inventory distinguishes declarations and body field types',()=>{
  assert.equal(typeof extract.parseGateway,'function');
  const source='Tr={id:(0,p.rpcString)()};Arg=(0,p.rpcObject)({filename:(0,p.rpcString)(),bytesBase64:(0,p.rpcString)(),agentId:(0,p.rpcOptional)((0,p.rpcString)())});LFe=Zo("gateway",{methods:{listAgents:k().noArgs,uploadAttachment:k().args(Arg),getAgentAvatar:k().args(Tr)},events:Vr()});';
  const result=extract.parseGateway(source);
  assert.equal(result.length,3);
  const upload=result.find(x=>x.name==='uploadAttachment');
  assert.deepEqual(upload.fields.map(x=>x.name),['filename','bytesBase64','agentId']);
  assert.equal(upload.fields[2].optional,true);
  assert.equal(result.find(x=>x.name==='listAgents').fields.length,0);
});
