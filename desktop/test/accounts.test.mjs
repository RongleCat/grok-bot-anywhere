import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {InboxStore} from '../src/service/store.mjs';
import {AccountManager} from '../src/service/accounts.mjs';

const bot=(account,index=0)=>({id:`${account}-bot-${index}`,name:`${account} Bot ${index}`,sessionId:`${account}-session-${index}`});
const client=token=>({
 async getMe(){return {authId:token,name:`Account ${token}`,email:`${token}@example.test`};},
 async listBots(){return {bots:[bot(token,0),bot(token,1)],truncated:false};},
 async getRuntimeSettings(){return {mainAgentId:null,pinnedAgentIds:[],sections:[]};},
 async listStatuses(){return {statuses:[]};},
 async sendMessage(){return {delivery:'accepted-box'};}
});
const sdk=(overrides={})=>({
 GrokBotClient:class{constructor(credentials){return {...client(credentials.accessToken),...overrides}}},
 createLogin:()=>({loginUrl:'https://cursor.com/loginDeepControl'}),
 pollLogin:async()=>({accessToken:'c'}),
});

async function setup(t,{accounts=[{id:'a',credentials:{accessToken:'a'}},{id:'b',credentials:{accessToken:'b'}}],managerOverrides={}}={}){
 const root=await mkdtemp(join(tmpdir(),'gba-accounts-'));const store=new InboxStore(root);
 const manager=new AccountManager({store,sdk:sdk(managerOverrides),now:()=>1000});
 t.after(async()=>{manager.close();store.close();await rm(root,{recursive:true,force:true});});
 await manager.initialize({accounts});
 return {root,store,manager};
}

test('two accounts merge their checked Bots and keep an unchecked account visible in settings',async t=>{
 const {manager}=await setup(t);const state=manager.snapshot();
 assert.equal(state.accounts.length,2);
 assert.deepEqual(state.bots.map(item=>item.accountId).sort(),['a','a','b','b']);
 assert.equal(state.connected,true);
 assert.equal(state.account.id,'a');
 manager.setAccountChecked('b',false);
 const next=manager.snapshot();
 assert.equal(next.accounts.length,2);
 assert.deepEqual(next.bots.map(item=>item.accountId),['a','a']);
 assert.equal(next.accounts.find(item=>item.account.id==='b').checked,false);
 assert.equal(next.accounts.find(item=>item.account.id==='b').connected,true);
});

test('a receipt is routed to the account that owns its Bot',async t=>{
 const {manager}=await setup(t);
 const item=await manager.receive({botId:'b-bot-0',source:'drop',manual:true,text:'hello'});
 assert.equal(item.accountId,'b');
 const receipt=manager.composer(item.id);
 assert.equal(receipt.botId,'b-bot-0');
 manager.resolve;
 assert.equal(manager.snapshot().inbox.find(row=>row.id===item.id).accountId,'b');
});

test('one account expiring does not disconnect the other',async t=>{
 const {manager}=await setup(t);
 const original=manager.sessions.get('b').client;
 manager.sessions.get('b').client={...original,listBots:async()=>{throw Object.assign(new Error('RPC_FAILED'),{httpStatus:401});}};
 await manager.refresh({accountId:'b'});
 const state=manager.snapshot();
 assert.equal(state.accounts.find(item=>item.account.id==='a').connected,true);
 assert.equal(state.accounts.find(item=>item.account.id==='b').connected,false);
});

test('adding a second account returns credentials for the main-process vault',async t=>{
 const {manager}=await setup(t,{accounts:[{id:'a',credentials:{accessToken:'a'}}]});
 const result=await manager.addAccount({method:'browser'});
 assert.equal(result.accountId,'c');
 assert.equal(result.credentials.accessToken,'c');
 assert.equal(result.state.accounts.length,2);
 assert.deepEqual(result.state.bots.filter(item=>item.accountId==='c').length,2);
});

test('removing one account closes only that session',async t=>{
 const {manager}=await setup(t);
 const state=await manager.removeAccount('b');
 assert.equal(state.accounts.length,1);
 assert.equal(manager.session('b'),null);
 assert.ok(manager.session('a'));
});

test('the manager rejects a second login while one is already running',async t=>{
 const {manager}=await setup(t,{accounts:[]});
 let release;const pending=new Promise(resolve=>{release=resolve;});
 manager.sdk={...sdk(),createLogin:()=>({loginUrl:'https://cursor.com/loginDeepControl'}),pollLogin:()=>pending};
 const first=manager.addAccount({method:'browser'});
 await assert.rejects(manager.addAccount({method:'browser'}),/ACCOUNT_BUSY/);
 release({accessToken:'c'});await first;
});
