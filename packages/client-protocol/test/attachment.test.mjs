import test from 'node:test';
import assert from 'node:assert/strict';
let mod={};
try{mod=await import('../attachment.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const feature=name=>assert.equal(typeof mod[name],'function',`${name} must exist`);

test('selects the named recipient uniquely and never falls back to another Bot',()=>{
 feature('chooseAgent');
 const agent={name:'Webhook 测试员',agentId:'target',harness:'temporal'};
 assert.equal(mod.chooseAgent([{name:'other',agentId:'other'},agent],'webhook 测试员'),agent);
 assert.throws(()=>mod.chooseAgent([agent,{...agent,agentId:'duplicate'}],'webhook 测试员'),/RECIPIENT_AMBIGUOUS/);
 assert.throws(()=>mod.chooseAgent([agent],'missing'),/RECIPIENT_NOT_FOUND/);
});

const options=()=>({accessToken:'account-secret',version:'0.70.2',agent:{name:'Webhook 测试员',agentId:'target',viewerSessionId:''},filename:'sample.md',bytes:Buffer.from('# Original attachment\n'),messageId:'test-nonce',prompt:'Read the attachment'});

test('uploads exact bytes and sends only committed attachment alias, without forwarding account headers to storage',async()=>{
 feature('uploadAndSend');
 const calls=[];const opts=options();
 const responses=[{mode:2,uploadToken:'upload-secret',put:{url:'https://bucket.s3.amazonaws.com/file?signed=secret',headers:{'content-type':'text/plain','content-length':String(opts.bytes.length)}}},null,{alias:'store-alias',sizeBytes:String(opts.bytes.length),fileName:opts.filename},{delivery:2,dispatched:true}];
 const result=await mod.uploadAndSend({...opts,fetchImpl:async(url,init)=>{calls.push({url,init});const value=responses.shift();return value===null?new Response('',{status:200}):new Response(JSON.stringify(value),{status:200});}});
 assert.equal(calls.length,4);
 assert.deepEqual(Buffer.from(calls[1].init.body),opts.bytes);
 assert.equal(calls[1].init.headers.authorization,undefined);
 assert.equal(calls[1].init.redirect,'error');
 const sent=JSON.parse(calls[3].init.body);
 assert.deepEqual(sent.attachmentPaths,['store-alias']);
 assert.deepEqual(sent.attachmentNames,[opts.filename]);
 assert.equal(sent.messageId,'test-nonce');
 assert.equal(sent.agentId,'target');
 assert.equal(result.delivery,'accepted-temporal');
 assert.ok(!JSON.stringify(result).includes('upload-secret'));
 assert.ok(!JSON.stringify(result).includes('signed=secret'));
});

test('a failed storage PUT prevents commit and message delivery',async()=>{
 feature('uploadAndSend');let calls=0;
 await assert.rejects(mod.uploadAndSend({...options(),fetchImpl:async()=>{calls++;return calls===1?new Response(JSON.stringify({mode:2,uploadToken:'secret',put:{url:'https://bucket.s3.amazonaws.com/file',headers:{}}}),{status:200}):new Response('',{status:403});}}),/UPLOAD_PUT_FAILED/);
 assert.equal(calls,2);
});

test('an ambiguous send failure is never automatically retried',async()=>{
 feature('uploadAndSend');let sends=0;
 const opts=options();const responses=[{mode:2,uploadToken:'secret',put:{url:'https://bucket.s3.amazonaws.com/file',headers:{}}},null,{alias:'store-alias'}];
 await assert.rejects(mod.uploadAndSend({...opts,fetchImpl:async(url)=>{if(url.endsWith('/SendGrokBotUserMessage')){sends++;throw new Error('network problem containing secret');}const value=responses.shift();return value===null?new Response('',{status:200}):new Response(JSON.stringify(value),{status:200});}}),/SEND_UNCONFIRMED/);
 assert.equal(sends,1);
});

test('rejects unexpected upload destination before transmitting file bytes',async()=>{
 feature('uploadAndSend');let calls=0;
 await assert.rejects(mod.uploadAndSend({...options(),fetchImpl:async()=>{calls++;return new Response(JSON.stringify({mode:2,uploadToken:'secret',put:{url:'https://untrusted.example/file',headers:{}}}),{status:200});}}),/UNTRUSTED_UPLOAD_ORIGIN/);
 assert.equal(calls,1);
});

test('USE_BOX uploads via Broker gateway credentials before sending the returned file path',async()=>{
 feature('uploadAndSend');const calls=[];
 const responses=[{mode:'GROK_BOT_ATTACHMENT_UPLOAD_MODE_USE_BOX'}, {gatewayUrl:'https://box.region.cursorvm.com',gatewayToken:'gateway-secret',networkToken:'network-secret'}, {path:'/data/agents/target/media/sample.md'}, {delivery:2}];
 const result=await mod.uploadAndSend({...options(),fetchImpl:async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(responses.shift()),{status:200});}});
 assert.equal(result.delivery,'accepted-temporal');
 assert.ok(calls[1].url.endsWith('/EnsureSandBox'));
 assert.deepEqual(JSON.parse(calls[1].init.body),{wake:false,supportsAsleepBox:true});
 assert.equal(calls[2].init.headers.authorization,'Bearer gateway-secret');
 assert.equal(calls[2].init.headers['x-anyrun-network-token'],'network-secret');
 assert.equal(JSON.parse(calls[2].init.body).bytesBase64,options().bytes.toString('base64'));
 assert.deepEqual(JSON.parse(calls[3].init.body).attachmentPaths,['/data/agents/target/media/sample.md']);
});

test('reply validation requires the current nonce and ignores user echoes and old replies',()=>{
 feature('validateReplies');const expected={messageId:'current-nonce',attachment:{sha256:'a'.repeat(64),bytes:100,firstHeading:'Title'}};
 const old={kind:'send-message',message:{type:'text',content:`Title 100 ${'a'.repeat(64)} old-nonce`}};
 assert.equal(mod.validateReplies([old],expected).verified,false);
 const echo={kind:'message',content:`Title 100 ${'a'.repeat(64)} current-nonce`};
 assert.equal(mod.validateReplies([echo],expected).verified,false);
 const actual={kind:'send-message',message:{type:'text',content:`Title 100 ${'a'.repeat(64)} current-nonce`}};
 assert.equal(mod.validateReplies([actual],expected).verified,true);
});
