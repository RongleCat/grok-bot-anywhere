import {AccountSession} from './session.mjs';

const EMPTY_RUNTIME={mainAgentId:null,statuses:[],pinnedAgentIds:[],sections:[]};
const checkedDefault=value=>value!==false;

function normalizeRegistry(value){
  if(!Array.isArray(value))return [];
  const seen=new Set(),rows=[];
  for(const item of value){
    if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id||seen.has(item.id))continue;
    seen.add(item.id);
    rows.push({id:item.id,name:typeof item.name==='string'&&item.name.trim()?item.name.trim():item.id,email:typeof item.email==='string'?item.email:'',order:Number.isSafeInteger(item.order)?item.order:rows.length,checked:checkedDefault(item.checked)});
  }
  return rows.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
}

function publicAccount(account,id,entry){
  return {
    id,
    name:typeof account?.name==='string'&&account.name.trim()?account.name.trim():entry?.name??id,
    email:typeof account?.email==='string'?account.email:entry?.email??''
  };
}

export class AccountManager {
  constructor({store,sdk,upload,onEvent=()=>{},now=Date.now}){
    Object.assign(this,{store,sdk,upload,onEvent,now});
    this.sessions=new Map();
    this.closed=false;
    this.addBusy=false;
    this.emitQueued=false;
    this.registry=normalizeRegistry(store.accounts());
    if(!this.registry.length){
      const cached=store.preference('lastAccount');
      if(cached?.account?.id)this.registry=[{id:cached.account.id,name:cached.account.name??cached.account.id,email:cached.account.email??'',order:0,checked:true}];
    }
  }
  entry(id){return this.registry.find(item=>item.id===id)??null;}
  session(id){return this.sessions.get(id)??null;}
  isChecked(id){return checkedDefault(this.entry(id)?.checked);}
  checkedSessions(){return [...this.sessions.entries()].filter(([id,session])=>!session.closed&&this.isChecked(id)).map(([,session])=>session);}
  allSessions(){return [...this.sessions.values()].filter(session=>!session.closed);}
  saveRegistry(){this.store.saveAccounts(this.registry);}
  sortRegistry(){this.registry.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));}
  upsertAccount(account,{checked}={}){
    const id=account?.id;
    if(typeof id!=='string'||!id)return null;
    let entry=this.entry(id);
    if(!entry){
      entry={id,name:publicAccount(account,id).name,email:publicAccount(account,id).email,order:this.registry.length,checked:checked===undefined?true:!!checked};
      this.registry.push(entry);
    }else{
      entry.name=publicAccount(account,id,entry).name;
      if(typeof account.email==='string')entry.email=account.email;
      if(checked!==undefined)entry.checked=!!checked;
    }
    this.saveRegistry();
    return entry;
  }
  queueState(){
    if(this.closed||this.emitQueued)return;
    this.emitQueued=true;
    queueMicrotask(()=>{
      this.emitQueued=false;
      if(!this.closed)this.emitState();
    });
  }
  emitState(){this.onEvent({event:'state',data:this.snapshot()});}
  handleEvent(session,event){
    const id=session.account?.id??null;
    if(event.event==='state'){this.queueState();return;}
    if(event.event==='auth.expired'){
      this.onEvent({event:'auth.expired',data:{...event.data,accountId:event.data?.accountId||id}});
      this.queueState();
      return;
    }
    if(event.event==='reply'&&id&&!this.isChecked(id))return;
    this.onEvent({...event,data:{...event.data,accountId:event.data?.accountId??id}});
    this.queueState();
  }
  makeSession(account,bots=[]){
    const session=new AccountSession({
      store:this.store,sdk:this.sdk,upload:this.upload,now:this.now,persistLastAccount:false,
      initialAccount:account,initialBots:bots,onEvent:event=>this.handleEvent(session,event)
    });
    return session;
  }
  ensureOffline(id){
    if(this.sessions.has(id))return this.sessions.get(id);
    const entry=this.entry(id);
    const session=this.makeSession(entry?{id:entry.id,name:entry.name,email:entry.email}:{id,name:id},[]);
    this.sessions.set(id,session);
    return session;
  }
  async initialize({accounts=[]}={}){
    for(const entry of this.registry)this.ensureOffline(entry.id);
    const results=[];
    for(const stored of accounts??[]){
      if(!stored||typeof stored!=='object')continue;
      const credentials=stored.credentials??stored;
      if(typeof credentials?.accessToken!=='string'||!credentials.accessToken)continue;
      const expected=typeof stored.id==='string'&&stored.id?stored.id:null;
      const session=this.makeSession(expected?this.entry(expected)?{id:expected,name:this.entry(expected).name,email:this.entry(expected).email}:{id:expected,name:expected}:null,[]);
      try{
        await session.connect(credentials);
        const id=session.account?.id;
        if(typeof id!=='string'||!id)throw new Error('ACCOUNT_AUTH_FAILED');
        if(expected&&id!==expected)throw new Error('ACCOUNT_MISMATCH');
        const existing=this.sessions.get(id);
        if(existing&&existing!==session){
          if(!existing.isIdle())throw new Error('DELIVERY_IN_PROGRESS');
          existing.close();
        }
        this.sessions.set(id,session);
        this.upsertAccount(session.account);
        results.push({id,ok:true});
      }catch(error){
        session.close();
        if(expected){
          this.ensureOffline(expected);
          results.push({id:expected,ok:false,error:error?.message??'ACCOUNT_AUTH_FAILED'});
        }else results.push({id:null,ok:false,error:error?.message??'ACCOUNT_AUTH_FAILED'});
      }
    }
    for(const entry of this.registry)this.ensureOffline(entry.id);
    this.saveRegistry();
    this.emitState();
    return {state:this.snapshot(),results};
  }
  async connectAccount(credentials){
    if(!credentials||typeof credentials.accessToken!=='string'||!credentials.accessToken)throw new Error('CREDENTIAL_INVALID');
    const session=this.makeSession(null,[]);
    try{
      await session.connect(credentials);
      const id=session.account?.id;
      if(typeof id!=='string'||!id)throw new Error('ACCOUNT_AUTH_FAILED');
      const existing=this.sessions.get(id);
      if(existing&&existing!==session){
        if(!existing.isIdle())throw new Error('DELIVERY_IN_PROGRESS');
        existing.close();
      }
      this.sessions.set(id,session);
      this.upsertAccount(session.account,{checked:this.entry(id)?.checked??true});
      this.saveRegistry();
      this.emitState();
      return {accountId:id,credentials,state:this.snapshot()};
    }catch(error){
      session.close();
      throw error;
    }
  }
  async login(){return this.addAccount({method:'browser'});}
  async desktopLogin(){return this.addAccount({method:'desktop'});}
  async addAccount({method='browser'}={}){
    if(this.addBusy)throw new Error('ACCOUNT_BUSY');
    this.addBusy=true;
    try{
      let credentials;
      if(method==='desktop'){
        if(process.platform!=='darwin')throw new Error('MAC_ONLY');
        const {desktopCredentials}=await import('grok-bot-sdk/desktop');
        credentials=await desktopCredentials();
      }else{
        const flow=this.sdk.createLogin();
        this.onEvent({event:'login.url',data:{url:flow.loginUrl}});
        const result=await this.sdk.pollLogin(flow);
        credentials={accessToken:result.accessToken,...Number.isInteger(result.selectedTeamId)?{teamId:result.selectedTeamId}:{}};
      }
      return await this.connectAccount(credentials);
    }finally{
      this.addBusy=false;
      this.queueState();
    }
  }
  async removeAccount(accountId){
    const session=this.sessions.get(accountId);
    if(!session)throw new Error('ACCOUNT_NOT_FOUND');
    if(!session.isIdle())throw new Error('DELIVERY_IN_PROGRESS');
    session.close();
    this.sessions.delete(accountId);
    this.registry=this.registry.filter(entry=>entry.id!==accountId);
    this.saveRegistry();
    this.emitState();
    return this.snapshot();
  }
  async logout(){
    if([...this.sessions.values()].some(session=>!session.isIdle()))throw new Error('DELIVERY_IN_PROGRESS');
    for(const session of this.sessions.values())session.close();
    this.sessions.clear();
    this.registry=[];
    this.saveRegistry();
    this.emitState();
    return this.snapshot();
  }
  setAccountChecked(accountId,checked){
    const entry=this.entry(accountId);
    if(!entry)throw new Error('ACCOUNT_NOT_FOUND');
    entry.checked=!!checked;
    this.saveRegistry();
    this.emitState();
    return this.snapshot();
  }
  snapshot(){
    const rows=[...this.sessions.entries()].filter(([,session])=>!session.closed).map(([id,session])=>{
      const entry=this.entry(id)??{id,name:id,email:'',order:0,checked:true};
      const snap=session.snapshot();
      return {id,entry,snap,checked:checkedDefault(entry.checked)};
    }).sort((a,b)=>a.entry.order-b.entry.order||a.id.localeCompare(b.id));
    const checked=rows.filter(row=>row.checked);
    const accounts=rows.map(({id,entry,snap,checked:on})=>{
      const account=publicAccount(snap.account,id,entry);
      return {account,checked:on,connected:!!snap.connected,busy:!!snap.accountBusy,capabilities:snap.capabilities??{},runtime:snap.runtime??EMPTY_RUNTIME,botCount:Array.isArray(snap.bots)?snap.bots.length:0};
    });
    const bots=checked.flatMap(({id,snap})=>(snap.bots??[]).map(bot=>({...bot,accountId:id,accountName:publicAccount(snap.account,id).name})));
    const recipients=checked.flatMap(({id,snap})=>(snap.recipients??[]).map(recipient=>({...recipient,accountId:id})));
    const inbox=checked.flatMap(({id,snap})=>(snap.inbox??[]).map(item=>({...item,accountId:item.accountId??id}))).sort((a,b)=>(b.createdAt??0)-(a.createdAt??0));
    const runtime=checked.length===1?{...checked[0].snap.runtime,mainAgentIds:[checked[0].snap.runtime?.mainAgentId].filter(Boolean)}:{
      mainAgentId:null,
      mainAgentIds:checked.map(row=>row.snap.runtime?.mainAgentId).filter(Boolean),
      statuses:checked.flatMap(({id,snap})=>(snap.runtime?.statuses??[]).map(status=>({...status,accountId:id}))),
      pinnedAgentIds:[],
      sections:[]
    };
    const watchErrors={};
    for(const {snap} of checked)Object.assign(watchErrors,snap.watchErrors??{});
    const first=checked[0]?.snap??null;
    return {
      accounts,
      bots,
      recipients,
      inbox,
      theme:this.store.preference('theme')??'system',
      shortcuts:first?.shortcuts??{compose:null,open:null,bots:{},opens:{}},
      runtime,
      watchErrors,
      backgroundSending:checked.some(({snap})=>!!snap.backgroundSending),
      account:first?.account??null,
      connected:checked.some(({snap})=>!!snap.connected),
      accountBusy:this.addBusy||checked.some(({snap})=>!!snap.accountBusy),
      addingAccount:this.addBusy
    };
  }
  resolveBot({accountId,botId}={}){
    if(typeof botId!=='string'||!botId)throw new Error('BOT_NOT_FOUND');
    if(accountId){
      const session=this.sessions.get(accountId);
      const bot=session?.bots.find(item=>item.id===botId);
      if(!session||!bot)throw new Error('BOT_NOT_FOUND');
      return {session,bot};
    }
    for(const session of this.checkedSessions()){
      const bot=session.bots.find(item=>item.id===botId);
      if(bot)return {session,bot};
    }
    for(const session of this.allSessions()){
      const bot=session.bots.find(item=>item.id===botId);
      if(bot)return {session,bot};
    }
    throw new Error('BOT_NOT_FOUND');
  }
  get(id){return this.store.getAny(id);}
  sessionForReceipt(id){
    const item=this.store.getAny(id);
    if(!item)throw new Error('RECEIPT_NOT_FOUND');
    const session=this.sessions.get(item.accountId);
    if(!session)throw new Error('RECEIPT_NOT_FOUND');
    return {session,item};
  }
  async receive({accountId,botId,...input}){
    const {session,bot}=this.resolveBot({accountId,botId});
    return session.receive({...input,botId:bot.id,expectedAccountId:session.account?.id});
  }
  configure({accountId,botId,patch}){
    const {session}=this.resolveBot({accountId,botId});
    return session.configure(botId,patch);
  }
  disableAllReceive({accountId}={}){
    const sessions=accountId?[this.sessions.get(accountId)].filter(Boolean):this.checkedSessions();
    let closed=0;
    for(const session of sessions)closed+=session.disableAllReceive().closed??0;
    this.emitState();
    return {closed};
  }
  async duplicateBot({accountId,botId}){
    const {session}=this.resolveBot({accountId,botId});
    const result=await session.duplicateBot(botId);
    this.emitState();
    return result;
  }
  async updateBotAvatar({accountId,botId,...rest}){
    const {session}=this.resolveBot({accountId,botId});
    const result=await session.updateBotAvatar(botId,rest);
    this.queueState();
    return result;
  }
  async refresh({accountId}={}){
    const sessions=accountId?[this.sessions.get(accountId)].filter(Boolean):this.checkedSessions();
    await Promise.allSettled(sessions.map(session=>session.refresh()));
    this.emitState();
    return this.snapshot();
  }
  async submit(id,text,files){const {session}=this.sessionForReceipt(id);const result=await session.submit(id,text,files);this.queueState();return result;}
  submitAsync(id,text,files){const {session}=this.sessionForReceipt(id);const result=session.submitAsync(id,text,files);this.queueState();return result;}
  async retry(id){const {session}=this.sessionForReceipt(id);const result=await session.retry(id);this.queueState();return result;}
  resolve(id){const {session}=this.sessionForReceipt(id);const result=session.resolve(id);this.queueState();return result;}
  composer(id){const {session}=this.sessionForReceipt(id);return session.composer(id);}
  async dismissComposer(id){const {session}=this.sessionForReceipt(id);const result=await session.dismissComposer(id);this.queueState();return result;}
  watch({accountId,botId,sessionId=''}){const {session}=this.resolveBot({accountId,botId});return session.watch(botId,sessionId);}
  setTheme(theme){if(!['system','light','dark'].includes(theme))throw new Error('THEME_INVALID');this.store.preference('theme',theme);this.emitState();return this.snapshot();}
  setShortcut(slot,accelerator){
    let session=this.checkedSessions()[0]??this.allSessions()[0];
    if(!session)throw new Error('LOGIN_REQUIRED');
    const grok=typeof slot==='string'&&slot.startsWith('grok:')?slot.slice(5):'';
    const botId=slot==='compose'||slot==='open'?'':(grok||String(slot??''));
    if(botId){
      const found=this.resolveBot({botId});
      session=found.session;
    }
    return session.setShortcut(slot,accelerator);
  }
  async resume(){
    await Promise.allSettled(this.checkedSessions().map(session=>session.resume()));
    this.queueState();
  }
  close(){this.closed=true;for(const session of this.sessions.values())session.close();this.sessions.clear();}
}
