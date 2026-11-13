import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import net from 'node:net';
import {LocalApiServer,localApiPaths,callLocalApi} from '../src/main/local-api.mjs';

async function setup(t,handler){
 const root=await mkdtemp(join(tmpdir(),'gba-local-api-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const api=new LocalApiServer({userData:root,handler});
 const info=await api.start();
 t.after(()=>api.close());
 return {root,api,info};
}
test('local API requires the token and returns structured results',async t=>{
 const {api,info}=await setup(t,async(method,params)=>{
  if(method==='echo')return {params};
  throw Object.assign(new Error('BOT_NOT_FOUND'),{code:'BOT_NOT_FOUND'});
 });
 assert.equal((await stat(info.tokenPath)).mode&0o777,0o600);
 assert.deepEqual(await callLocalApi({...info,method:'echo',params:{accountId:'a'}}),{params:{accountId:'a'}});
 await assert.rejects(callLocalApi({...info,method:'missing'}),error=>error.code==='BOT_NOT_FOUND');
});
test('a wrong token is rejected before the handler runs',async t=>{
 let calls=0;
 const {info}=await setup(t,async()=>{calls++;return {};});
 const token=await readFile(info.tokenPath,'utf8');
 const response=await new Promise((resolve,reject)=>{
  const socket=net.createConnection(info.socketPath);let data='';
  socket.setEncoding('utf8');
  socket.on('connect',()=>socket.write(`${JSON.stringify({id:'x',method:'echo',params:{},token:'wrong'})}\n`));
  socket.on('data',chunk=>{data+=chunk;});
  socket.on('close',()=>resolve(data));socket.on('error',reject);
 });
 assert.match(response,/LOCAL_API_UNAUTHORIZED/);assert.equal(calls,0);
 assert.ok(token.length>20);
});
test('the socket is removed on close',async t=>{
 const {api,info}=await setup(t,async()=>true);await api.close();
 await assert.rejects(stat(info.socketPath));
});
