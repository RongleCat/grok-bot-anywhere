import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {LocalApiServer} from '../src/main/local-api.mjs';
const run=promisify(execFile);
const cli=new URL('../resources/grok-bot-skill/grok-bot/bin/gba.mjs',import.meta.url);
async function setup(t,handler){
 const root=await mkdtemp(join(tmpdir(),'gba-cli-local-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const api=new LocalApiServer({userData:root,handler});const info=await api.start();t.after(()=>api.close());
 const env={...process.env,GBA_SOCKET:info.socketPath,GBA_TOKEN_FILE:info.tokenPath};
 return {root,api,env};
}
async function call(args,env){
 try{return await run(process.execPath,[cli.pathname,...args],{env,timeout:10000});}
 catch(error){return {stdout:error.stdout,stderr:error.stderr,exitCode:error.code};}
}
test('gba lists accounts and sends through the local API',async t=>{
 const seen=[];
 const {env}=await setup(t,async(method,params)=>{
  seen.push([method,params]);
  if(method==='accounts.list')return {accounts:[{account:{id:'a',name:'A'},checked:true,connected:true,botCount:1}]};
  if(method==='messages.send')return {receipt:{id:'r1',status:'sent'}};
  return {};
 });
 const list=await call(['accounts','list','--json'],env);
 assert.equal(list.exitCode,undefined);assert.match(list.stdout,/"ok":true/);assert.match(list.stdout,/"name":"A"/);
 const send=await call(['send','--account','a','--bot','b1','--text','hello','--json'],env);
 assert.match(send.stdout,/"id":"r1"/);
 assert.deepEqual(seen.map(row=>row[0]),['accounts.list','messages.send']);
 assert.deepEqual(seen[1][1],{accountId:'a',botId:'b1',text:'hello',files:[],title:'',mode:'now'});
});
test('gba maps bot mutations and inbox creation to local API methods',async t=>{
 const seen=[];
 const {env}=await setup(t,async(method,params)=>{seen.push([method,params]);return {ok:true};});
 for(const args of [
  ['bots','duplicate','b1','--json'],
  ['bots','avatar','b1','--shape','cloud','--color','brown','--json'],
  ['recipients','configure','b1','{"enabled":true}','--json'],
  ['inbox','create','--bot','b1','--text','hello','--json']
 ])await call(args,env);
 assert.deepEqual(seen.map(row=>row[0]),['bots.duplicate','bots.updateAvatar','recipients.configure','inbox.create']);
 assert.equal(seen[1][1].shape,'cloud');
 assert.deepEqual(seen[2][1].patch,{enabled:true});
 assert.equal(seen[3][1].text,'hello');
});
test('gba reports APP_NOT_RUNNING with exit 4',async t=>{
 const root=await mkdtemp(join(tmpdir(),'gba-cli-missing-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const env={...process.env,GBA_SOCKET:join(root,'missing.sock'),GBA_TOKEN_FILE:join(root,'missing.token')};
 const result=await call(['status','--json'],env);
 assert.equal(result.exitCode,4);assert.match(result.stdout,/APP_NOT_RUNNING/);
});
