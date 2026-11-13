import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const loaded=await import('../src/main/credentials.mjs').catch(()=>null);
test('credential vault is implemented',()=>assert.ok(loaded?.CredentialVault&&loaded?.AccountVault));
if(loaded){
 test('credentials are encrypted at rest and can be removed',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gba-vault-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const vault=new loaded.CredentialVault(join(root,'credentials'),{isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async value=>Buffer.from(value).reverse(),decryptStringAsync:async value=>({result:Buffer.from(value).reverse().toString(),shouldReEncrypt:false})});
  await vault.save({accessToken:'test-token'});assert.ok(!(await readFile(join(root,'credentials'),'utf8')).includes('test-token'));
  assert.deepEqual(await vault.load(),{accessToken:'test-token'});await vault.remove();assert.equal(await vault.load(),null);
 });
 test('unavailable OS encryption never falls back to plaintext',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gba-vault-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const vault=new loaded.CredentialVault(join(root,'credentials'),{isAsyncEncryptionAvailable:async()=>false});
  await assert.rejects(vault.save({accessToken:'secret'}),/CREDENTIAL_STORAGE_UNAVAILABLE/);
 });
 test('multiple accounts use separate encrypted files and can be listed',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gba-vault-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const storage={isAsyncEncryptionAvailable:async()=>true,encryptStringAsync:async value=>Buffer.from(value).reverse(),decryptStringAsync:async value=>({result:Buffer.from(value).reverse().toString(),shouldReEncrypt:false})};
  const vault=new loaded.AccountVault(join(root,'accounts'),storage);
  await vault.save('a',{accessToken:'token-a'});await vault.save('b',{accessToken:'token-b'});
  assert.equal((await vault.list()).length,2);
  assert.deepEqual(await vault.load('a'),{accessToken:'token-a'});
  await vault.remove('a');assert.equal(await vault.load('a'),null);
  await vault.clear();assert.deepEqual(await vault.list(),[]);
 });
}
