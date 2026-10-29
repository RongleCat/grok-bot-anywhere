import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const loaded=await import('../src/main/credentials.mjs').catch(()=>null);
test('credential vault is implemented',()=>assert.ok(loaded?.CredentialVault));
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
}
