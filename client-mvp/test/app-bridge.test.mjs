import test from 'node:test';
import assert from 'node:assert/strict';
let BridgeSession;try{({BridgeSession}=await import('../app-session.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('app bridge refuses account commands before login',async()=>{
 assert.equal(typeof BridgeSession,'function');
 const session=new BridgeSession();
 await assert.rejects(session.call('list',{}),/NOT_CONNECTED/);
});
test('app bridge forwards a selected subscription and aborts it on unwatch',async()=>{
 assert.equal(typeof BridgeSession,'function');let watchOptions;
 const client={async *watchBot(options){watchOptions=options;yield {type:'connected',data:{}};await new Promise(resolve=>options.signal.addEventListener('abort',resolve,{once:true}));}};
 const events=[];const session=new BridgeSession({clientFactory:()=>client,emit:e=>events.push(e)});
 await session.call('connect',{accessToken:'fixture'});
 await session.call('watch',{botId:'selected',sessionId:'s'});
 await new Promise(resolve=>setImmediate(resolve));
 await session.call('unwatch',{});
 assert.equal(watchOptions.botId,'selected');assert.equal(watchOptions.sessionId,'s');assert.equal(watchOptions.signal.aborted,true);
 assert.equal(events[0].event,'bot.event');
});
test('app bridge does not retry an unconfirmed send',async()=>{
 assert.equal(typeof BridgeSession,'function');let calls=0;
 const session=new BridgeSession({clientFactory:()=>({sendMessage:async()=>{calls++;throw new Error('SEND_UNCONFIRMED');}})});
 await session.call('connect',{accessToken:'fixture'});
 await assert.rejects(session.call('send',{botId:'a',text:'hello',messageId:'nonce'}),/SEND_UNCONFIRMED/);
 assert.equal(calls,1);
});
test('account cannot switch or log out while a send is in progress',async()=>{
 let release;const session=new BridgeSession({clientFactory:()=>({sendMessage:async()=>await new Promise(resolve=>{release=()=>resolve({delivery:'accepted-box'});})})});
 await session.call('connect',{accessToken:'first'});
 const pending=session.call('send',{botId:'a',text:'hello',messageId:'nonce'});
 await new Promise(resolve=>setImmediate(resolve));
 try{await assert.rejects(session.call('connect',{accessToken:'second'}),/SEND_IN_PROGRESS/);await assert.rejects(session.call('logout'),/SEND_IN_PROGRESS/);}
 finally{release();await pending;}
});
test('runtime and statuses stay on the bridge without extra fields',async()=>{
 const client={
  async getRuntimeSettings(){return {mainAgentId:'main'};},
  async listStatuses(ids){return {statuses:ids.map(agentId=>({agentId,isRunning:agentId==='a'}))};}
 };
 const session=new BridgeSession({clientFactory:()=>client});
 await session.call('connect',{accessToken:'fixture'});
 assert.deepEqual(await session.call('runtime'),{mainAgentId:'main'});
 assert.deepEqual(await session.call('statuses',{agentIds:['a','b']}),{statuses:[{agentId:'a',isRunning:true},{agentId:'b',isRunning:false}]});
});
test('bridge status keeps an unfinished send visible after a caller stops waiting',async()=>{
 let release;const session=new BridgeSession({clientFactory:()=>({sendMessage:async()=>await new Promise(resolve=>{release=resolve;})})});
 await session.call('connect',{accessToken:'fixture'});const pending=session.call('send',{botId:'a',text:'hello'});
 await new Promise(resolve=>setImmediate(resolve));
 try{assert.equal((await session.call('status')).sending,true);}finally{release({});await pending;}
 assert.equal((await session.call('status')).sending,false);
});
