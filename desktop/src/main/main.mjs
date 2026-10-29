import {app,BrowserWindow,ipcMain,utilityProcess,safeStorage,shell,dialog,nativeTheme,Menu,Notification} from 'electron';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {RpcClient} from './rpc.mjs';
import {CredentialVault} from './credentials.mjs';
import {NativeCompanion} from './companion.mjs';
import {existsSync,mkdtempSync} from 'node:fs';
import {homedir} from 'node:os';
import {ShareMenu} from './share-menu.mjs';
import {captureMenuIcons} from './menu-icons.mjs';
import {MenuReconciler} from '../share/reconciler.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const smoke=process.argv.includes('--smoke-test');
const preview=smoke||process.argv.includes('--preview');
const backgroundShare=process.argv.includes('--share-intake');
let window,worker,rpc,vault,companion,shareMenu,menuReconciler,temporaryRoot,quitting=false,accountBusy=false;
if(preview){temporaryRoot=mkdtempSync(join(tmpdir(),'grok-anywhere-preview-'));app.setPath('userData',temporaryRoot);app.setPath('sessionData',temporaryRoot);}
let latestState={},hostIssue=null;
const pendingSharedComposers=new Set();let openingSharedComposer=false;
const zh=app.getLocale?.().startsWith('zh');
const notify=(event,data)=>{if(window&&!window.isDestroyed())window.webContents.send('anywhere:event',{event,data});};
const publicState=()=>({...latestState,host:{platform:process.platform,locale:app.getLocale(),companion:!!companion?.ready,preview,issue:hostIssue,menu:shareMenu?.status??{available:false,needsUpdate:true,registered:0}}});
const update=()=>notify('state',publicState());
const issue=code=>{hostIssue=code;update();};
const errorCode=error=>/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.message??'')?error.message:'OPERATION_FAILED';

