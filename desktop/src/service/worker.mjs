import {InboxStore} from './store.mjs';
import {AccountManager} from './accounts.mjs';
import {uploadFile} from './upload.mjs';
import * as sdk from 'grok-bot-sdk';
import {normalizeBot} from 'grok-bot-sdk';
import {ShareInbox} from './share-inbox.mjs';

const port=process.parentPort;
let store,manager,shareInbox,shareTimer;
const emit=message=>port.postMessage(message);
const safeError=error=>/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code??error?.message??'')?error.code??error.message:'SERVICE_REQUEST_FAILED';
port.on('message',async({data:request})=>{
  if(typeof request?.id!=='string')return;
  try{
    const p=request.params??{};let result;
    if(request.method==='initialize'){
      if(manager)throw new Error('ALREADY_INITIALIZED');
      store=new InboxStore(p.root);
      let sdkImpl=sdk,accounts=[];
      if(p.preview){
        const bots=[['研究伙伴','Research companion','cloud','brown'],['代码助手','Code assistant','squircle','blue'],['灵感收集员','Idea collector','pebble','violet'],['写作搭档','Writing partner','tablet','green']].map(([cn,en,avatarShape,avatarColor],index)=>normalizeBot({agentId:`00000000-0000-4000-8000-00000000000${index}`,name:p.locale?.startsWith('zh')?cn:en,avatarShape,avatarColor}));
        sdkImpl={GrokBotClient:class{async getMe(){return {authId:'preview',name:p.locale?.startsWith('zh')?'示例工作空间':'Sample workspace'};}async listBots(){return {bots,truncated:false};}async getRuntimeSettings(){return {mainAgentId:null,pinnedAgentIds:[],sections:[]};}async listStatuses(){return {statuses:[]};}async sendMessage(){throw new Error('PREVIEW_ONLY');}}};
        accounts=[{id:'preview',credentials:{accessToken:'preview-not-a-token'}}];
      }else{
        accounts=Array.isArray(p.accounts)?p.accounts:[];
      }
      manager=new AccountManager({store,sdk:sdkImpl,upload:uploadFile,onEvent:emit});
      await manager.initialize({accounts});
      if(p.shareRoot&&!p.preview){
        shareInbox=new ShareInbox({
          root:p.shareRoot,
          sessionFor:accountId=>manager.isChecked(accountId)?manager.session(accountId):null,
          onReceipt:item=>emit({event:'share.received',data:{id:item.id,accountId:item.accountId,botId:item.botId,mode:item.mode,status:item.status,batchId:typeof item.sourceId==='string'&&item.sourceId.startsWith('wechat:')?item.sourceId.slice(7):''}}),
          onPreparing:data=>emit({event:'share.preparing',data}),
          onError:code=>emit({event:'share.error',data:{code}})
        });
        await shareInbox.initialize();
        shareTimer=setInterval(()=>void shareInbox.drain().catch(()=>emit({event:'share.error',data:{code:'SHARE_IMPORT_FAILED'}})),250);
      }
      result=manager.snapshot();
    }else{
      if(!manager)throw new Error('NOT_INITIALIZED');
      switch(request.method){
        case 'snapshot':result=manager.snapshot();break;
        case 'login':result=await manager.login();break;
        case 'desktopLogin':result=await manager.desktopLogin();break;
        case 'addAccount':result=await manager.addAccount(p);break;
        case 'connect':result=await manager.connectAccount(p.credentials??p);break;
        case 'removeAccount':result=await manager.removeAccount(p.accountId);break;
        case 'setAccountChecked':result=manager.setAccountChecked(p.accountId,p.checked);break;
        case 'logout':result=await manager.logout();break;
        case 'refresh':result=await manager.refresh(p);break;
        case 'duplicateBot':result=await manager.duplicateBot(p);break;
        case 'updateBotAvatar':result=await manager.updateBotAvatar(p);break;
        case 'configure':result=manager.configure(p);break;
        case 'disableAllReceive':result=manager.disableAllReceive(p);break;
        case 'receive':result=await manager.receive(p);break;
        case 'submit':result=await manager.submit(p.id,p.text,p.files);break;
        case 'submitAsync':result=manager.submitAsync(p.id,p.text,p.files);break;
        case 'retry':result=await manager.retry(p.id);break;
        case 'resolve':result=manager.resolve(p.id);break;
        case 'composer':result=manager.composer(p.id);break;
        case 'receipt':result=manager.get(p.id);break;
        case 'dismissComposer':result=await manager.dismissComposer(p.id);break;
        case 'resume':await manager.resume();result=manager.snapshot();break;
        case 'theme':result=manager.setTheme(p.theme);break;
        case 'setShortcut':result=manager.setShortcut(p.slot,p.accelerator);break;
        case 'watch':manager.watch({accountId:p.accountId,botId:p.botId,sessionId:p.sessionId});result={watching:true};break;
        case 'shutdown':clearInterval(shareTimer);manager.close();store.close();result={};break;
        default:throw new Error('METHOD_UNKNOWN');
      }
    }
    emit({id:request.id,result});
  }catch(error){emit({id:request.id,error:{code:safeError(error)}});}
});
