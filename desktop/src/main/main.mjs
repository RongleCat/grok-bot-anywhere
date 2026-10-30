import {app,BrowserWindow,ipcMain,utilityProcess,safeStorage,shell,dialog,nativeTheme,Menu,Notification,globalShortcut,screen} from 'electron';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {RpcClient} from './rpc.mjs';
import {CredentialVault} from './credentials.mjs';
import {NativeCompanion} from './companion.mjs';
import {existsSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {ShareMenu} from './share-menu.mjs';
import {captureMenuIcons} from './menu-icons.mjs';
import {MenuReconciler} from '../share/reconciler.mjs';
import {menuHostTemplate,sharingApplicationPath} from '../share/host-path.mjs';
import {shareHandoff} from '../share/handoff.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const smoke=process.argv.includes('--smoke-test');
const preview=smoke||process.argv.includes('--preview');
const backgroundShare=process.argv.includes('--share-intake');
let window,floatWindow,avatarWindow,pickerWindow,worker,rpc,vault,companion,shareMenu,menuReconciler,temporaryRoot,quitting=false,accountBusy=false;
if(preview){temporaryRoot=mkdtempSync(join(tmpdir(),'grok-anywhere-preview-'));app.setPath('userData',temporaryRoot);app.setPath('sessionData',temporaryRoot);}
let latestState={},hostIssue=null,windowMaterial='none',activeBotId='',pendingFloat=null,suspendFloatDismiss=false,ipcSender=null;
let composerPrefs={keepAfterSend:true,dismissOnOutside:true},floatShownAt=0,pickerOpen=false,pickerSize={width:760,height:188};
const pendingSharedComposers=new Set();let openingSharedComposer=false,shortcutsSuppressed=false,activeShortcut='';
const zh=app.getLocale?.().startsWith('zh');
const notify=(event,data)=>{const payload={event,data};for(const target of [window,floatWindow,avatarWindow,pickerWindow])if(target&&!target.isDestroyed())target.webContents.send('anywhere:event',payload);};
const publicState=()=>({...latestState,activeBotId,composerPrefs,host:{platform:process.platform,locale:app.getLocale(),material:windowMaterial,companion:!!companion?.ready,preview,issue:hostIssue,menu:shareMenu?.status??{available:false,needsUpdate:true,registered:0}}});
const update=()=>notify('state',publicState());
const issue=code=>{hostIssue=code;update();};
const errorCode=error=>/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.message??'')?error.message:'OPERATION_FAILED';