async function openComposer(botId,receipt){
  if(latestState.accountBusy)throw new Error('ACCOUNT_BUSY');
  if(receipt&&(receipt.accountId!==latestState.account?.id||receipt.botId!==botId))throw new Error('RECEIPT_SCOPE_MISMATCH');
  if(!companion?.ready)throw new Error('NATIVE_COMPOSER_UNAVAILABLE');
  const bot=latestState.bots?.find(b=>b.id===botId);if(!bot)throw new Error('BOT_NOT_FOUND');
  return companion.call('composer.open',{botId,receipt,accountId:latestState.account?.id});
}
async function intake(botId,files){
  if(!Array.isArray(files)||files.length>100||files.some(p=>typeof p!=='string'))throw new Error('ATTACHMENT_INVALID');
  const item=await rpc.call('receive',{botId,source:'drop',files});
  if(item.mode==='compose')await openComposer(botId,item);
  return {id:item.id};
}
async function flushSharedComposers(){
 if(openingSharedComposer||!companion?.ready||latestState.accountBusy)return;
 openingSharedComposer=true;
 try{for(const id of pendingSharedComposers){
  pendingSharedComposers.delete(id);
  try{const item=await rpc.call('composer',{id});await openComposer(item.botId,item);}catch(error){if(errorCode(error)!=='RECEIPT_NOT_SENDABLE'&&errorCode(error)!=='RECEIPT_NOT_FOUND')issue(errorCode(error));}
 }}finally{openingSharedComposer=false;}
}
async function accountAction(method){
  if(preview)throw new Error('PREVIEW_ONLY');
  if(accountBusy)throw new Error('ACCOUNT_BUSY');accountBusy=true;
  try{
    const result=await rpc.call(method,{},600000);
    await vault.save(result.credentials);latestState=result.state;hostIssue=null;update();
    void rpc.call('resume').catch(error=>issue(errorCode(error)));
    return publicState();
  }finally{accountBusy=false;}
}
async function nativeRequest(method,p){
  switch(method){
    case 'list':return {bots:latestState.bots,truncated:false};
    case 'runtime':return {mainAgentId:latestState.runtime?.mainAgentId??null};
    case 'statuses':return {statuses:latestState.runtime?.statuses??[]};
    case 'status':return {connected:latestState.connected,sending:latestState.backgroundSending||latestState.inbox?.some(row=>['uploading','sending'].includes(row.phase))||false};
    case 'unwatch':return {};
    case 'resolve':{
      for(const item of latestState.inbox.filter(row=>row.botId===p.botId&&row.status==='unconfirmed'&&!row.holdResolved))await rpc.call('resolve',{id:item.id});
      return {};
    }
    case 'watch':return rpc.call('watch',{botId:p.botId,sessionId:p.sessionId});
    case 'send':{
      if(preview)throw new Error('PREVIEW_ONLY');
      let id=p.receiptId;
      if(id){const receipt=await rpc.call('composer',{id});if(receipt.botId!==p.botId)throw new Error('RECEIPT_SCOPE_MISMATCH');}
      else{id=(await rpc.call('receive',{botId:p.botId,source:'drop',manual:true,text:p.text,files:p.files})).id;}
      const result=await rpc.call('submit',{id,text:p.text,files:p.files},0);
      if(result.status!=='sent')throw new Error(result.status==='unconfirmed'?'SEND_UNCONFIRMED':result.error??'SEND_FAILED');
      return result;
    }
    default:throw new Error('METHOD_UNKNOWN');
  }
}
async function startCompanion(){
  if(process.platform!=='darwin')return;
  const executable=app.isPackaged?join(process.resourcesPath,'native/GrokBotCompanion.app/Contents/MacOS/TouchBarBot'):join(here,'../../native/GrokBotCompanion.app/Contents/MacOS/TouchBarBot');
  if(!existsSync(executable))return;
  companion=new NativeCompanion({executable,avatarRoot:app.isPackaged?join(process.resourcesPath,'native/avatar'):join(here,'../../out/native-avatar'),smoke,onRequest:nativeRequest,onEvent:message=>{
    if(message.event==='library.open'){window?.show();window?.focus();}
    if(message.event==='exit'){issue('NATIVE_COMPOSER_UNAVAILABLE');}
  }});
  try{await companion.start();await companion.call('state',latestState);update();void flushSharedComposers();}catch{companion.stop();companion=null;issue('NATIVE_COMPOSER_UNAVAILABLE');}
}
async function dispatch(method,p){
  switch(method){
    case 'state':return publicState();
    case 'login':return accountAction('login');
    case 'desktopLogin':return accountAction('desktopLogin');
    case 'logout':{
      if(accountBusy)throw new Error('ACCOUNT_BUSY');
      const state=await rpc.call('logout');await vault.remove();latestState=state;await companion?.call('state',state);update();return publicState();
    }
    case 'refresh':await rpc.call('refresh');return publicState();
    case 'configure':return rpc.call('configure',{botId:p.botId,patch:p.patch});
    case 'updateMenu':{
      if(!shareMenu||preview)throw new Error('MENU_UNAVAILABLE');
      menuReconciler.request(latestState);await menuReconciler.flush({force:true});return shareMenu.status;
    }
    case 'theme':nativeTheme.themeSource=p.theme;return rpc.call('theme',{theme:p.theme});
    case 'compose':return openComposer(p.botId);
    case 'openReceipt':{const item=await rpc.call('composer',{id:p.id});return openComposer(item.botId,item);}
    case 'retry':if(preview)throw new Error('PREVIEW_ONLY');return rpc.call('retry',{id:p.id});
    case 'resolve':return rpc.call('resolve',{id:p.id});
    case 'chooseFiles':{
      const result=await dialog.showOpenDialog(window,{properties:['openFile','multiSelections']});
      return result.canceled?null:intake(p.botId,result.filePaths);
    }
    case 'dropFiles':return intake(p.botId,p.files);
    default:throw new Error('METHOD_UNKNOWN');
  }
}
function serviceEvent(message){
  if(message.event==='state'){
    latestState=message.data;update();
    if(menuReconciler)menuReconciler.request(latestState);
    if(companion?.ready)void companion.call('state',latestState).catch(()=>{});
    if(pendingSharedComposers.size)void flushSharedComposers();
  }
  if(message.event==='login.url'){
    try{const url=new URL(message.data.url);if(url.origin!=='https://cursor.com'||url.pathname!=='/loginDeepControl')throw new Error();void shell.openExternal(url.href).catch(()=>issue('BROWSER_OPEN_FAILED'));}catch{issue('LOGIN_URL_INVALID');}
  }
  if(message.event==='auth.expired'){hostIssue='LOGIN_REQUIRED';void vault.remove().catch(()=>{});update();}
  if(message.event==='reply'&&!preview&&Notification.isSupported())new Notification({title:message.data.name||'Grok Bot',body:zh?'收到新回复':'New reply'}).show();
  if(message.event==='share.received'&&message.data.mode==='compose'){
    pendingSharedComposers.add(message.data.id);void flushSharedComposers();
  }
  if(message.event==='share.error')issue('SHARE_IMPORT_FAILED');
}
async function createWindow(){
  window=new BrowserWindow({width:1080,height:760,minWidth:780,minHeight:580,title:'Grok Bot Anywhere',show:false,
    titleBarStyle:process.platform==='darwin'?'hiddenInset':'default',backgroundColor:'#f4f3f0',
    vibrancy:process.platform==='darwin'?'under-window':undefined,backgroundMaterial:process.platform==='win32'?'acrylic':undefined,
    webPreferences:{preload:join(here,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  if(smoke)window.webContents.on('console-message',details=>{if(details.level==='error')console.error('Renderer:',details.message);});
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();window.hide();}});
  window.once('ready-to-show',()=>{if(!smoke&&!backgroundShare)window.show();});
  await window.loadFile(join(here,'../../out/index.html'));
}
app.setName('Grok Bot Anywhere');
if(!app.requestSingleInstanceLock()&&!smoke){app.quit();}else{
 app.on('second-instance',(_event,args)=>{if(!args.includes('--share-intake')){window?.show();window?.focus();}});
 app.whenReady().then(async()=>{
  vault=new CredentialVault(join(app.getPath('userData'),'account.enc'),safeStorage);
  if(!preview&&process.platform==='darwin'&&app.isPackaged){
    const template=join(process.resourcesPath,'native/GrokBotMenuHost.app');
    if(existsSync(template)){
      shareMenu=new ShareMenu({root:join(app.getPath('userData'),'ShareInbox'),template,applicationsRoot:join(homedir(),'Applications'),applicationPath:app.getAppPath().split('/Contents/Resources/')[0],locale:app.getLocale(),onChange:()=>{if(!shareMenu.status.needsUpdate&&hostIssue==='MENU_UPDATE_FAILED')hostIssue=null;update();}});
      await shareMenu.initialize();
      menuReconciler=new MenuReconciler({
        sync:state=>shareMenu.sync(state),publish:state=>shareMenu.sync(state),needsUpdate:()=>shareMenu.status.needsUpdate,
        update:async(state,isCurrent)=>{const icons=await captureMenuIcons(state,join(here,'../../out/native-avatar/index.html'));if(!isCurrent())return;return shareMenu.update(state,icons,{isCurrent});},
        onError:()=>{shareMenu.status.error='MENU_UPDATE_FAILED';issue('MENU_UPDATE_FAILED');}
      });
    }
  }
  worker=utilityProcess.fork(join(here,'../service/worker.mjs'),[],{serviceName:'Grok Bot Service',stdio:'pipe'});
  rpc=new RpcClient({send:message=>worker.postMessage(message),onEvent:serviceEvent});
  worker.on('message',message=>rpc.receive(message));worker.on('exit',()=>{rpc.close();issue('SERVICE_EXITED');});
  worker.stderr?.on('data',bytes=>{if(smoke)process.stderr.write(bytes);});
  latestState=await rpc.call('initialize',{root:join(app.getPath('userData'),'inbox'),shareRoot:shareMenu?.root,preview,locale:app.getLocale()});
  if(menuReconciler)menuReconciler.request(latestState);
  nativeTheme.themeSource=latestState.theme;
  ipcMain.handle('anywhere:call',async(event,method,params)=>{
    if(event.sender!==window?.webContents||event.senderFrame!==window.webContents.mainFrame)return {error:'UNTRUSTED_SENDER'};
    try{return {value:await dispatch(method,params??{})};}catch(error){return {error:errorCode(error)};}
  });
  const menu=Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'quit'}]}]:[]),
    {label:zh?'文件':'File',submenu:[{label:zh?'显示主窗口':'Show window',click:()=>window?.show()},...(process.platform!=='darwin'?[{role:'quit'}]:[])]},
    {role:'editMenu'},{role:'windowMenu'}]);Menu.setApplicationMenu(menu);
  await createWindow();
  await startCompanion();
  if(smoke){
    const result=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{if(document.documentElement.dataset.ready==='true')resolve({title:document.title,headings:[...document.querySelectorAll('h1')].map(e=>e.textContent)});else if(Date.now()-start>10000)reject(new Error('RENDERER_NOT_READY'));else setTimeout(tick,50);};tick();})`);
    const artifactRoot=app.isPackaged?join(temporaryRoot,'artifacts'):join(here,'../../artifacts');await mkdir(artifactRoot,{recursive:true});
    const avatarStats=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{const nodes=[...document.querySelectorAll('.avatar')];if(nodes.length&&nodes.every(n=>n.shadowRoot?.querySelector('svg')))resolve({avatarCount:nodes.length});else if(Date.now()-start>8000)reject(new Error('AVATARS_NOT_PAINTED'));else setTimeout(check,40);};check();})`);
    await writeFile(join(artifactRoot,'bots.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`window.anywhere.theme('dark')`);
    await writeFile(join(artifactRoot,'bots-dark.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`window.anywhere.theme('light')`);
    const botId=latestState.bots[0].id;
    await rpc.call('configure',{botId,patch:{enabled:true,sources:{drop:true}}});
    const fixture=join(temporaryRoot,'forward.zip');await writeFile(fixture,Buffer.alloc(5*1024*1024,7));
    const receipt=await rpc.call('receive',{botId,source:'drop',files:[fixture],text:'Smoke context'});
    if(receipt.status!=='needs-input'||receipt.files[0].bytes!==5*1024*1024)throw new Error('LOCAL_INTAKE_FAILED');
    if(companion?.ready){await openComposer(botId,receipt);await companion.call('composer.hide',{});}
    await window.webContents.executeJavaScript(`document.querySelectorAll('.nav-button')[2].click()`);
    await writeFile(join(artifactRoot,'settings.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelectorAll('.nav-button')[1].click()`);
    await writeFile(join(artifactRoot,'inbox.png'),(await window.webContents.capturePage()).toPNG());
    const controls=await window.webContents.executeJavaScript(`({nativeTextAreaCount:document.querySelectorAll('textarea').length,receiptCount:document.querySelectorAll('article').length})`);
    if(controls.nativeTextAreaCount!==0||controls.receiptCount!==1)throw new Error('SHARED_UI_FAILED');
    console.log(JSON.stringify({smoke:'passed',...result,...controls,...avatarStats,nativeCompanion:!!companion?.ready,node:process.versions.node}));
    quitting=true;app.quit();return;
  }
  if(!preview){
    try{const credentials=await vault.load();if(credentials){const result=await rpc.call('connect',credentials);latestState=result.state;update();void rpc.call('resume').catch(error=>issue(errorCode(error)));}}
    catch(error){issue(errorCode(error));}
  }
 }).catch(error=>{console.error(errorCode(error));app.exit(1);});
}
app.on('activate',()=>{window?.show();window?.focus();});
app.on('window-all-closed',()=>{if(smoke)app.quit();});
app.on('before-quit',()=>{quitting=true;menuReconciler?.close();companion?.stop();worker?.kill();rpc?.close();});
// Preview data uses an OS temporary directory. Do not delete Chromium's cache
// while its helper processes are still shutting down.
