import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {InboxStore} from '../src/service/store.mjs';
const loaded=await import('../src/service/session.mjs').catch(()=>null);
test('account session is implemented',()=>assert.ok(loaded?.AccountSession));
const bot={id:'bot-one',name:'Research',sessionId:'s'};
if(loaded) {
 test('externally staged intake cannot be accepted under another account',async t=>{
  const {session,store}=await setup(t);
  await assert.rejects(session.receive({botId:bot.id,expectedAccountId:'other',source:'drop',manual:true,text:'private context'}),/RECEIPT_SCOPE_MISMATCH/);
  assert.equal(store.list('account-a').length,0);
 });
 test('a stale refresh authentication error cannot disconnect a newer account',async t=>{
  const {session,client}=await setup(t);let fail;
  client.listBots=()=>new Promise((_,reject)=>{fail=reject;});const stale=assert.rejects(session.refresh());
  session.sdk.GrokBotClient=class{async getMe(){return {authId:'account-b'};}async listBots(){return {bots:[bot]};}};
  await session.connect({accessToken:'B'});fail(Object.assign(new Error('RPC_FAILED'),{httpStatus:401}));await stale;
  assert.equal(session.snapshot().account.id,'account-b');assert.equal(session.snapshot().connected,true);
 });
 test('intake during an account transition is rejected before copying old account content',async t=>{
  const {session}=await setup(t);let release;const waiting=new Promise(r=>{release=r;});
  session.sdk.GrokBotClient=class{async getMe(){await waiting;return {authId:'account-b'};}async listBots(){return {bots:[bot]};}};
  const connecting=session.connect({accessToken:'B'});
  const rejected=assert.rejects(session.receive({botId:bot.id,source:'drop',manual:true,text:'A private context'}),/ACCOUNT_BUSY/);
  release();await connecting;await rejected;
 });
 test('a timed-out send cannot be unlocked or logged out while its SDK request is still live',async t=>{
  let release;const waiting=new Promise(r=>{release=r;});const {session}=await setup(t,{sendMessage:()=>waiting});
  session.configure(bot.id,{enabled:true,mode:'direct',sources:{drop:true}});session.delivery.now=()=>0;
  const item=await session.delivery.receive({accountId:'account-a',bot,source:'drop',text:'one'});session.delivery.now=()=>89999;
  await session.process(item.id);
  assert.equal(session.store.get(item.id,'account-a').status,'unconfirmed');
  assert.throws(()=>session.resolve(item.id),/DELIVERY_IN_PROGRESS/);await assert.rejects(session.logout(),/DELIVERY_IN_PROGRESS/);
  release({});await new Promise(r=>setImmediate(r));session.resolve(item.id);
 });
 test('fast live reply is persisted on the latest attempt and replay does not notify',async t=>{
  let startSend,finished;const sending=new Promise(r=>{startSend=r;}),received=new Promise(r=>{finished=r;});
  const {session}=await setup(t,{
   async *watchBot(){yield {type:'message',id:'old-cursor',data:{entryId:'old',text:'old history',replay:true}};await sending;yield {type:'message',id:'new-cursor',data:{entryId:'reply',text:'new reply',replay:false}};finished();},
   async sendMessage(){startSend();await received;return {};}
  });
  const events=[];session.onEvent=event=>events.push(event);
  const old=await session.receive({botId:bot.id,source:'drop',manual:true,text:'old request'});session.store.update(old.id,'account-a',{status:'sent',phase:'done'});
  const item=await session.receive({botId:bot.id,source:'drop',manual:true,text:'current'});await session.submit(item.id,'question');
  assert.deepEqual(session.store.get(item.id,'account-a').replies,[{id:'reply',text:'new reply'}]);
  assert.deepEqual(session.store.get(old.id,'account-a').replies,[]);
  assert.equal(events.filter(e=>e.event==='reply').length,1);
 });
 test('starting an account transition prevents new sends until it commits',async t=>{
  const {session}=await setup(t);let release;
  const waiting=new Promise(r=>{release=r;});
  const item=await session.receive({botId:bot.id,source:'drop',manual:true,text:'A draft'});
  session.sdk.GrokBotClient=class{async getMe(){await waiting;return {authId:'account-b'};}async listBots(){return {bots:[bot]};}};
  const connecting=session.connect({accessToken:'B'});
  const rejected=assert.rejects(session.submit(item.id,'A private question'),/ACCOUNT_BUSY/);
  release();await connecting;await rejected;
 });
 test('acknowledging an unconfirmed receipt releases the Bot without resending it',async t=>{
  let calls=0;const {session}=await setup(t,{sendMessage:async()=>{calls++;throw new Error('SEND_UNCONFIRMED');}});
  const item=await session.receive({botId:bot.id,source:'drop',manual:true,text:'one'});await session.submit(item.id,'one');
  session.resolve(item.id);
  assert.equal(session.store.get(item.id,'account-a').status,'unconfirmed');assert.equal(session.store.get(item.id,'account-a').holdResolved,true);assert.equal(calls,1);
 });
 test('a later send for the same Bot waits and then stops if the first send is unconfirmed',async t=>{
  let release,calls=0;const pending=new Promise(r=>{release=r;});
  const {session}=await setup(t,{sendMessage:async()=>{calls++;await pending;throw new Error('SEND_UNCONFIRMED');}});
  const first=await session.receive({botId:bot.id,source:'drop',manual:true,text:'one'});
  const second=await session.receive({botId:bot.id,source:'drop',manual:true,text:'two'});
  const sending=session.submit(first.id,'one');const queued=session.submit(second.id,'two');
  await new Promise(r=>setImmediate(r));const concurrentCalls=calls;
  const rejected=assert.rejects(queued,/BOT_SEND_HELD/);release();await sending;await rejected;assert.equal(concurrentCalls,1);assert.equal(calls,1);
 });
 async function setup(t,overrides={}) {
  const root=await mkdtemp(join(tmpdir(),'gba-session-'));const store=new InboxStore(root);
  const client={getMe:async()=>({authId:'account-a',email:'person@example.test',secret:'hidden'}),listBots:async()=>({bots:[bot],truncated:false}),sendMessage:async()=>({delivery:'accepted-box'}),...overrides};
  const session=new loaded.AccountSession({store,sdk:{GrokBotClient:class {constructor(){return client;}}}});
  t.after(async()=>{session.close();store.close();await rm(root,{recursive:true,force:true});});
  await session.connect({accessToken:'test-secret'});
  return {session,store,client};
 }
 test('state exposes only account summary and never credentials or raw account fields',async t=>{
  const {session}=await setup(t); const state=session.snapshot();
  assert.equal(state.account.id,'account-a');assert.equal(state.connected,true);
  assert.ok(!JSON.stringify(state).includes('test-secret'));assert.ok(!JSON.stringify(state).includes('hidden'));
  assert.equal(state.capabilities.runtime,false);
 });
 test('a compose-first external receipt never sends before user submission',async t=>{
  let sent=0;const {session}=await setup(t,{sendMessage:async()=>{sent++;return {};}});
  session.configure(bot.id,{enabled:true,sources:{drop:true}});
  const item=await session.receive({botId:bot.id,source:'drop',text:'context'});
  assert.equal(sent,0);assert.equal(item.status,'needs-input');
  await session.submit(item.id,'context + question');assert.equal(sent,1);
 });
 test('authentication failure disconnects delivery and retains local intake',async t=>{
  const {session,client}=await setup(t);
  client.listBots=async()=>{throw Object.assign(new Error('RPC_FAILED'),{httpStatus:401});};
  await assert.rejects(session.refresh());assert.equal(session.snapshot().connected,false);
  session.configure(bot.id,{enabled:true,sources:{drop:true}});
  const item=await session.receive({botId:bot.id,source:'drop',text:'offline'});
  assert.equal(item.status,'needs-input');await assert.rejects(session.submit(item.id,'later'),/LOGIN_REQUIRED/);
 });
 test('account changes are rejected while a send is in progress',async t=>{
  let release;const pending=new Promise(r=>{release=r;});
  const {session}=await setup(t,{sendMessage:async()=>{await pending;return {};}});
  const item=await session.receive({botId:bot.id,source:'drop',text:'manual',manual:true});
  const send=session.submit(item.id,'question');
  await assert.rejects(session.logout(),/DELIVERY_IN_PROGRESS/);release();await send;
 });
 test('login cancelled by logout cannot reconnect later',async t=>{
  const {session}=await setup(t);let release;
  session.sdk.createLogin=()=>({loginUrl:'https://cursor.com/loginDeepControl'});
  session.sdk.pollLogin=()=>new Promise(r=>{release=r;});
  const login=session.login();await session.logout();release({accessToken:'late'});
  await assert.rejects(login,/LOGIN_CANCELLED/);assert.equal(session.snapshot().connected,false);
 });
}
