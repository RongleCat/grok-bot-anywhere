import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {InboxStore} from '../src/service/store.mjs';
import {AccountSession} from '../src/service/session.mjs';

const bot={id:'bot-one',serverId:'server-one',name:'Research',kind:'GROK_BOT_AGENT_KIND_AGENT',memberAgentIds:[],avatarShape:'cloud',avatarColor:'brown',avatar:{kind:'character',character:{shape:'cloud',color:'brown'}}};

async function setup(t,overrides={}){
  const root=await mkdtemp(join(tmpdir(),'gba-avatar-'));const store=new InboxStore(root);
  const calls=[];
  const client={
    getMe:async()=>({authId:'account-a'}),
    listBots:async()=>({bots:[bot],truncated:false}),
    updateBot:async params=>{calls.push(params);return {bot:{...bot,avatarShape:params.avatarShape,avatarColor:params.avatarColor}};},
    ...overrides
  };
  const session=new AccountSession({store,sdk:{GrokBotClient:class{constructor(){return client;}}}});
  t.after(async()=>{session.close();store.close();await rm(root,{recursive:true,force:true});});
  await session.connect({accessToken:'test'});
  return {session,store,calls,client};
}

test('avatar updates use the server id and both fields',async t=>{
  const {session,calls}=await setup(t);
  const result=await session.updateBotAvatar('bot-one',{shape:'pumpkin',color:'blue'});
  assert.deepEqual(calls,[{id:'server-one',avatarShape:'pumpkin',avatarColor:'blue'}]);
  assert.equal(result.bot.avatarShape,'pumpkin');
  assert.equal(result.bot.avatarColor,'blue');
  assert.equal(session.snapshot().bots[0].avatarShape,'pumpkin');
  assert.equal(session.snapshot().bots[0].avatarColor,'blue');
});

test('avatar updates reject shapes or colors outside the catalog',async t=>{
  const {session,calls}=await setup(t);
  await assert.rejects(session.updateBotAvatar('bot-one',{shape:'ghost',color:'blue'}),/AVATAR_INVALID/);
  await assert.rejects(session.updateBotAvatar('bot-one',{shape:'pumpkin',color:'neon'}),/AVATAR_INVALID/);
  assert.equal(calls.length,0);
});

test('avatar updates refuse rooms, pictures, and records without a server id',async t=>{
  const {session,client}=await setup(t);
  const original=client.listBots;
  client.listBots=async()=>({bots:[{...bot,kind:'GROK_BOT_AGENT_KIND_ROOM'},{...bot,id:'bot-picture',serverId:'server-picture',avatar:{kind:'picture'}},{...bot,id:'bot-no-server',serverId:''}],truncated:false});
  await session.refresh();
  await assert.rejects(session.updateBotAvatar('bot-one',{shape:'pumpkin',color:'orange'}),/BOT_NOT_EDITABLE/);
  await assert.rejects(session.updateBotAvatar('bot-picture',{shape:'pumpkin',color:'orange'}),/BOT_NOT_EDITABLE/);
  await assert.rejects(session.updateBotAvatar('bot-no-server',{shape:'pumpkin',color:'orange'}),/BOT_NOT_EDITABLE/);
  client.listBots=original;
});
