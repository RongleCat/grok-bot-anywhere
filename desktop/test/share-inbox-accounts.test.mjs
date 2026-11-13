import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ShareInbox} from '../src/service/share-inbox.mjs';

test('a WeChat batch is imported into the account named by its manifest',async t=>{
 const root=await mkdtemp(join(tmpdir(),'gba-share-accounts-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const received=[];
 const session=id=>({account:{id},transition:false,store:{list:()=>[],recipient:()=>({enabled:true,sources:{wechat:true}})},receive:async payload=>{received.push({id,...payload});return {id:'receipt',accountId:id,botId:payload.botId,mode:payload.policy.mode,status:'needs-input'};}});
 const inbox=new ShareInbox({root,sessionFor:id=>id==='b'?session('b'):null});await inbox.initialize();
 const directory=join(root,'Ready','batch');await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'x.zip'),'x');
 await writeFile(join(directory,'manifest.json'),JSON.stringify({version:1,id:'batch',source:'wechat',accountId:'b',botId:'bot-b',createdAt:Date.now(),mode:'compose',prefix:'',title:'',text:'',files:[{relativePath:'x.zip',name:'x.zip'}]}));
 await inbox.drain();
 assert.equal(received.length,1);assert.equal(received[0].id,'b');assert.equal(received[0].expectedAccountId,'b');
});
