import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SaveInbox,safeName,dedupeName,validateSaveManifest,isWeChatHost} from '../src/share/save.mjs';

const manifest=(id,patch={})=>({version:1,id,source:'wechat',host:'com.tencent.xinWeChat',createdAt:new Date(2026,10,12,15,0,0).getTime(),title:'聊天记录',text:'',files:[{relativePath:'0-forward.zip',name:'forward.zip',bytes:5}],...patch});

async function setup(t,{prefs={enabled:true,mode:'default'},pick=async()=>null}={}){
 const root=await mkdtemp(join(tmpdir(),'gba-save-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const inboxRoot=join(root,'ShareInbox','Save'),destination=join(root,'Downloads');
 await mkdir(destination,{recursive:true});
 const values={enabled:true,mode:'default',defaultDir:destination,lastDir:'',...prefs};
 const saved=[],errors=[],cancels=[];
 const inbox=new SaveInbox({root:inboxRoot,getPrefs:()=>values,pickDirectory:pick,onSaved:row=>saved.push(row),onError:code=>errors.push(code),onCancel:id=>cancels.push(id)});
 await inbox.initialize();
 return {root,inbox,destination,values,saved,errors,cancels};
}
async function batch(root,id='batch-one',patch={}){
 const directory=join(root,'ShareInbox','Save','Ready',id);await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'0-forward.zip'),Buffer.alloc(5,1));
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest(id,patch)));
 return directory;
}

test('save names keep a usable basename and never overwrite',()=>{
 assert.equal(safeName('../../etc/passwd'),'-..-etc-passwd');
 assert.equal(safeName('a/b:c*.zip'),'a-b-c-.zip');
 assert.equal(dedupeName('report.zip',1),'report.zip');
 assert.equal(dedupeName('report.zip',2),'report (2).zip');
 assert.equal(isWeChatHost('com.tencent.xinWeChat'),true);
 assert.equal(isWeChatHost('com.tencent.xinWeChat2'),true);
 assert.equal(isWeChatHost('com.apple.finder'),false);
});

test('a manifest must come from WeChat and stay inside the batch',()=>{
 assert.doesNotThrow(()=>validateSaveManifest(manifest('a'),'a'));
 assert.throws(()=>validateSaveManifest(manifest('a',{host:'com.apple.finder'}),'a'),/SAVE_MANIFEST_INVALID/);
 assert.throws(()=>validateSaveManifest(manifest('a',{files:[{relativePath:'../x',name:'x'}]}),'a'),/SAVE_PATH_INVALID/);
});

test('default mode copies a single file and closes the batch',async t=>{
 const {root,inbox,destination,saved,errors}=await setup(t);await batch(root);await inbox.drain();
 assert.deepEqual(errors,[]);assert.equal(saved.length,1);
 assert.equal((await readFile(join(destination,'forward.zip'))).length,5);
 assert.deepEqual(await readdir(join(root,'ShareInbox','Save','Saved')),['batch-one']);
});

test('multiple files go into a dated folder and text-only shares become a text file',async t=>{
 const {root,inbox,destination,errors}=await setup(t);
 const one=await batch(root,'batch-one',{files:[{relativePath:'0-a.txt',name:'a.txt',bytes:1},{relativePath:'1-b.txt',name:'b.txt',bytes:1}]});
 await writeFile(join(one,'0-a.txt'),'a');await writeFile(join(one,'1-b.txt'),'b');
 await inbox.drain();
 const folders=await readdir(destination);assert.equal(folders.length,1);
 assert.deepEqual((await readdir(join(destination,folders[0]))).sort(),['a.txt','b.txt']);
 await batch(root,'batch-two',{title:'',text:'hello',files:[]});await inbox.drain();
 assert.deepEqual(errors,[]);
 assert.ok((await readdir(destination)).includes('微信分享 2026-11-12 150000.txt'));
});

test('choose mode uses the picker and remembers the last folder',async t=>{
 const {root,inbox,destination,values}=await setup(t,{prefs:{mode:'choose'}});
 const other=join(root,'Chosen');await mkdir(other);
 inbox.pickDirectory=async()=>{values.lastDir=other;return other;};
 await batch(root);await inbox.drain();
 assert.equal((await readFile(join(other,'forward.zip'))).length,5);
 assert.equal(values.lastDir,other);
});

test('cancelling the picker discards the batch without an error',async t=>{
 const {root,inbox,saved,errors}=await setup(t,{prefs:{mode:'choose'}});await batch(root);await inbox.drain();
 assert.deepEqual(saved,[]);assert.deepEqual(errors,[]);
 assert.deepEqual(await readdir(join(root,'ShareInbox','Save','Ready')),[]);
});

test('a traversal batch is failed and retained',async t=>{
 const {root,inbox,errors}=await setup(t);
 const directory=await batch(root,'bad',{files:[{relativePath:'../outside',name:'x'}]});
 await writeFile(join(root,'outside'),'private');
 await inbox.drain();
 assert.deepEqual(errors,['SAVE_PATH_INVALID']);
 assert.ok(await stat(join(root,'ShareInbox','Save','Failed','bad')));
});
