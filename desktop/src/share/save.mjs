import {mkdir,readdir,readFile,lstat,realpath,rename,rm,copyFile,writeFile} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {join,relative,isAbsolute,sep,basename,extname} from 'node:path';

export const SAVE_MANIFEST_VERSION=1;
export const SAVE_MAX_FILES=100;
export const SAVE_MAX_TEXT=2_000_000;
export const SAVE_MAX_TITLE=1000;

export function isWeChatHost(value){
  return typeof value==='string'&&/^com\.tencent\.xinWeChat\d*$/.test(value);
}

export function safeName(value,fallback='attachment'){
  let name=String(value??'').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'-').replace(/^\.+/,'').trim();
  if(!name||name==='.'||name==='..')name=fallback;
  if(name.length>180)name=name.slice(0,180);
  return name;
}

export function dedupeName(name,index){
  if(index<=1)return name;
  const ext=extname(name),stem=name.slice(0,Math.max(0,name.length-ext.length));
  return `${stem} (${index})${ext}`;
}

export function validateSaveManifest(value,id){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('SAVE_MANIFEST_INVALID');
  if(value.version!==SAVE_MANIFEST_VERSION||value.id!==id||value.source!=='wechat'||!isWeChatHost(value.host))throw new Error('SAVE_MANIFEST_INVALID');
  if(!Number.isSafeInteger(value.createdAt)||typeof value.title!=='string'||value.title.length>SAVE_MAX_TITLE||typeof value.text!=='string'||value.text.length>SAVE_MAX_TEXT)throw new Error('SAVE_MANIFEST_INVALID');
  if(!Array.isArray(value.files)||value.files.length>SAVE_MAX_FILES)throw new Error('SAVE_MANIFEST_INVALID');
  for(const file of value.files){
    if(!file||typeof file!=='object'||typeof file.relativePath!=='string'||!file.relativePath||isAbsolute(file.relativePath)||file.relativePath.split(/[\\/]/).some(part=>part===''||part==='..'))throw new Error('SAVE_PATH_INVALID');
    if(typeof file.name!=='string'||!file.name||/[\\/]/.test(file.name))throw new Error('SAVE_PATH_INVALID');
    if(!Number.isSafeInteger(file.bytes)||file.bytes<0)throw new Error('SAVE_MANIFEST_INVALID');
  }
  if(!value.files.length&&!value.text.trim())throw new Error('SAVE_EMPTY');
  return value;
}

function stamp(value){
  const date=new Date(Number.isSafeInteger(value)?value:Date.now());
  const pad=number=>String(number).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function saveFolderName(manifest){
  const title=String(manifest?.title??'').trim();
  return safeName(`${stamp(manifest?.createdAt)}${title?` - ${title}`:''}`,'微信分享');
}

export async function uniqueTarget(directory,name){
  const base=safeName(name);
  for(let index=1;index<=999;index++){
    const candidate=join(directory,dedupeName(base,index));
    try{await lstat(candidate);continue;}catch(error){if(error.code==='ENOENT')return candidate;throw error;}
  }
  throw new Error('SAVE_NAME_COLLISION');
}

export class SaveInbox {
  constructor({root,getPrefs,pickDirectory,onSaved=()=>{},onError=()=>{},onCancel=()=>{}}){
    Object.assign(this,{root,getPrefs,pickDirectory,onSaved,onError,onCancel});
    this.busy=false;this.stopped=false;
  }
  async initialize(){
    for(const folder of ['Staging','Ready','Saved','Failed'])await mkdir(join(this.root,folder),{recursive:true,mode:0o700});
  }
  async drain(){
    if(this.busy||this.stopped)return;
    const prefs=this.getPrefs();
    if(!prefs?.enabled)return;
    this.busy=true;
    try{
      for(const name of await readdir(join(this.root,'Ready'))){
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(name))continue;
        await this.process(name,prefs).catch(error=>this.fail(name,error));
      }
    }finally{this.busy=false;}
  }
  async process(name,prefs){
    const directory=join(this.root,'Ready',name);
    const info=await lstat(directory);
    if(!info.isDirectory()||info.isSymbolicLink())throw new Error('SAVE_PATH_INVALID');
    const manifestPath=join(directory,'manifest.json'),manifestInfo=await lstat(manifestPath);
    if(!manifestInfo.isFile()||manifestInfo.isSymbolicLink()||manifestInfo.size>8*1024*1024)throw new Error('SAVE_MANIFEST_INVALID');
    const manifest=validateSaveManifest(JSON.parse(await readFile(manifestPath,'utf8')),name);
    const files=[];
    for(const file of manifest.files){
      const path=join(directory,file.relativePath),fileInfo=await lstat(path),resolved=await realpath(path),base=await realpath(directory),rel=relative(base,resolved);
      if(fileInfo.isSymbolicLink()||!fileInfo.isFile()||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('SAVE_PATH_INVALID');
      files.push({...file,path});
    }
    let destination;
    if(prefs.mode==='choose'){
      destination=await this.pickDirectory(prefs.lastDir||prefs.defaultDir);
      if(!destination){await rm(directory,{recursive:true,force:true});this.onCancel(name);return;}
    }else destination=prefs.defaultDir;
    if(typeof destination!=='string'||!isAbsolute(destination))throw new Error('SAVE_DIR_INVALID');
    await mkdir(destination,{recursive:true,mode:0o700});
    const base=await realpath(destination);
    const resolvedRoot=await realpath(this.root);
    if(base===resolvedRoot||base.startsWith(resolvedRoot+sep))throw new Error('SAVE_DIR_INVALID');
    const output=[];
    if(files.length===1){
      const target=await uniqueTarget(base,safeName(files[0].name,basename(files[0].path)));
      await copyFile(files[0].path,target,fsConstants.COPYFILE_EXCL);
      output.push(target);
    }else if(files.length>1){
      const folder=await uniqueTarget(base,saveFolderName(manifest));
      await mkdir(folder,{recursive:true,mode:0o700});
      for(const file of files){
        const target=await uniqueTarget(folder,safeName(file.name,basename(file.path)));
        await copyFile(file.path,target,fsConstants.COPYFILE_EXCL);
        output.push(target);
      }
    }else{
      const target=await uniqueTarget(base,safeName(`微信分享 ${stamp(manifest.createdAt)}.txt`));
      await writeFile(target,manifest.title?`${manifest.title}\n\n${manifest.text}`:manifest.text,{flag:'wx',mode:0o600});
      output.push(target);
    }
    await rename(directory,join(this.root,'Saved',name)).catch(async()=>{await rm(directory,{recursive:true,force:true});});
    this.onSaved({id:name,destination:base,files:output});
  }
  async fail(name,error){
    const directory=join(this.root,'Ready',name);
    const failure=String(error?.message??error??'SAVE_FAILED');
    try{
      const info=await lstat(directory);
      if(info.isDirectory()&&!info.isSymbolicLink()){
        await writeFile(join(directory,'failure.txt'),failure,{flag:'wx',mode:0o600}).catch(()=>{});
        await rename(directory,join(this.root,'Failed',name)).catch(()=>{});
      }
    }catch{/* The batch may already be gone. */}
    this.onError(failure);
  }
  stop(){this.stopped=true;}
}
