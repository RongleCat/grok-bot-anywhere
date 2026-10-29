import {randomUUID} from 'node:crypto';
import {mkdir,copyFile,stat,rm,chmod} from 'node:fs/promises';
import {join,basename,isAbsolute} from 'node:path';
import {SOURCES} from './store.mjs';

const codeOf = error => typeof error?.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:/^[A-Z_]+$/.test(error?.message??'')?error.message:'DELIVERY_FAILED';
export class Delivery {
  constructor({store,client,upload=async()=>{throw new Error('UPLOAD_UNAVAILABLE');},now=Date.now,onChange=()=>{}}) {
    Object.assign(this,{store,client,upload,now,onChange});
    this.active=new Set();
    this.inflight=new Set();
  }
  async receive({accountId,bot,source,text='',title='',files=[],fileNames,manual=false,sourceId,policy}) {
    if(!accountId||!bot?.id||typeof text!=='string'||text.length>2_000_000||typeof title!=='string'||!Array.isArray(files)||files.length>100||files.some(p=>typeof p!=='string'||!isAbsolute(p))||!SOURCES.includes(source))throw new Error('RECEIPT_INVALID');
    const recipient=this.store.recipient(accountId,bot.id);
    if(!manual&&(!recipient.enabled||!recipient.sources[source]))throw new Error('SOURCE_DISABLED');
    if(fileNames&&(!Array.isArray(fileNames)||fileNames.length!==files.length||fileNames.some(n=>typeof n!=='string'||!n||/[\\/]/.test(n))))throw new Error('ATTACHMENT_INVALID');
    if(policy&&(!['compose','direct'].includes(policy.mode)||typeof policy.prefix!=='string'||!Number.isSafeInteger(policy.createdAt)))throw new Error('RECEIPT_INVALID');
    if(!text.trim()&&!files.length)throw new Error('RECEIPT_EMPTY');
    const id=randomUUID(),directory=join(this.store.root,'files',id),createdAt=policy?.createdAt??this.now();
    const item={id,accountId,botId:bot.id,botName:bot.name,sessionId:bot.sessionId??'',source,title,text,createdAt,mode:manual?'compose':recipient.mode,prefix:manual?'':recipient.prefix,files:[],status:'needs-input',phase:'ready',messageId:randomUUID(),replies:[],error:null};
    if(sourceId)item.sourceId=sourceId;
    if(policy){item.mode=policy.mode;item.prefix=policy.prefix;if(policy.sessionId!==undefined)item.sessionId=policy.sessionId;}
    try {
      await mkdir(directory,{recursive:true,mode:0o700});
      for(const [index,path] of files.entries()) {
        const info=await stat(path);if(!info.isFile()||info.size<1)throw new Error('ATTACHMENT_INVALID');
        const name=fileNames?.[index]??basename(path),target=join(directory,`${index}-${name}`);
        await copyFile(path,target);await chmod(target,0o600);
        item.files.push({path:target,name,bytes:(await stat(target)).size});
      }
      this.store.add(item);
    } catch(error){await rm(directory,{recursive:true,force:true});throw error;}
    this.onChange();return item;
  }
  async process(id,accountId,edit) {
    let item=this.store.get(id,accountId);
    if(!item)throw new Error('RECEIPT_NOT_FOUND');
    if(this.active.has(id)||!['needs-input','failed'].includes(item.status)||item.phase!=='ready')throw new Error('RECEIPT_NOT_SENDABLE');
    if(this.store.list(accountId).some(row=>row.botId===item.botId&&row.status==='unconfirmed'&&!row.holdResolved))throw new Error('BOT_SEND_HELD');
    if(item.mode==='compose'&&!edit)throw new Error('INPUT_REQUIRED');
    if(edit&&(typeof edit.text!=='string'||edit.text.length>2_000_000||edit.files!==undefined&&(!Array.isArray(edit.files)||edit.files.length>100||edit.files.some(path=>typeof path!=='string'||!isAbsolute(path)))))throw new Error('MESSAGE_INVALID');
    if(!(edit?.text??item.text).trim()&&!(edit?.files??item.files).length)throw new Error('RECEIPT_EMPTY');
    const deadline=item.mode==='direct'?item.createdAt+90_000:Infinity;
    if(this.now()>=deadline)return this.change(item,{status:'expired',phase:'done',error:null});
    this.active.add(id);
    let attempted=false;
    try {
      this.change(item,{phase:'uploading',error:null});
      if(edit){
        const files=[];
        for(const path of edit.files??item.files.map(f=>f.path)){
          const existing=item.files.find(f=>f.path===path);
          if(existing){files.push(existing);continue;}
          const info=await stat(path);if(!info.isFile()||!info.size)throw new Error('ATTACHMENT_INVALID');
          const name=basename(path),target=join(this.store.root,'files',id,`${randomUUID()}-${name}`);
          await copyFile(path,target);await chmod(target,0o600);files.push({path:target,name,bytes:(await stat(target)).size});
        }
        item=this.store.update(id,accountId,{text:edit.text,files});
      }
      const refs=[];
      for(const file of item.files) {
        refs.push(await this.upload(file,{botId:item.botId,sessionId:item.sessionId,deadline}));
        if(this.now()>=deadline)return this.change(item,{status:'expired',phase:'done'});
      }
      if(this.now()>=deadline)return this.change(item,{status:'expired',phase:'done'});
      const body=item.text.trim()||(item.files.length?'请阅读这些附件。':'');
      const text=item.mode==='direct'&&item.prefix?`${item.prefix}\n\n${body}`:body;
      this.change(item,{phase:'sending'});attempted=true;
      let timer;
      try {
        const send=Promise.resolve().then(()=>this.client.sendMessage({botId:item.botId,sessionId:item.sessionId,messageId:item.messageId,text,attachmentPaths:refs.map(r=>r.path),attachmentNames:refs.map(r=>r.name)}));
        this.inflight.add(item.id);
        const settled=()=>{this.inflight.delete(item.id);this.onChange();};send.then(settled,settled);
        const result=await Promise.race([
          send,
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('SEND_UNCONFIRMED')),Math.min(90_000,deadline-this.now()));})
        ]);
        return this.change(item,{status:'sent',phase:'done',sentAt:this.now(),delivery:result.delivery??null,error:null});
      } finally {clearTimeout(timer);}
    }catch(error){
      const code=codeOf(error);
      this.change(item,{status:attempted?'unconfirmed':this.now()>=deadline?'expired':'failed',phase:attempted?'held':this.now()>=deadline?'done':'ready',error:code});
      if(error?.httpStatus===401||error?.httpStatus===403)throw error;
      return this.store.get(id,accountId);
    }finally{this.active.delete(id);}
  }
  change(item,patch){const updated=this.store.update(item.id,item.accountId,patch);this.onChange();return updated;}
}
