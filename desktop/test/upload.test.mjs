import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const loaded=await import('../src/service/upload.mjs').catch(()=>null);
test('application-owned uploader is available',()=>assert.ok(loaded?.uploadFile));
if(loaded){
 test('uploads >4MiB through single PUT and returns server reference without sending a Bot message',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gba-upload-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const path=join(root,'forward.zip');await writeFile(path,Buffer.alloc(5*1024*1024,1));const calls=[];
  const fetchImpl=async(url,options)=>{
   calls.push(String(url));
   if(String(url).includes('BeginGrokBotAttachmentUpload'))return Response.json({mode:2,uploadToken:'test',put:{url:'https://storage.googleapis.com/test'}});
   if(options.method==='PUT'){let bytes=0;for await(const chunk of options.body)bytes+=chunk.length;assert.equal(bytes,5*1024*1024);return new Response('',{status:200});}
   return Response.json({alias:'server-ref',sizeBytes:String(5*1024*1024)});
  };
  assert.deepEqual(await loaded.uploadFile({path,name:'forward.zip',bytes:5*1024*1024},{credentials:{accessToken:'test'},botId:'bot',fetchImpl}),{path:'server-ref',name:'forward.zip'});
  assert.equal(calls.length,3);assert.ok(calls.every(url=>!url.includes('SendGrokBot')));
 });
 test('refuses unsafe signed upload destinations before sending file bytes',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gba-upload-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'x');await writeFile(path,'x');
  let count=0;const fetchImpl=async()=>{count++;return Response.json({mode:2,uploadToken:'x',put:{url:'http://127.0.0.1/private'}});};
  await assert.rejects(loaded.uploadFile({path,name:'x',bytes:1},{credentials:{accessToken:'test'},botId:'bot',fetchImpl}),/UNTRUSTED_UPLOAD_ORIGIN/);assert.equal(count,1);
 });
}
