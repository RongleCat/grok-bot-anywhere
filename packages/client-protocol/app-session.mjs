import {readFile,stat} from 'node:fs/promises';
import {basename} from 'node:path';
import {GrokBotClient,createLogin,pollLogin} from './sdk.mjs';
import {uploadAttachment} from './attachment.mjs';

export class BridgeSession {
  #client;#credentials;#watch;#emit;#factory;#authGeneration=0;#sending=0;
  constructor({clientFactory=options=>new GrokBotClient(options),emit=()=>{}}={}){this.#factory=clientFactory;this.#emit=emit;}
  async call(method,params={}){
    if(method==='status')return {connected:!!this.#client,sending:this.#sending>0};
    if(['login','desktop','connect','logout'].includes(method)&&this.#sending)throw new Error('SEND_IN_PROGRESS');
    if(method==='login'){
      const generation=++this.#authGeneration;
      const flow=createLogin();this.#emit({event:'login.url',data:{url:flow.loginUrl}});
      const auth=await pollLogin(flow);const credentials={accessToken:auth.accessToken,...Number.isInteger(auth.selectedTeamId)?{teamId:auth.selectedTeamId}:{}};
      if(generation!==this.#authGeneration)throw new Error('LOGIN_CANCELLED');
      await this.call('connect',credentials);return {credentials};
    }
    if(method==='desktop'){
      const generation=++this.#authGeneration;
      const {desktopCredentials}=await import('./desktop.mjs');const credentials=await desktopCredentials();
      if(generation!==this.#authGeneration)throw new Error('LOGIN_CANCELLED');
      await this.call('connect',credentials);return {credentials};
    }
    if(method==='connect'){
      ++this.#authGeneration;
      this.#watch?.abort();this.#credentials={accessToken:params.accessToken,machineId:params.machineId,teamId:params.teamId,version:params.version};
      this.#client=this.#factory(this.#credentials);return {connected:true};
    }
    if(method==='logout'){++this.#authGeneration;this.#watch?.abort();this.#watch=undefined;this.#client=undefined;this.#credentials=undefined;return {};}
    if(!this.#client)throw new Error('NOT_CONNECTED');
    if(method==='list')return await this.#client.listBots();
    if(method==='runtime')return await this.#client.getRuntimeSettings();
    if(method==='statuses')return await this.#client.listStatuses(Array.isArray(params.agentIds)?params.agentIds:[]);
    if(method==='unwatch'){this.#watch?.abort();this.#watch=undefined;return {};}
    if(method==='watch'){
      this.#watch?.abort();const control=new AbortController();this.#watch=control;
      const botId=params.botId,sessionId=params.sessionId??'',subscriptionId=params.subscriptionId??'';
      void(async()=>{
        try{for await(const event of this.#client.watchBot({botId,sessionId,resumeFrom:params.resumeFrom,signal:control.signal}))if(!control.signal.aborted)this.#emit({event:'bot.event',data:{botId,sessionId,subscriptionId,event}});
          if(!control.signal.aborted)this.#emit({event:'stream.closed',data:{botId,sessionId,subscriptionId}});
        }catch(error){if(!control.signal.aborted)this.#emit({event:'stream.error',data:{botId,sessionId,subscriptionId,code:publicError(error)}});}
      })();return {watching:true};
    }
    if(method==='send'){
      if(this.#sending)throw new Error('SEND_IN_PROGRESS');
      ++this.#sending;
      const client=this.#client,credentials={...this.#credentials};
      try{
      const files=params.files??[];
      if(!Array.isArray(files)||files.length>6||files.some(path=>typeof path!=='string'||!path.startsWith('/')))throw new Error('ATTACHMENT_INPUT_INVALID');
      // Validate the entire selection before any upload. No send occurs until all uploads complete.
      for(const path of files){const file=await stat(path);if(!file.isFile()||file.size<1||file.size>4*1024*1024)throw new Error('ATTACHMENT_INPUT_INVALID');}
      const attachmentPaths=[],attachmentNames=[];
      for(const path of files){
        const filename=basename(path),bytes=await readFile(path);
        const alias=await uploadAttachment({...credentials,agent:{agentId:params.botId,viewerSessionId:params.sessionId??''},filename,bytes,onStep:step=>this.#emit({event:'upload.progress',data:{botId:params.botId,name:step.name}})});
        attachmentPaths.push(alias);attachmentNames.push(filename);
      }
      return await client.sendMessage({botId:params.botId,sessionId:params.sessionId??'',text:params.text?.trim()||(files.length?'请阅读这些附件。':''),messageId:params.messageId,attachmentPaths,attachmentNames});
      }finally{--this.#sending;}
    }
    throw new Error('METHOD_UNKNOWN');
  }
}

export function publicError(error){
  const code=error?.code??error?.message;
  return typeof code==='string'&&/^[A-Z][A-Z0-9_]{1,70}$/.test(code)?code:'BRIDGE_REQUEST_FAILED';
}
