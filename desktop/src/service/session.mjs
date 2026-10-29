import * as sdk from 'grok-bot-sdk';
import {Delivery} from './delivery.mjs';

export class AccountSession {
  constructor({store,sdk:implementation=sdk,upload,onEvent=()=>{},now=Date.now}) {
    Object.assign(this,{store,sdk:implementation,upload,onEvent,now});
    const cached=store.preference('lastAccount');
    this.account=cached?.account??null;this.bots=cached?.bots??[];
    this.client=null;this.credentials=null;this.generation=0;this.pending=0;this.transition=false;
    this.watches=new Map();this.sendQueues=new Map();this.watchErrors={};this.runtime={mainAgentId:null,statuses:[]};
  }
  requireAccount(){if(!this.account)throw new Error('LOGIN_REQUIRED');return this.account.id;}
  requireClient(){if(this.transition)throw new Error('ACCOUNT_BUSY');if(!this.client)throw new Error('LOGIN_REQUIRED');return this.client;}
  assertIdle(){if(this.pending||this.delivery?.active.size||this.delivery?.inflight.size)throw new Error('DELIVERY_IN_PROGRESS');if(this.transition)throw new Error('ACCOUNT_BUSY');}
  snapshot(){
    const accountId=this.account?.id;
    return {account:this.account,connected:!!this.client,accountBusy:this.transition,bots:this.bots,recipients:accountId?this.bots.map(bot=>this.store.recipient(accountId,bot.id)):[],
      inbox:accountId?this.store.list(accountId).map(({files,...item})=>({...item,files:files.map(({name,bytes})=>({name,bytes}))})):[],
      theme:this.store.preference('theme')??'system',runtime:this.runtime,watchErrors:this.watchErrors,backgroundSending:!!this.delivery?.inflight.size,
      capabilities:{runtime:typeof this.client?.getRuntimeSettings==='function',statuses:typeof this.client?.listStatuses==='function'}};
  }
  emit(){if(!this.closed)this.onEvent({event:'state',data:this.snapshot()});}
  async login() {
    this.assertIdle();const generation=++this.generation;
    this.transition=true;this.emit();
    try{
    const flow=this.sdk.createLogin();this.onEvent({event:'login.url',data:{url:flow.loginUrl}});
    const result=await this.sdk.pollLogin(flow);
    if(generation!==this.generation)throw new Error('LOGIN_CANCELLED');
    const credentials={accessToken:result.accessToken,...Number.isInteger(result.selectedTeamId)?{teamId:result.selectedTeamId}:{}};
    return await this.connect(credentials,generation);
    }finally{if(generation===this.generation){this.transition=false;this.emit();}}
  }
  async desktopLogin(){
    this.assertIdle();const generation=++this.generation;
    this.transition=true;this.emit();
    try{
    if(process.platform!=='darwin')throw new Error('MAC_ONLY');
    const {desktopCredentials}=await import('grok-bot-sdk/desktop');
    const credentials=await desktopCredentials();
    if(generation!==this.generation)throw new Error('LOGIN_CANCELLED');
    return await this.connect(credentials,generation);
    }finally{if(generation===this.generation){this.transition=false;this.emit();}}
  }
  async connect(credentials,expectedGeneration) {
    if(expectedGeneration===undefined)this.assertIdle();
    const generation=expectedGeneration??++this.generation;
    this.transition=true;this.emit();
    try{
    const client=new this.sdk.GrokBotClient(credentials);
    const me=await client.getMe();const roster=await client.listBots();
    if(generation!==this.generation)throw new Error('LOGIN_CANCELLED');
    this.stopWatches();
    this.account={id:String(me.authId??me.userId),name:me.name??me.email??'Grok Bot'};
    this.bots=roster.bots;this.client=client;this.credentials=credentials;this.watchErrors={};
    this.delivery=new Delivery({store:this.store,client,now:this.now,upload:(file,context)=>{
      if(!this.upload)throw new Error('UPLOAD_UNAVAILABLE');
      return this.upload(file,{...context,credentials});
    },onChange:()=>this.emit()});
    this.store.preference('lastAccount',{account:this.account,bots:this.bots});
    this.emit();
    this.transition=false;this.emit();return {credentials,state:this.snapshot()};
    }finally{if(generation===this.generation){this.transition=false;this.emit();}}
  }
  async refresh(){
    const client=this.requireClient(),generation=this.generation;
    try{
      const roster=await client.listBots();
      if(generation!==this.generation)throw new Error('LOGIN_CANCELLED');
      let runtime=this.runtime;
      if(typeof client.getRuntimeSettings==='function')runtime={...runtime,...await client.getRuntimeSettings()};
      if(typeof client.listStatuses==='function')runtime={...runtime,...await client.listStatuses(roster.bots.map(b=>b.id))};
      if(generation!==this.generation)throw new Error('LOGIN_CANCELLED');
      this.bots=roster.bots;this.runtime=runtime;
      this.store.preference('lastAccount',{account:this.account,bots:this.bots});this.emit();return this.snapshot();
    }catch(error){if(generation===this.generation)this.authFailure(error);throw error;}
  }
  configure(botId,patch){const accountId=this.requireAccount();if(!this.bots.some(b=>b.id===botId))throw new Error('BOT_NOT_FOUND');const result=this.store.saveRecipient(accountId,botId,patch);this.emit();return result;}
  async receive({botId,expectedAccountId,...input}){
    if(this.transition)throw new Error('ACCOUNT_BUSY');
    const accountId=this.requireAccount(),bot=this.bots.find(b=>b.id===botId);if(!bot)throw new Error('BOT_NOT_FOUND');
    if(expectedAccountId!==undefined&&expectedAccountId!==accountId)throw new Error('RECEIPT_SCOPE_MISMATCH');
    // Local intake stays available when credentials expire.
    const delivery=this.delivery??new Delivery({store:this.store,now:this.now,onChange:()=>this.emit()});
    this.pending++;
    try{
      const item=await delivery.receive({...input,accountId,bot});
      if(item.mode==='direct'&&this.client&&!this.transition&&this.account?.id===accountId)await this.process(item.id);
      return this.store.get(item.id,accountId);
    }finally{this.pending--;}
  }
  async process(id,edit){
    this.requireClient();const accountId=this.requireAccount();
    const item=this.store.get(id,accountId);if(!item)throw new Error('RECEIPT_NOT_FOUND');
    this.pending++;
    const previous=this.sendQueues.get(item.botId)??Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      this.requireClient();
      this.watch(item.botId,item.sessionId);
      return this.delivery.process(id,accountId,edit);
    });
    this.sendQueues.set(item.botId,task);
    try{
      return await task;
    }catch(error){this.authFailure(error);throw error;}finally{this.pending--;if(this.sendQueues.get(item.botId)===task)this.sendQueues.delete(item.botId);}
  }
  submit(id,text,files){return this.process(id,{text,...files!==undefined?{files}:{}});}
  async retry(id){const item=this.store.get(id,this.requireAccount());if(!item||item.status!=='failed')throw new Error('RECEIPT_NOT_SENDABLE');return this.process(id,item.mode==='compose'?{text:item.text}:undefined);}
  resolve(id){
    this.assertIdle();const accountId=this.requireAccount(),item=this.store.get(id,accountId);
    if(!item||item.status!=='unconfirmed')throw new Error('RECEIPT_NOT_UNCONFIRMED');
    const result=this.store.update(id,accountId,{holdResolved:true,resolvedAt:this.now()});this.emit();return result;
  }
  composer(id){const item=this.store.get(id,this.requireAccount());if(!item||!['needs-input','failed'].includes(item.status))throw new Error('RECEIPT_NOT_SENDABLE');return item;}
  async resume(){
    if(!this.client)return;
    for(const item of this.store.list(this.requireAccount()).reverse()){
      if(!this.client)break;
      if(item.mode==='direct'&&item.status==='needs-input'&&item.phase==='ready')await this.process(item.id);
    }
  }
  watch(botId,sessionId=''){
    const client=this.requireClient();if(typeof client.watchBot!=='function')return;
    const accountId=this.requireAccount(),key=`${botId}|${sessionId}`;
    if(this.watches.has(key))return;
    const control=new AbortController();this.watches.set(key,control);
    const cursorKey=`cursor:${accountId}:${key}`,resumeFrom=this.store.preference(cursorKey);
    void(async()=>{
      try{
        for await(const event of client.watchBot({botId,sessionId,signal:control.signal,...resumeFrom?{resumeFrom}:{}})){
          if(control.signal.aborted)return;
          if(event.type==='message'&&!event.data.replay){
            // The SDK exposes Bot/session events, not a request→reply relation.
            // Attach new live events only to the latest active/sent attempt.
            const item=this.store.list(accountId).find(row=>row.botId===botId&&row.sessionId===sessionId&&(row.phase==='sending'||['sent','unconfirmed'].includes(row.status)));
            if(item&&event.data.entryId!==item.messageId){
              const known=item.replies.some(r=>r.id===event.data.entryId);
              const replies=item.replies.filter(r=>r.id!==event.data.entryId);replies.push({id:event.data.entryId,text:event.data.text});
              this.store.update(item.id,accountId,{replies:replies.slice(-100),replyScope:'bot-session'});
              if(!known)this.onEvent({event:'reply',data:{botId,name:this.bots.find(b=>b.id===botId)?.name??'',text:event.data.text}});
              this.emit();
            }
          }
          if(event.type==='message.deleted'){
            for(const item of this.store.list(accountId).filter(row=>row.botId===botId&&row.sessionId===sessionId))this.store.update(item.id,accountId,{replies:item.replies.filter(r=>r.id!==event.data.entryId)});
            this.emit();
          }
          if(event.id)this.store.preference(cursorKey,event.id);
        }
      }catch(error){if(!control.signal.aborted){this.watchErrors[botId]='REPLY_DISCONNECTED';this.authFailure(error);this.emit();}}
      finally{if(this.watches.get(key)===control)this.watches.delete(key);}
    })();
  }
  authFailure(error){
    if(error?.httpStatus===401||error?.httpStatus===403){this.client=null;this.credentials=null;this.stopWatches();this.onEvent({event:'auth.expired',data:{}});this.emit();}
  }
  setTheme(theme){if(!['system','light','dark'].includes(theme))throw new Error('THEME_INVALID');this.store.preference('theme',theme);this.emit();return this.snapshot();}
  async logout(){if(this.pending||this.delivery?.active.size||this.delivery?.inflight.size)throw new Error('DELIVERY_IN_PROGRESS');++this.generation;this.transition=false;this.stopWatches();this.client=null;this.credentials=null;this.account=null;this.bots=[];this.runtime={mainAgentId:null,statuses:[]};this.store.preference('lastAccount',null);this.emit();return this.snapshot();}
  stopWatches(){for(const control of this.watches.values())control.abort();this.watches.clear();}
  close(){this.closed=true;++this.generation;this.stopWatches();}
}