function paintChrome(){if(!window||window.isDestroyed()||process.platform!=='darwin')return;window.setBackgroundColor('#00000000');}
function loadComposerPrefs(){
  try{const parsed=JSON.parse(readFileSync(join(app.getPath('userData'),'composer-prefs.json'),'utf8'));composerPrefs={keepAfterSend:parsed.keepAfterSend!==false,dismissOnOutside:parsed.dismissOnOutside!==false};}
  catch{composerPrefs={keepAfterSend:true,dismissOnOutside:true};}
}
function saveComposerPrefs(){try{writeFileSync(join(app.getPath('userData'),'composer-prefs.json'),JSON.stringify(composerPrefs));}catch{}}
function rankedBots(){
  const bots=latestState.bots??[],recipients=latestState.recipients??[];
  const order=id=>recipients.find(item=>item.botId===id)?.order??0;
  return bots.map((bot,index)=>({bot,index,order:order(bot.id)})).sort((a,b)=>a.order-b.order||a.index-b.index).map(item=>item.bot);
}
function shortcutBot(){
  const bots=rankedBots(),recipient=id=>(latestState.recipients??[]).find(item=>item.botId===id);
  const preferred=bots.filter(bot=>{const row=recipient(bot.id);return row?.enabled&&row.sources?.shortcuts;});
  if(activeBotId&&preferred.some(bot=>bot.id===activeBotId))return preferred.find(bot=>bot.id===activeBotId);
  return preferred[0]??bots.find(bot=>bot.id===activeBotId)??bots[0]??null;
}
function layoutExtras(){
  if(!floatWindow||floatWindow.isDestroyed()||!floatWindow.isVisible())return;
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const card=floatWindow.getBounds();
  const avatar=88;
  if(avatarWindow&&!avatarWindow.isDestroyed()){
    avatarWindow.setBounds({x:Math.round(card.x+(card.width-avatar)/2),y:Math.round(card.y-avatar-6),width:avatar,height:avatar},false);
    if(!avatarWindow.isVisible())avatarWindow.showInactive();
  }
  if(!pickerWindow||pickerWindow.isDestroyed())return;
  if(!pickerOpen){if(pickerWindow.isVisible())pickerWindow.hide();return;}
  const width=Math.min(Math.max(320,pickerSize.width),area.width-16);
  const height=Math.min(Math.max(80,pickerSize.height),Math.max(80,card.y-area.y-avatar-24));
  pickerWindow.setBounds({x:Math.round(area.x+(area.width-width)/2),y:Math.round(card.y-avatar-14-height),width,height},false);
  if(!pickerWindow.isVisible())pickerWindow.showInactive();
}
function placeFloat(width,height){
  if(!floatWindow||floatWindow.isDestroyed())return;
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const w=Math.min(Math.max(300,Math.round(width)||368),area.width-16);
  const h=Math.min(Math.max(56,Math.round(height)||96),area.height-24);
  floatWindow.setBounds({x:Math.round(area.x+(area.width-w)/2),y:Math.round(area.y+area.height-h-8),width:w,height:h},false);
  layoutExtras();
}
function placePicker(width,height){
  pickerSize={width:Math.round(width)||760,height:Math.round(height)||188};
  layoutExtras();
}
function hideFloat(){
  pickerOpen=false;
  for(const extra of [avatarWindow,pickerWindow])if(extra&&!extra.isDestroyed()&&extra.isVisible())extra.hide();
  if(!floatWindow||floatWindow.isDestroyed()||!floatWindow.isVisible())return;
  floatWindow.hide();
}
function wireFloat(target,label){
  target.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  target.webContents.on('will-navigate',event=>event.preventDefault());
  target.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  if(smoke)target.webContents.on('console-message',details=>{if(details.level==='error')console.error(`${label}:`,details.message);});
}
async function ensureFloat(){
  if(floatWindow&&!floatWindow.isDestroyed())return floatWindow;
  const mac=process.platform==='darwin';
  const common={show:false,frame:false,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,skipTaskbar:true,backgroundColor:'#00000000',excludedFromShownWindowsMenu:true,webPreferences:{preload:join(here,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}};
  floatWindow=new BrowserWindow({...common,width:368,height:120,transparent:mac,hasShadow:true,roundedCorners:true,acceptFirstMouse:true,title:'Grok Bot Anywhere',...(mac?{vibrancy:'popover',visualEffectState:'active'}:{})});
  avatarWindow=new BrowserWindow({...common,width:88,height:88,transparent:true,hasShadow:false,focusable:false,roundedCorners:false});
  pickerWindow=new BrowserWindow({...common,width:760,height:188,transparent:mac,hasShadow:true,roundedCorners:true,acceptFirstMouse:true,...(mac?{vibrancy:'popover',visualEffectState:'active'}:{})});
  for(const target of [floatWindow,avatarWindow,pickerWindow]){if(mac)target.setAlwaysOnTop(true,'floating');else target.setAlwaysOnTop(true);try{target.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{target.setVisibleOnAllWorkspaces(true);}}
  if(!mac){for(const target of [floatWindow,pickerWindow]){try{target.setBackgroundMaterial('acrylic');}catch{target.setBackgroundColor('#f4f4f4');}}}
  avatarWindow.setIgnoreMouseEvents(true);
  wireFloat(floatWindow,'Composer');wireFloat(avatarWindow,'Avatar');wireFloat(pickerWindow,'Picker');
  floatWindow.on('blur',()=>{setTimeout(()=>{if(suspendFloatDismiss||!composerPrefs.dismissOnOutside||Date.now()-floatShownAt<500)return;const focused=BrowserWindow.getFocusedWindow();if(floatWindow?.isFocused()||focused===pickerWindow||focused===avatarWindow)return;hideFloat();},120);});
  floatWindow.on('closed',()=>{floatWindow=null;});
  avatarWindow.on('closed',()=>{avatarWindow=null;});
  pickerWindow.on('closed',()=>{pickerWindow=null;});
  await Promise.all([
    floatWindow.loadFile(join(here,'../../out/composer.html')),
    avatarWindow.loadFile(join(here,'../../out/composer.html'),{query:{part:'avatar'}}),
    pickerWindow.loadFile(join(here,'../../out/composer.html'),{query:{part:'picker'}})
  ]);
  return floatWindow;
}
function applyShortcuts(map){
  if(smoke||preview||shortcutsSuppressed)return;
  const accelerator=typeof map?.compose==='string'?map.compose:'';
  if(accelerator===activeShortcut)return;
  if(activeShortcut){globalShortcut.unregister(activeShortcut);activeShortcut='';}
  if(!accelerator){if(hostIssue==='SHORTCUT_UNAVAILABLE'){hostIssue=null;update();}return;}
  let registered=false;
  try{registered=globalShortcut.register(accelerator,()=>{const bot=shortcutBot();if(!bot){window?.show();window?.focus();return;}void openComposer(bot.id).catch(error=>issue(errorCode(error)));});}catch{registered=false;}
  if(!registered){issue('SHORTCUT_UNAVAILABLE');return;}
  activeShortcut=accelerator;
  if(hostIssue==='SHORTCUT_UNAVAILABLE'){hostIssue=null;update();}
}
async function openComposer(botId,receipt){
  if(latestState.accountBusy)throw new Error('ACCOUNT_BUSY');
  if(receipt&&(receipt.accountId!==latestState.account?.id||receipt.botId!==botId))throw new Error('RECEIPT_SCOPE_MISMATCH');
  const bot=latestState.bots?.find(item=>item.id===botId);if(!bot)throw new Error('BOT_NOT_FOUND');
  activeBotId=botId;
  pendingFloat=receipt?{id:receipt.id,botId,text:receipt.text??'',title:receipt.title??'',files:(receipt.files??[]).map(({name,bytes})=>({name,bytes})),botName:receipt.botName??bot.name}:{botId,focus:true};
  const float=await ensureFloat();
  placeFloat(368,110);
  floatShownAt=Date.now();
  float.setIgnoreMouseEvents(false);
  float.show();float.focus();
  layoutExtras();
  notify('composer',pendingFloat);
  return {ok:true};
}
async function intake(botId,files){
  if(!Array.isArray(files)||files.length>100||files.some(p=>typeof p!=='string'))throw new Error('ATTACHMENT_INVALID');
  const item=await rpc.call('receive',{botId,source:'drop',files});
  if(item.mode==='compose')await openComposer(botId,item);
  return {id:item.id};
}
async function presentShare(id){
  try{const item=await rpc.call('composer',{id});await openComposer(item.botId,item);}
  catch(error){if(errorCode(error)!=='RECEIPT_NOT_SENDABLE'&&errorCode(error)!=='RECEIPT_NOT_FOUND')issue(errorCode(error));}
}
function presentPendingComposer(){
  const pending=(latestState.inbox??[]).filter(item=>item.status==='needs-input'&&item.phase==='ready'&&shareHandoff({mode:item.mode})==='composer');
  const item=pending.sort((a,b)=>a.createdAt-b.createdAt).at(-1);
  if(item)void presentShare(item.id);
}
async function sendDraft(botId,text,files,receiptId){
  if(preview)throw new Error('PREVIEW_ONLY');
  if(typeof text!=='string'||text.length>2_000_000)throw new Error('MESSAGE_INVALID');
  if(files!=null&&(!Array.isArray(files)||files.length>100||files.some(path=>typeof path!=='string'||!path)))throw new Error('ATTACHMENT_INVALID');
  const extra=files??[];
  if(receiptId){
    const item=await rpc.call('composer',{id:receiptId});
    if(item.botId!==botId)throw new Error('RECEIPT_SCOPE_MISMATCH');
    const merged=extra.length?[...item.files.map(file=>file.path),...extra]:undefined;
    const result=await rpc.call('submit',{id:receiptId,text,...merged?{files:merged}:{}},0);
    return {id:result.id,status:result.status,error:result.error??null};
  }
  if(!text.trim()&&!extra.length)throw new Error('RECEIPT_EMPTY');
  const created=await rpc.call('receive',{botId,source:'drop',manual:true,text,files:extra});
  const result=await rpc.call('submit',{id:created.id,text,...extra.length?{files:extra}:{}},0);
  return {id:result.id,status:result.status,error:result.error??null};
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
    case 'theme':nativeTheme.themeSource=p.theme;paintChrome();return rpc.call('theme',{theme:p.theme});
    case 'setShortcut':return rpc.call('setShortcut',{slot:p.slot,accelerator:p.accelerator});
    case 'setComposerPrefs':{
      composerPrefs={keepAfterSend:typeof p.keepAfterSend==='boolean'?p.keepAfterSend:composerPrefs.keepAfterSend,dismissOnOutside:typeof p.dismissOnOutside==='boolean'?p.dismissOnOutside:composerPrefs.dismissOnOutside};
      saveComposerPrefs();update();return composerPrefs;
    }
    case 'noteBot':if(typeof p.botId==='string'){activeBotId=p.botId;update();}return {ok:true};
    case 'pendingComposer':return pendingFloat;
    case 'hideComposer':hideFloat();return {ok:true};
    case 'setHit':if(floatWindow&&!floatWindow.isDestroyed())floatWindow.setIgnoreMouseEvents(!p.hit,{forward:true});return {ok:true};
    case 'placeComposer':if(p.regions?.part==='picker')placePicker(p.width,p.height);else placeFloat(p.width,p.height);return {ok:true};
    case 'syncPicker':{
      pickerOpen=!!p.open;
      if(pickerWindow&&!pickerWindow.isDestroyed())pickerWindow.webContents.send('anywhere:event',{event:'picker',data:{open:pickerOpen,index:p.index|0}});
      layoutExtras();return {ok:true};
    }
    case 'pickBot':{
      if(typeof p.botId==='string'&&floatWindow&&!floatWindow.isDestroyed()){floatWindow.webContents.send('anywhere:event',{event:'pick',data:{botId:p.botId}});floatWindow.focus();}
      return {ok:true};
    }
    case 'suppressShortcuts':{
      shortcutsSuppressed=!!p.on;
      if(shortcutsSuppressed){if(activeShortcut){globalShortcut.unregister(activeShortcut);activeShortcut='';}}
      else applyShortcuts(latestState.shortcuts);
      return {ok:true};
    }
    case 'compose':return openComposer(p.botId);
    case 'openReceipt':{const item=await rpc.call('composer',{id:p.id});return openComposer(item.botId,item);}
    case 'sendReceipt':{const item=await rpc.call('composer',{id:p.id});return rpc.call('submit',{id:p.id,text:item.text??''},0);}
    case 'sendDraft':return sendDraft(p.botId,p.text??'',p.files,p.receiptId);
    case 'retry':if(preview)throw new Error('PREVIEW_ONLY');return rpc.call('retry',{id:p.id});
    case 'resolve':return rpc.call('resolve',{id:p.id});
    case 'pickFiles':{
      suspendFloatDismiss=true;
      try{const picked=await dialog.showOpenDialog(ownerWindow(),{properties:['openFile','multiSelections']});return picked.canceled?[]:picked.filePaths;}
      finally{setTimeout(()=>{suspendFloatDismiss=false;},400);}
    }
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
    latestState=message.data;applyShortcuts(latestState.shortcuts);paintChrome();update();
    if(menuReconciler)menuReconciler.request(latestState);
    if(companion?.ready)void companion.call('state',latestState).catch(()=>{});
    if(pendingSharedComposers.size)void flushSharedComposers();
  }
  if(message.event==='login.url'){
    try{const url=new URL(message.data.url);if(url.origin!=='https://cursor.com'||url.pathname!=='/loginDeepControl')throw new Error();void shell.openExternal(url.href).catch(()=>issue('BROWSER_OPEN_FAILED'));}catch{issue('LOGIN_URL_INVALID');}
  }
  if(message.event==='auth.expired'){hostIssue='LOGIN_REQUIRED';void vault.remove().catch(()=>{});update();}
  if(message.event==='reply'&&!preview&&Notification.isSupported())new Notification({title:message.data.name||'Grok Bot',body:zh?'收到新回复':'New reply'}).show();
  if(message.event==='share.received'){
    const action=shareHandoff({mode:message.data.mode});
    if(action==='service'){window?.show();window?.focus();notify('navigate',{page:'inbox'});}
    else void presentShare(message.data.id);
  }
  if(message.event==='share.error')issue('SHARE_IMPORT_FAILED');
}
function ownerWindow(){const owner=ipcSender?BrowserWindow.fromWebContents(ipcSender):null;return owner&&!owner.isDestroyed()?owner:window;}
function trusted(event){const contents=event.sender;if(event.senderFrame!==contents.mainFrame)return false;return [window,floatWindow,avatarWindow,pickerWindow].some(target=>target&&contents===target.webContents);}
async function createWindow(){
  const mac=process.platform==='darwin';
  window=new BrowserWindow({width:800,height:600,minWidth:720,minHeight:520,title:'Grok Bot Anywhere',show:false,
    titleBarStyle:mac?'hiddenInset':'default',backgroundColor:'#00000000',transparent:mac,hasShadow:true,
    ...(mac?{vibrancy:'fullscreen-ui',trafficLightPosition:{x:14,y:18}}:{}),
    webPreferences:{preload:join(here,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
  if(process.platform==='win32'){try{window.setBackgroundMaterial('acrylic');windowMaterial='acrylic';}catch{window.setBackgroundColor('#f4f4f4');windowMaterial='none';}}
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
 app.on('second-instance',()=>{window?.show();window?.focus();});
 app.whenReady().then(async()=>{
  vault=new CredentialVault(join(app.getPath('userData'),'account.enc'),safeStorage);
  if(!preview&&process.platform==='darwin'){
    const template=menuHostTemplate({packaged:app.isPackaged,resourcesPath:process.resourcesPath,devRoot:join(here,'../..')});
    if(existsSync(join(template,'Contents/MacOS/GrokBotMenuHost'))){
      shareMenu=new ShareMenu({root:join(app.getPath('userData'),'ShareInbox'),template,applicationsRoot:join(homedir(),'Applications'),applicationPath:sharingApplicationPath({packaged:app.isPackaged,appPath:app.getAppPath(),execPath:process.execPath}),locale:app.getLocale(),onChange:()=>{if(!shareMenu.status.needsUpdate&&hostIssue==='MENU_UPDATE_FAILED')hostIssue=null;update();}});
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
  loadComposerPrefs();
  latestState=await rpc.call('initialize',{root:join(app.getPath('userData'),'inbox'),shareRoot:shareMenu?.root,preview,locale:app.getLocale()});
  applyShortcuts(latestState.shortcuts);
  if(menuReconciler)menuReconciler.request(latestState);
  nativeTheme.themeSource=latestState.theme;
  ipcMain.handle('anywhere:call',async(event,method,params)=>{
    if(!trusted(event))return {error:'UNTRUSTED_SENDER'};
    ipcSender=event.sender;
    try{return {value:await dispatch(method,params??{})};}catch(error){return {error:errorCode(error)};}
    finally{ipcSender=null;}
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
    await window.webContents.executeJavaScript(`document.querySelectorAll('.nav-button')[2].click()`);
    await writeFile(join(artifactRoot,'settings.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`document.querySelectorAll('.nav-button')[1].click()`);
    await writeFile(join(artifactRoot,'inbox.png'),(await window.webContents.capturePage()).toPNG());
    await openComposer(botId,receipt);
    await floatWindow.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{if(document.querySelector('textarea.composer-input')&&document.querySelector('.float-avatar .avatar'))resolve(true);else if(Date.now()-start>8000)reject(new Error('FLOAT_NOT_READY'));else setTimeout(tick,40);};tick();})`);
    const floatControls=await floatWindow.webContents.executeJavaScript(`({composerCount:document.querySelectorAll('textarea.composer-input').length,avatarCount:document.querySelectorAll('.float-avatar .avatar').length})`);
    if(floatControls.composerCount!==1||floatControls.avatarCount!==1)throw new Error('FLOAT_UI_FAILED');
    hideFloat();
    const controls=await window.webContents.executeJavaScript(`({composerCount:document.querySelectorAll('textarea.composer-input').length,receiptCount:document.querySelectorAll('article').length})`);
    if(controls.composerCount!==0||controls.receiptCount!==1)throw new Error('SHARED_UI_FAILED');
    console.log(JSON.stringify({smoke:'passed',...result,...controls,...avatarStats,nativeCompanion:!!companion?.ready,node:process.versions.node}));
    quitting=true;app.quit();return;
  }
  if(!preview){
    try{const credentials=await vault.load();if(credentials){const result=await rpc.call('connect',credentials);latestState=result.state;applyShortcuts(latestState.shortcuts);update();void rpc.call('resume').catch(error=>issue(errorCode(error)));presentPendingComposer();}}
    catch(error){issue(errorCode(error));}
  }
 }).catch(error=>{console.error(errorCode(error));app.exit(1);});
}
app.on('activate',()=>{window?.show();window?.focus();});
app.on('window-all-closed',()=>{if(smoke)app.quit();});
app.on('before-quit',()=>{quitting=true;if(activeShortcut)globalShortcut.unregister(activeShortcut);menuReconciler?.close();companion?.stop();worker?.kill();rpc?.close();});
// Preview data uses an OS temporary directory. Do not delete Chromium's cache
// while its helper processes are still shutting down.
