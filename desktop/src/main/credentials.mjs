import {readFile,writeFile,rename,rm,mkdir,readdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export class CredentialVault {
  constructor(path,storage){Object.assign(this,{path,storage});}
  async save(credentials){
    if(!await this.storage.isAsyncEncryptionAvailable())throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE');
    const encrypted=await this.storage.encryptStringAsync(JSON.stringify(credentials));
    await mkdir(dirname(this.path),{recursive:true,mode:0o700});
    await writeFile(this.path+'.tmp',encrypted,{mode:0o600});await rename(this.path+'.tmp',this.path);
  }
  async load(){
    let bytes;try{bytes=await readFile(this.path);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(!await this.storage.isAsyncEncryptionAvailable())throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE');
    const {result,shouldReEncrypt}=await this.storage.decryptStringAsync(bytes);
    const value=JSON.parse(result);if(typeof value?.accessToken!=='string'||!value.accessToken)throw new Error('CREDENTIAL_INVALID');
    if(shouldReEncrypt)await this.save(value);return value;
  }
  async remove(){await rm(this.path,{force:true});}
}

export class AccountVault {
  constructor(root,storage){Object.assign(this,{root,storage});}
  pathFor(id){
    if(typeof id!=='string'||!id)throw new Error('CREDENTIAL_INVALID');
    return `${this.root}/${Buffer.from(id,'utf8').toString('base64url')}.enc`;
  }
  async save(id,credentials){
    if(typeof id!=='string'||!id||typeof credentials?.accessToken!=='string'||!credentials.accessToken)throw new Error('CREDENTIAL_INVALID');
    if(!await this.storage.isAsyncEncryptionAvailable())throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE');
    const encrypted=await this.storage.encryptStringAsync(JSON.stringify({id,credentials}));
    await mkdir(this.root,{recursive:true,mode:0o700});
    const path=this.pathFor(id);
    await writeFile(path+'.tmp',encrypted,{mode:0o600});await rename(path+'.tmp',path);
  }
  async load(id){
    const path=this.pathFor(id);let bytes;try{bytes=await readFile(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    if(!await this.storage.isAsyncEncryptionAvailable())throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE');
    const {result,shouldReEncrypt}=await this.storage.decryptStringAsync(bytes);
    const value=JSON.parse(result);
    if(value?.id!==id||typeof value?.credentials?.accessToken!=='string'||!value.credentials.accessToken)throw new Error('CREDENTIAL_INVALID');
    if(shouldReEncrypt)await this.save(id,value.credentials);
    return value.credentials;
  }
  async list(){
    let names=[];try{names=await readdir(this.root);}catch(error){if(error.code==='ENOENT')return [];throw error;}
    if(!await this.storage.isAsyncEncryptionAvailable())throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE');
    const rows=[];
    for(const name of names){
      if(!name.endsWith('.enc'))continue;
      try{
        const bytes=await readFile(`${this.root}/${name}`);
        const {result,shouldReEncrypt}=await this.storage.decryptStringAsync(bytes);
        const value=JSON.parse(result);
        if(typeof value?.id!=='string'||!value.id||typeof value?.credentials?.accessToken!=='string'||!value.credentials.accessToken)continue;
        rows.push({id:value.id,credentials:value.credentials});
        if(shouldReEncrypt)await this.save(value.id,value.credentials);
      }catch{/* A single unreadable account must not hide the others. */}
    }
    return rows;
  }
  async remove(id){await rm(this.pathFor(id),{force:true});}
  async clear(){let names=[];try{names=await readdir(this.root);}catch(error){if(error.code==='ENOENT')return;throw error;}for(const name of names)if(name.endsWith('.enc'))await rm(`${this.root}/${name}`,{force:true});}
}
