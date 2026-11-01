import {app,BrowserWindow,ipcMain,utilityProcess,safeStorage,shell,dialog,nativeTheme,Menu,Notification,globalShortcut,screen,Tray,nativeImage,clipboard,TouchBar} from 'electron';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {dirname,isAbsolute,join} from 'node:path';
import {appendFile,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
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
import {frontmostFiles,prepareExplorerSelection,regularFiles,stopExplorerSelection,warmExplorerSelection} from './selection.mjs';
import {menuEntries} from '../share/model.mjs';
import {matchShareTitles} from '../share/order.mjs';
import {grokBotAgentUrl} from '../grok-link.mjs';
import {disableCli,enableCli,skillBundleDir,writeCliCredential} from './cli-bridge.mjs';
import {applyExplorerRegistry,applyLoginItem,createExplorerBatch,createExplorerSync,explorerLogLine,explorerRegistryOps,explorerRejectNotice,floatingComposerTraits,loginItemStartup,openedAsLoginItem,parseExplorerForward,resolveExplorerForward,shouldApplyLoginItem,touchBarChoice,touchBarPinPayload,trayCommand,trayMenuModel,trimExplorerLog,windowCloseAction} from '../shell/actions.mjs';
import {coalBallIcon,coalBallPng,trayIconImages} from '../shell/coal-ball.mjs';
import {acceptWindowControl,editCommand,mainWindowOptions,maximizedContentInset} from '../shell/window-chrome.mjs';
import {composeLink,deeplinkNotice,parseDeeplink,shortcutSourceAllowed} from '../shell/deeplink.mjs';
import {listedBots} from '../renderer/group-avatar.mjs';

const runProcess=promisify(execFile);

const here=dirname(fileURLToPath(import.meta.url));
const smoke=process.argv.includes('--smoke-test');
const preview=smoke||process.argv.includes('--preview');
const backgroundShare=process.argv.includes('--share-intake');
const quietLaunch=backgroundShare||process.argv.includes('--explorer-forward')||process.argv.some(arg=>String(arg).includes('grokbotanywhere://'));
let window,floatWindow,avatarWindow,pickerWindow,worker,rpc,vault,companion,shareMenu,menuReconciler,temporaryRoot,tray,quitting=false,accountBusy=false;
let openAtLogin=false,loginItemKnown=false,explorerMenu=true,explorerSettled=false,touchBarPinned=false,touchBarSelection='',touchBarKey='';
if(preview){temporaryRoot=mkdtempSync(join(tmpdir(),'grok-anywhere-preview-'));app.setPath('userData',temporaryRoot);app.setPath('sessionData',temporaryRoot);}
let latestState={},hostIssue=null,windowMaterial='none',activeBotId='',pendingFloat=null,suspendFloatDismiss=false,ipcSender=null;
let composerPrefs={keepAfterSend:true,dismissOnOutside:true},floatShownAt=0,pickerOpen=false,pickerSize={width:760,height:188},composeGeneration=0;
let cliStatus={enabled:false,command:'',skillsPath:'',claudeLinked:false,credential:false,pathSnippet:false,error:''};
const pendingSharedComposers=new Set();let openingSharedComposer=false,shortcutsSuppressed=false;
const pendingLinks=[];let deeplinkReady=false,deeplinkChain=Promise.resolve();
const registeredShortcuts=new Map();
const zh=app.getLocale?.().startsWith('zh');
const notify=(event,data)=>{const payload={event,data};for(const target of [window,floatWindow,avatarWindow,pickerWindow])if(target&&!target.isDestroyed())target.webContents.send('anywhere:event',payload);};
const cliPublic=()=>({enabled:!!cliStatus.enabled,command:cliStatus.command??'',skillsPath:cliStatus.skillsPath??'',claudeLinked:!!cliStatus.claudeLinked,credential:!!cliStatus.credential,error:cliStatus.error??''});
const publicState=()=>({...latestState,activeBotId,composerPrefs,host:{platform:process.platform,locale:app.getLocale(),material:windowMaterial,companion:!!companion?.ready,preview,issue:hostIssue,openAtLogin,explorerMenu,touchBarPinned,menu:shareMenu?.status??{available:false,needsUpdate:true,registered:0},cli:cliPublic()}});
const update=()=>{notify('state',publicState());refreshTouchBar();};
const issue=code=>{if(!code||code==='ACCOUNT_BUSY')return;hostIssue=code;update();};
const errorCode=error=>/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.message??'')?error.message:'OPERATION_FAILED';

function paintChrome(){if(!window||window.isDestroyed()||process.platform!=='darwin')return;window.setBackgroundColor('#00000000');}
nativeTheme.on('updated',paintChrome);
function loadComposerPrefs(){
  try{const parsed=JSON.parse(readFileSync(join(app.getPath('userData'),'composer-prefs.json'),'utf8'));composerPrefs={keepAfterSend:parsed.keepAfterSend!==false,dismissOnOutside:parsed.dismissOnOutside!==false};}
  catch{composerPrefs={keepAfterSend:true,dismissOnOutside:true};}
}
function saveComposerPrefs(){try{writeFileSync(join(app.getPath('userData'),'composer-prefs.json'),JSON.stringify(composerPrefs));}catch{}}
function cliConfigDir(){return process.platform==='win32'?join(app.getPath('localAppData'),'Grok Bot Anywhere','cli'):join(app.getPath('userData'),'cli');}
function loadCliPref(){try{const parsed=JSON.parse(readFileSync(join(app.getPath('userData'),'cli-enabled.json'),'utf8'));return {enabled:parsed.enabled===true,pathSnippet:parsed.pathSnippet===true};}catch{return {enabled:false,pathSnippet:false};}}
function saveCliPref(pref){try{writeFileSync(join(app.getPath('userData'),'cli-enabled.json'),JSON.stringify({enabled:!!pref.enabled,pathSnippet:!!pref.pathSnippet}));}catch{}}
function loadShellPrefs(){
  try{const parsed=JSON.parse(readFileSync(join(app.getPath('userData'),'login-item.json'),'utf8'));loginItemKnown=true;openAtLogin=parsed.enabled===true;}catch{loginItemKnown=false;openAtLogin=false;}
  try{explorerMenu=JSON.parse(readFileSync(join(app.getPath('userData'),'explorer-menu.json'),'utf8')).enabled!==false;}catch{explorerMenu=true;}
  try{touchBarPinned=JSON.parse(readFileSync(join(app.getPath('userData'),'touchbar.json'),'utf8')).pinned===true;}catch{touchBarPinned=false;}
}
function saveExplorerPref(){try{writeFileSync(join(app.getPath('userData'),'explorer-menu.json'),JSON.stringify({enabled:explorerMenu===true}));}catch{}}
function saveLoginPref(){try{writeFileSync(join(app.getPath('userData'),'login-item.json'),JSON.stringify({enabled:openAtLogin}));}catch{}}
function saveTouchPref(){try{writeFileSync(join(app.getPath('userData'),'touchbar.json'),JSON.stringify({pinned:touchBarPinned}));}catch{}}
let notifyIcon;
function notificationIcon(){
  if(process.platform!=='win32')return null;
  if(!notifyIcon||notifyIcon.isEmpty())notifyIcon=nativeImage.createFromBuffer(coalBallPng(256));
  return notifyIcon.isEmpty()?null:notifyIcon;
}
function systemNotification(payload){
  const icon=notificationIcon();
  return new Notification({...payload,...icon?{icon}:{}});
}
function trayImage(){
  const image=nativeImage.createEmpty();
  const icons=process.platform==='darwin'?trayIconImages('darwin'):[coalBallIcon(16),coalBallIcon(32)].map(icon=>({png:icon.png,size:icon.width,scale:icon.width/16,template:false}));
  for(const icon of icons)image.addRepresentation({scaleFactor:icon.scale,width:icon.size/icon.scale,height:icon.size/icon.scale,dataURL:`data:image/png;base64,${icon.png.toString('base64')}`});
  if(icons.some(icon=>icon.template))image.setTemplateImage(true);
  return image;
}
function showMainWindow(){
  if(!window||window.isDestroyed())return;
  if(window.isMinimized())window.restore();
  window.show();
  window.focus();
}
function ensureTray(){
  if(tray||smoke||preview)return;
  if(process.platform!=='darwin'&&process.platform!=='win32')return;
  const image=trayImage();
  if(!image||image.isEmpty())return;
  tray=new Tray(image);
  tray.setToolTip('Grok Bot Anywhere');
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuModel(app.getLocale?.()??'').map(item=>({label:item.label,click:()=>runTray(trayCommand(item.id))}))));
  if(process.platform==='win32')tray.on('click',()=>showMainWindow());
}
function runTray(action){
  if(action==='show-main'){showMainWindow();return;}
  if(action==='open-composer'){const bot=lastAwakeBot();if(bot)void openComposer(bot.id).catch(error=>issue(errorCode(error)));else showMainWindow();return;}
  if(action==='quit'){quitting=true;app.quit();}
}
function refreshTouchBar(){
  if(process.platform!=='darwin'||smoke||!window||window.isDestroyed()||!TouchBar?.TouchBarScrubber)return;
  const bots=listedBots(latestState.bots??[]);
  const key=bots.map(bot=>`${bot.id}\n${bot.name??''}`).join('\0');
  if(key===touchBarKey)return;
  touchBarKey=key;
  const scrubber=new TouchBar.TouchBarScrubber({
    items:bots.map(bot=>({label:bot.name||'Bot'})),
    mode:'free',
    continuous:false,
    select:index=>{
      const bot=bots[index];
      if(!bot)return;
      const current=touchBarSelection||activeBotId;
      const choice=touchBarChoice({moved:current!==''&&current!==bot.id,startId:current,selectedId:bot.id});
      touchBarSelection=bot.id;
      if(choice.action==='compose')void openComposer(bot.id).catch(error=>issue(errorCode(error)));
      else if(choice.action==='select'){activeBotId=bot.id;update();}
    }
  });
  window.setTouchBar(new TouchBar({items:[scrubber]}));
}
const explorerSync=createExplorerSync();
function explorerOps(){
  return explorerRegistryOps({executable:process.execPath,appArgs:app.isPackaged?[]:[app.getAppPath()],bots:latestState.bots??[],recipients:latestState.recipients??[],enabled:explorerMenu!==false});
}
function applyExplorer(ops){
  return applyExplorerRegistry(ops,{platform:process.platform,execFile:(file,args,options)=>runProcess(file,args,{windowsHide:true,...options})});
}
function syncExplorer(){
  if(process.platform!=='win32'||preview)return;
  void explorerSync.schedule(explorerOps(),applyExplorer).then(result=>{
    if(result?.applied&&hostIssue==='EXPLORER_SYNC_FAILED'){hostIssue=null;update();}
  }).catch(()=>issue('EXPLORER_SYNC_FAILED'));
}
async function logExplorerReject(argv,botId,reason){
  try{
    const dir=join(app.getPath('userData'),'logs');
    await mkdir(dir,{recursive:true});
    const file=join(dir,'explorer-forward.log');
    let previous='';
    try{previous=readFileSync(file,'utf8');}catch{previous='';}
    writeFileSync(file,trimExplorerLog(previous,explorerLogLine({at:new Date().toISOString(),argv,botId,state:latestState,reason})));
  }catch{}
}
async function deliverExplorer(forward){
  if(!forward?.botId)return;
  const verdict=await resolveExplorerForward({read:()=>({botId:forward.botId,bots:latestState.bots,recipients:latestState.recipients,connected:latestState.connected===true,hasAccount:!!latestState.account,settled:explorerSettled})});
  if(!verdict.accept){
    await logExplorerReject(forward.argv??[],verdict.botId||forward.botId,verdict.reason);
    if(!preview&&Notification.isSupported())systemNotification(explorerRejectNotice(app.getLocale?.()??'',verdict.reason)).show();
    return;
  }
  const appArg=app.isPackaged?'':app.getAppPath();
  const files=(forward.files??[]).filter(file=>typeof file==='string'&&isAbsolute(file)&&file!==appArg);
  if(!files.length)return;
  const item=await rpc.call('receive',{botId:verdict.botId,source:'share',files,manual:true});
  await openComposer(verdict.botId,item);
}
const explorerBatch=createExplorerBatch();
const launchForward=parseExplorerForward(process.argv);
if(launchForward){launchForward.argv=process.argv;explorerBatch.push(launchForward);}
function deeplinkIssue(code){
  const safe=errorCode({message:code});
  notify('toast',safe);
  const visible=!!window&&!window.isDestroyed()&&window.isVisible();
  if(visible||preview||!Notification.isSupported())return;
  systemNotification({title:'Grok Bot Anywhere',body:deeplinkNotice(app.getLocale?.()??'',safe)}).show();
}
function acceptDeeplink(raw){
  const text=String(raw??'').trim().replace(/^"(.*)"$/,'$1');
  if(!text.startsWith('grokbotanywhere:'))return false;
  if(preview)return true;
  if(!deeplinkReady){pendingLinks.push(text);return true;}
  deeplinkChain=deeplinkChain.then(()=>handleDeeplink(text)).catch(error=>deeplinkIssue(errorCode(error)));
  return true;
}
async function handleDeeplink(raw){
  if(preview)return;
  const parsed=parseDeeplink(raw);
  if(!parsed.ok){deeplinkIssue('DEEPLINK_IGNORED');return;}
  if(parsed.action==='open'){showMainWindow();return;}
  if(parsed.action==='compose'){
    const bot=parsed.bot?(latestState.bots??[]).find(item=>item.id===parsed.bot):lastAwakeBot();
    if(!bot){if(parsed.bot)deeplinkIssue('BOT_NOT_FOUND');else showMainWindow();return;}
    if(parsed.hasText){
      if(!latestState.connected){deeplinkIssue('LOGIN_REQUIRED');return;}
      const recipient=(latestState.recipients??[]).find(item=>item.botId===bot.id);
      if(!shortcutSourceAllowed(recipient)){deeplinkIssue('SOURCE_DISABLED');return;}
    }
    try{await openComposer(bot.id,undefined,{text:parsed.hasText?parsed.text:undefined,captureSelection:!parsed.hasText});}
    catch(error){deeplinkIssue(errorCode(error));}
    return;
  }
  const bot=(latestState.bots??[]).find(item=>item.id===parsed.bot);
  if(!latestState.connected){deeplinkIssue('LOGIN_REQUIRED');return;}
  if(!bot){deeplinkIssue('BOT_NOT_FOUND');return;}
  const recipient=(latestState.recipients??[]).find(item=>item.botId===bot.id);
  if(!shortcutSourceAllowed(recipient)){deeplinkIssue('SOURCE_DISABLED');return;}
  try{
    const item=await rpc.call('receive',{botId:bot.id,source:'shortcuts',text:parsed.text,manual:true});
    if(item?.error)deeplinkIssue(item.error);
    if(item?.mode==='compose')await openComposer(bot.id,item);
  }catch(error){deeplinkIssue(errorCode(error));}
}
if(process.platform!=='darwin')for(const arg of process.argv)if(String(arg).includes('grokbotanywhere://'))acceptDeeplink(arg);
function cliBundle(){return skillBundleDir({packaged:app.isPackaged,resourcesPath:process.resourcesPath,devRoot:join(here,'../..')});}
async function syncCliCredential(credentials){
  if(!cliStatus.enabled||preview)return;
  cliStatus.credential=await writeCliCredential(cliConfigDir(),credentials);
  cliStatus.error='';
}
async function forgetCliCredential(){
  if(preview)return;
  try{await writeCliCredential(cliConfigDir(),null);cliStatus.credential=false;}
  catch(error){cliStatus.error=errorCode(error);}
}
async function setCliEnabled(enabled){
  if(preview)throw new Error('PREVIEW_ONLY');
  if(!enabled){
    const pref=loadCliPref();
    cliStatus=await disableCli({home:homedir(),platform:process.platform,configDir:cliConfigDir(),removePath:pref.pathSnippet});
    saveCliPref({enabled:false,pathSnippet:false});
    update();
    return cliPublic();
  }
  const saved=loadCliPref();
  let credentials=null;
  try{credentials=await vault.load();}catch(error){if(error?.message==='CREDENTIAL_STORAGE_UNAVAILABLE')throw error;}
  cliStatus=await enableCli({home:homedir(),platform:process.platform,pathEnv:process.env.PATH??'',bundleDir:cliBundle(),configDir:cliConfigDir(),runtime:process.execPath,credentials,savedPathSnippet:saved.pathSnippet});
  saveCliPref({enabled:true,pathSnippet:!!cliStatus.pathSnippet});
  update();
  return cliPublic();
}
function rankedBots(){
  const bots=latestState.bots??[],recipients=latestState.recipients??[];
  const order=id=>recipients.find(item=>item.botId===id)?.order??0;
  return bots.map((bot,index)=>({bot,index,order:order(bot.id)})).sort((a,b)=>a.order-b.order||a.index-b.index).map(item=>item.bot);
}
function lastAwakeBot(){
  const bots=rankedBots();
  return bots.find(bot=>bot.id===activeBotId)??bots[0]??null;
}
function unregisterShortcuts(){
  for(const accelerator of registeredShortcuts.keys()){try{globalShortcut.unregister(accelerator);}catch{}}
  registeredShortcuts.clear();
}
function shortcutTargets(map){
  const wanted=new Map();
  const compose=typeof map?.compose==='string'?map.compose:'';
  if(compose)wanted.set(compose,'compose');
  const open=typeof map?.open==='string'?map.open:'';
  if(open&&!wanted.has(open))wanted.set(open,'open');
  const known=new Set((latestState.bots??[]).map(bot=>bot.id));
  for(const [botId,accelerator] of Object.entries(map?.bots??{})){
    if(!known.has(botId)||typeof accelerator!=='string'||!accelerator||wanted.has(accelerator))continue;
    wanted.set(accelerator,botId);
  }
  for(const [botId,accelerator] of Object.entries(map?.opens??{})){
    if(!known.has(botId)||typeof accelerator!=='string'||!accelerator||wanted.has(accelerator))continue;
    wanted.set(accelerator,`grok:${botId}`);
  }
  return wanted;
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
  bindWindowsEditKeys(target.webContents);
}
async function ensureFloat(){
  if(floatWindow&&!floatWindow.isDestroyed())return floatWindow;
  const mac=process.platform==='darwin';
  const traits=floatingComposerTraits(process.platform);
  const common={show:false,frame:false,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,skipTaskbar:traits.skipTaskbar,transparent:traits.transparent,hasShadow:false,roundedCorners:false,backgroundColor:'#00000000',excludedFromShownWindowsMenu:true,...(traits.thickFrame===false?{thickFrame:false}:{}),webPreferences:{preload:join(here,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}};
  // One CSS corner. Native rounding, vibrancy, or acrylic draws a second outline around the card.
  floatWindow=new BrowserWindow({...common,width:368,height:120,acceptFirstMouse:true,title:'Grok Bot Anywhere'});
  avatarWindow=new BrowserWindow({...common,width:88,height:88,focusable:false});
  pickerWindow=new BrowserWindow({...common,width:760,height:188,acceptFirstMouse:true});
  for(const target of [floatWindow,avatarWindow,pickerWindow]){if(traits.alwaysOnTop){if(mac)target.setAlwaysOnTop(true,'floating');else target.setAlwaysOnTop(true);}try{target.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});}catch{target.setVisibleOnAllWorkspaces(true);}}
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
  const wanted=shortcutTargets(map);
  let same=wanted.size===registeredShortcuts.size;
  if(same)for(const [accelerator,slot] of wanted)if(registeredShortcuts.get(accelerator)!==slot)same=false;
  if(same)return;
  unregisterShortcuts();
  let failed=false;
  for(const [accelerator,slot] of wanted){
    let registered=false;
    try{registered=globalShortcut.register(accelerator,()=>{
      const grok=slot.startsWith('grok:')?slot.slice(5):'';
      const bot=slot==='compose'||slot==='open'?lastAwakeBot():rankedBots().find(item=>item.id===(grok||slot));
      if(!bot){showMainWindow();return;}
      const action=slot==='open'||grok?openInGrokBot(bot.id):openComposer(bot.id);
      void action.catch(error=>issue(errorCode(error)));
    });}catch{registered=false;}
    if(!registered){failed=true;continue;}
    registeredShortcuts.set(accelerator,slot);
  }
  if(failed)issue('SHORTCUT_UNAVAILABLE');
  else if(hostIssue==='SHORTCUT_UNAVAILABLE'){hostIssue=null;update();}
}
async function readShareOrder(){
  const current=()=>menuEntries(latestState).map(entry=>entry.botId);
  if(process.platform==='darwin'){
    try{
      const {stdout}=await runProcess('swift',[join(here,'../../scripts/probe-share.swift')],{timeout:25000,maxBuffer:1024*1024});
      const ids=matchShareTitles(stdout.split('\n'),menuEntries(latestState));
      if(ids.length)return {ids,source:'wechat'};
    }catch{}
    const known=new Set((latestState.bots??[]).map(bot=>bot.id));
    const ids=(shareMenu?.installed?.entries??[]).filter(entry=>entry.slot>=1&&entry.slot<=12&&known.has(entry.botId)).sort((a,b)=>a.slot-b.slot).map(entry=>entry.botId);
    if(ids.length)return {ids,source:'installed'};
  }
  return {ids:current(),source:'settings'};
}
async function openInGrokBot(botId){
  if(!(latestState.bots??[]).some(bot=>bot.id===botId))throw new Error('BOT_NOT_FOUND');
  const url=grokBotAgentUrl(botId);
  try{await shell.openExternal(url);}catch{throw new Error('GROK_BOT_OPEN_FAILED');}
  return {ok:true};
}
async function openComposer(botId,receipt,options={}){
  if(latestState.accountBusy)throw new Error('ACCOUNT_BUSY');
  if(receipt&&(receipt.accountId!==latestState.account?.id||receipt.botId!==botId))throw new Error('RECEIPT_SCOPE_MISMATCH');
  const bot=latestState.bots?.find(item=>item.id===botId);if(!bot)throw new Error('BOT_NOT_FOUND');
  const generation=++composeGeneration;
  const capture=!receipt&&options.captureSelection!==false;
  const deferFiles=capture&&process.platform==='win32';
  // macOS reads Finder before focus moves. Windows snapshots the foreground hwnd before show, then reads that window.
  let prepared=null;
  if(deferFiles){
    const pending=prepareExplorerSelection();
    const snap=await Promise.race([pending.hwndReady.then(info=>({info})),new Promise(resolve=>setTimeout(()=>resolve({info:'TIMEOUT'}),2500))]);
    if(generation!==composeGeneration)return {ok:true};
    if(snap.info!=='TIMEOUT')prepared=pending;
  }
  const localPaths=capture&&!deferFiles?await frontmostFiles():[];
  if(generation!==composeGeneration)return {ok:true};
  activeBotId=botId;
  const draftText=typeof options.text==='string'?options.text:undefined;
  const attachToken=deferFiles?generation:0;
  pendingFloat=receipt?{id:receipt.id,botId,text:receipt.text??'',title:receipt.title??'',files:(receipt.files??[]).map(({name,bytes})=>({name,bytes})),botName:receipt.botName??bot.name}:{botId,focus:true,localPaths,...attachToken?{attachToken}:{},...draftText!==undefined?{text:draftText}:{}};
  const float=await ensureFloat();
  placeFloat(368,110);
  floatShownAt=Date.now();
  float.setIgnoreMouseEvents(false);
  float.show();float.focus();
  layoutExtras();
  notify('composer',pendingFloat);
  if(prepared){
    const token=attachToken;
    const openedFor=botId;
    void prepared.files().then(async paths=>{
      if(token!==composeGeneration)return;
      const localPaths=await regularFiles(Array.isArray(paths)?paths:[]);
      if(token!==composeGeneration)return;
      notify('composer-files',{botId:openedFor,token,localPaths});
    }).catch(()=>{});
  }
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
    await vault.save(result.credentials);latestState=result.state;hostIssue=null;try{await syncCliCredential(result.credentials);}catch(error){cliStatus.error=errorCode(error);}update();
    void rpc.call('resume').catch(error=>issue(errorCode(error)));
    return publicState();
  }finally{accountBusy=false;}
}
function tailText(value,limit){
  if(typeof value!=='string'||!value)return '';
  return value.length>limit?`… ${value.length-limit} characters omitted …\n${value.slice(-limit)}`:value;
}
function menuSummary(installed){
  const entries=(installed?.entries??[]).map(entry=>({slot:entry.slot,botName:entry.botName,generation:entry.generation??1,extensionId:entry.extensionId??'',mode:entry.mode??''}));
  return {layoutVersion:installed?.layoutVersion??null,hostPath:installed?.hostPath??'',build:installed?.build??null,entries};
}
async function copyDiagnostics(){
  const root=join(app.getPath('userData'),'ShareInbox');
  const status=shareMenu?.status??{available:false,registered:0,needsUpdate:true};
  const lines=[
    `Grok Bot Anywhere ${app.getVersion()}`,
    `time=${new Date().toISOString()}`,
    `platform=${process.platform} ${process.arch}`,
    `electron=${process.versions.electron??''} node=${process.versions.node??''}`,
    `packaged=${app.isPackaged}`,
    `hostIssue=${hostIssue??''}`,
    `shareMenu=${JSON.stringify({available:!!status.available,registered:status.registered??0,enabled:status.enabled??0,needsUpdate:!!status.needsUpdate,busy:!!status.busy,error:status.error??''})}`,
    `installed=${JSON.stringify(menuSummary(shareMenu?.installed))}`
  ];
  for(const name of ['configuration.json','menu-state.json']){
    try{
      const data=JSON.parse(await readFile(join(root,name),'utf8'));
      const entries=(data.entries??[]).map(entry=>({slot:entry.slot,botName:entry.botName,mode:entry.mode??'',generation:entry.generation??1}));
      lines.push(`${name}=${JSON.stringify({accountId:data.accountId?'[set]':null,entries})}`);
    }catch(error){lines.push(`${name}=<unreadable: ${error.code??error.message}>`);}
  }
  try{
    const log=await readFile(join(root,'menu-update.log'),'utf8');
    lines.push('','menu-update.log (tail):',tailText(log,30000));
  }catch(error){
    lines.push('',`menu-update.log=<${error.code??error.message}>`);
  }
  try{
    const names=(await readdir(root)).filter(name=>name.startsWith('update-failure-')&&name.endsWith('.txt'));
    const files=[];
    for(const name of names){const info=await stat(join(root,name));files.push({name,mtime:info.mtimeMs});}
    files.sort((a,b)=>b.mtime-a.mtime);
    for(const file of files.slice(0,2)){
      const content=await readFile(join(root,file.name),'utf8').catch(error=>`<${error.code??error.message}>`);
      lines.push('',`${file.name}:`,tailText(content,8000));
    }
    if(!files.length)lines.push('','update-failure-*.txt=none');
  }catch(error){lines.push('',`update-failure-*.txt=<${error.code??error.message}>`);}
  const text=lines.join('\n');
  clipboard.writeText(text);
  return {copied:true,characters:text.length};
}
async function nativeRequest(method,p){
  switch(method){
    case 'list':return {bots:latestState.bots,truncated:false};
    case 'runtime':return {mainAgentId:latestState.runtime?.mainAgentId??null};
    case 'statuses':return {statuses:latestState.runtime?.statuses??[]};
    case 'status':return {connected:latestState.connected,sending:latestState.backgroundSending||latestState.inbox?.some(row=>['uploading','sending'].includes(row.phase))||false};
    case 'compose':return openComposer(p.botId);
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
    if(message.event==='library.open')showMainWindow();
    if(message.event==='exit'){issue('NATIVE_COMPOSER_UNAVAILABLE');}
  }});
  try{await companion.start();await companion.call('state',latestState);await companion.call('touchbar.pin',touchBarPinPayload(touchBarPinned)).catch(()=>{});update();void flushSharedComposers();}catch{companion.stop();companion=null;issue('NATIVE_COMPOSER_UNAVAILABLE');}
}
async function dispatch(method,p){
  switch(method){
    case 'state':return publicState();
    case 'login':return accountAction('login');
    case 'desktopLogin':return accountAction('desktopLogin');
    case 'logout':{
      if(accountBusy)throw new Error('ACCOUNT_BUSY');
      const state=await rpc.call('logout');await vault.remove();await forgetCliCredential();latestState=state;await companion?.call('state',state);update();return publicState();
    }
    case 'refresh':await rpc.call('refresh');return publicState();
    case 'duplicateBot':{const result=await rpc.call('duplicateBot',{botId:p.botId});return {...publicState(),duplicatedBotId:result?.bot?.id??''};}
    case 'configure':return rpc.call('configure',{botId:p.botId,patch:p.patch});
    case 'disableAllReceive':return rpc.call('disableAllReceive');
    case 'explorerMenu':{
      if(preview)throw new Error('PREVIEW_ONLY');
      if(process.platform!=='win32')throw new Error('EXPLORER_MENU_UNAVAILABLE');
      if(p.action==='remove')explorerMenu=false;
      else if(p.action==='set')explorerMenu=p.enabled===true;
      else if(p.action!=='rebuild')throw new Error('METHOD_UNKNOWN');
      saveExplorerPref();
      try{await explorerSync.schedule(explorerOps(),applyExplorer,{force:true});}
      catch{issue('EXPLORER_SYNC_FAILED');throw new Error('EXPLORER_SYNC_FAILED');}
      update();
      return {enabled:explorerMenu===true};
    }
    case 'copyDiagnostics':return copyDiagnostics();
    case 'updateMenu':{
      if(!shareMenu||preview)throw new Error('MENU_UNAVAILABLE');
      menuReconciler.request(latestState);await menuReconciler.flush({force:true});return shareMenu.status;
    }
    case 'menuOrder':return readShareOrder();
    case 'theme':nativeTheme.themeSource=p.theme;return rpc.call('theme',{theme:p.theme});
    case 'setShortcut':return rpc.call('setShortcut',{slot:p.slot,accelerator:p.accelerator});
    case 'setCli':return setCliEnabled(!!p.enabled);
    case 'setOpenAtLogin':{
      const next=!!p.enabled;
      if(shouldApplyLoginItem({preview,packaged:app.isPackaged})){try{applyLoginItem(next,app);}catch{throw new Error('LOGIN_ITEM_FAILED');}}
      openAtLogin=next;loginItemKnown=true;saveLoginPref();
      update();return {enabled:openAtLogin};
    }
    case 'setTouchBarPinned':{
      touchBarPinned=!!p.pinned;saveTouchPref();
      if(companion?.ready){try{await companion.call('touchbar.pin',touchBarPinPayload(touchBarPinned));}catch{}}
      update();return touchBarPinPayload(touchBarPinned);
    }
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
      if(shortcutsSuppressed)unregisterShortcuts();
      else applyShortcuts(latestState.shortcuts);
      return {ok:true};
    }
    case 'copyComposeLink':{
      const link=composeLink(p.botId);
      if(!link||!(latestState.bots??[]).some(bot=>bot.id===p.botId))throw new Error('BOT_NOT_FOUND');
      clipboard.writeText(link);return {ok:true};
    }
    case 'openBot':return openInGrokBot(p.botId);
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
    latestState=message.data;applyShortcuts(latestState.shortcuts);update();
    if(menuReconciler)menuReconciler.request(latestState);
    if(process.platform==='win32')syncExplorer();
    if(companion?.ready)void companion.call('state',latestState).catch(()=>{});
    if(pendingSharedComposers.size)void flushSharedComposers();
  }
  if(message.event==='login.url'){
    try{const url=new URL(message.data.url);if(url.origin!=='https://cursor.com'||url.pathname!=='/loginDeepControl')throw new Error();void shell.openExternal(url.href).catch(()=>issue('BROWSER_OPEN_FAILED'));}catch{issue('LOGIN_URL_INVALID');}
  }
  if(message.event==='auth.expired'){hostIssue='LOGIN_REQUIRED';void vault.remove().catch(()=>{});void forgetCliCredential().then(()=>update()).catch(()=>update());}
  if(message.event==='reply'&&!preview&&Notification.isSupported())systemNotification({title:message.data.name||'Grok Bot',body:zh?'收到新回复':'New reply'}).show();
  if(message.event==='share.received'){
    const action=shareHandoff({mode:message.data.mode});
    if(action==='service'){showMainWindow();notify('navigate',{page:'inbox'});}
    else void presentShare(message.data.id);
  }
  if(message.event==='share.error')issue('SHARE_IMPORT_FAILED');
}
function ownerWindow(){const owner=ipcSender?BrowserWindow.fromWebContents(ipcSender):null;return owner&&!owner.isDestroyed()?owner:window;}
function trusted(event){const contents=event.sender;if(event.senderFrame!==contents.mainFrame)return false;return [window,floatWindow,avatarWindow,pickerWindow].some(target=>target&&contents===target.webContents);}
// win32 去掉应用菜单后，编辑快捷键不再由菜单 accelerator 派发，这里补回输入框命令
// 2026-11-01 before-input-event：selectAll/copy/paste/cut/undo/redo，contents 无返回值
function bindWindowsEditKeys(contents){
  if(process.platform!=='win32')return;
  contents.on('before-input-event',(event,input)=>{
    const command=editCommand(input);
    if(!command)return;
    event.preventDefault();
    contents[command]();
  });
}
function pushWindowState(){
  if(!window||window.isDestroyed())return;
  let inset=0;
  try{const bounds=window.getBounds();inset=maximizedContentInset(process.platform,window.isMaximized(),bounds,screen.getDisplayMatching(bounds).workArea);}catch{inset=0;}
  window.webContents.send('anywhere:window-state',{maximized:window.isMaximized(),focused:window.isFocused(),inset});
}
async function createWindow(){
  window=new BrowserWindow({...mainWindowOptions(process.platform),
    ...(process.platform==='win32'?{icon:nativeImage.createFromBuffer(coalBallPng(256))}:{}),
    webPreferences:{preload:join(here,'../preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}});
  if(process.platform==='win32'){try{window.setBackgroundMaterial('acrylic');windowMaterial='acrylic';}catch{window.setBackgroundColor('#f4f4f4');windowMaterial='none';}}
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  if(smoke)window.webContents.on('console-message',details=>{if(details.level==='error')console.error('Renderer:',details.message);});
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  bindWindowsEditKeys(window.webContents);
  window.on('close',event=>{if(windowCloseAction({quitting,smoke,hasTray:!!tray})==='hide'){event.preventDefault();window.hide();}});
  for(const name of ['maximize','unmaximize','focus','blur'])window.on(name,pushWindowState);
  window.webContents.on('did-finish-load',pushWindowState);
  window.on('session-end',()=>{quitting=true;});
  window.once('ready-to-show',()=>{
    let wasOpenedAtLogin=false;
    try{wasOpenedAtLogin=app.getLoginItemSettings().wasOpenedAtLogin===true;}catch{wasOpenedAtLogin=false;}
    const openedAtLogin=openedAsLoginItem({wasOpenedAtLogin,argv:process.argv});
    if(!smoke&&!quietLaunch&&!openedAtLogin)showMainWindow();
  });
  await window.loadFile(join(here,'../../out/index.html'));
}
if(process.platform==='win32')app.setAppUserModelId('dev.ronglecat.grokbotanywhere');
app.setName('Grok Bot Anywhere');
if(!app.requestSingleInstanceLock({argv:process.argv})&&!smoke){app.quit();}else{
 app.on('second-instance',(_event,commandLine,_cwd,additionalData)=>{
  const argv=Array.isArray(additionalData?.argv)&&additionalData.argv.length?additionalData.argv:(commandLine??[]);
  const forward=parseExplorerForward(argv);
  const link=(argv??[]).map(item=>String(item).trim().replace(/^"(.*)"$/,'$1')).find(item=>item.startsWith('grokbotanywhere://'));
  if(forward){forward.argv=argv;explorerBatch.push(forward);}
  if(link)acceptDeeplink(link);
  if(forward||link||openedAsLoginItem({argv:argv}))return;
  showMainWindow();
 });
 app.on('open-url',(event,url)=>{
  event.preventDefault();
  if(String(url??'').startsWith('grokbotanywhere:'))acceptDeeplink(url);
 });
 app.whenReady().then(async()=>{
  if(!preview){
    if(app.isPackaged)app.setAsDefaultProtocolClient('grokbotanywhere');
    else app.setAsDefaultProtocolClient('grokbotanywhere',process.execPath,[app.getAppPath()]);
  }
  if(process.platform==='win32'&&!preview)warmExplorerSelection();
  vault=new CredentialVault(join(app.getPath('userData'),'account.enc'),safeStorage);
  if(!preview&&loadCliPref().enabled){try{await setCliEnabled(true);}catch(error){cliStatus={enabled:false,command:'',skillsPath:'',claudeLinked:false,credential:false,pathSnippet:false,error:errorCode(error)};}}
  if(!preview&&process.platform==='darwin'){
    const template=menuHostTemplate({packaged:app.isPackaged,resourcesPath:process.resourcesPath,devRoot:join(here,'../..')});
    if(existsSync(join(template,'Contents/MacOS/GrokBotMenuHost'))){
      shareMenu=new ShareMenu({root:join(app.getPath('userData'),'ShareInbox'),template,applicationsRoot:join(homedir(),'Applications'),applicationPath:sharingApplicationPath({packaged:app.isPackaged,appPath:app.getAppPath(),execPath:process.execPath}),locale:app.getLocale(),onChange:()=>{if(!shareMenu.status.needsUpdate&&hostIssue==='MENU_UPDATE_FAILED')hostIssue=null;update();}});
      await shareMenu.initialize();
      menuReconciler=new MenuReconciler({
        sync:state=>shareMenu.sync(state),publish:state=>shareMenu.sync(state),needsUpdate:()=>shareMenu.status.needsUpdate,
        update:async(state,isCurrent,force)=>{const icons=await captureMenuIcons(state,join(here,'../../out/native-avatar/index.html'));if(!isCurrent())return;return shareMenu.update(state,icons,{isCurrent,force});},
        onError:error=>{
          if(['MENU_SUPERSEDED','MENU_UPDATE_BUSY','ACCOUNT_BUSY'].includes(error?.message))return;
          shareMenu.status.error='MENU_UPDATE_FAILED';
          const detail=[new Date().toISOString(),error?.message??String(error),error?.cause?.message,error?.cause?.stderr,error?.stack].filter(Boolean).join('\n');
          void appendFile(join(app.getPath('userData'),'ShareInbox','menu-update.log'),detail+'\n---\n',{mode:0o600}).catch(()=>{});
          issue('MENU_UPDATE_FAILED');
        }
      });
    }
  }
  worker=utilityProcess.fork(join(here,'../service/worker.mjs'),[],{serviceName:'Grok Bot Service',stdio:'pipe'});
  rpc=new RpcClient({send:message=>worker.postMessage(message),onEvent:serviceEvent});
  worker.on('message',message=>rpc.receive(message));worker.on('exit',()=>{rpc.close();issue('SERVICE_EXITED');});
  worker.stderr?.on('data',bytes=>{if(smoke)process.stderr.write(bytes);});
  loadComposerPrefs();
  loadShellPrefs();
  const loginStartup=loginItemStartup({known:loginItemKnown,enabled:openAtLogin});
  if(loginStartup&&shouldApplyLoginItem({preview,packaged:app.isPackaged})){try{applyLoginItem(loginStartup.openAtLogin,app);}catch{/* Keep the saved preference when the system rejects it. */}}
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
  ipcMain.handle('anywhere:window-control',(event,action)=>{
    if(!trusted(event)||!window||window.isDestroyed()||event.sender!==window.webContents)return {error:'UNTRUSTED_SENDER'};
    const allowed=acceptWindowControl(action);
    if(!allowed)return {error:'METHOD_UNKNOWN'};
    if(allowed==='minimize')window.minimize();
    else if(allowed==='toggleMaximize'){if(window.isMaximized())window.unmaximize();else window.maximize();}
    // 关闭走窗口 close，由 windowCloseAction 决定隐藏到托盘或退出
    // 2026-11-01 action close → window.close()
    else window.close();
    return {value:{ok:true}};
  });
  if(process.platform==='win32')Menu.setApplicationMenu(null);
  else{const menu=Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'quit'}]}]:[]),
    {label:zh?'文件':'File',submenu:[{label:zh?'显示主窗口':'Show window',click:()=>showMainWindow()},...(process.platform!=='darwin'?[{role:'quit'}]:[])]},
    {role:'editMenu'},{role:'windowMenu'}]);Menu.setApplicationMenu(menu);}
  await createWindow();
  ensureTray();
  await startCompanion();
  if(smoke){
    const result=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{if(document.documentElement.dataset.ready==='true')resolve({title:document.title,headings:[...document.querySelectorAll('h1')].map(e=>e.textContent)});else if(Date.now()-start>10000)reject(new Error('RENDERER_NOT_READY'));else setTimeout(tick,50);};tick();})`);
    const artifactRoot=app.isPackaged?join(temporaryRoot,'artifacts'):join(here,'../../artifacts');await mkdir(artifactRoot,{recursive:true});
    const avatarStats=await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{const nodes=[...document.querySelectorAll('.avatar')];if(nodes.length&&nodes.every(n=>n.shadowRoot?.querySelector('svg')))resolve({avatarCount:nodes.length});else if(Date.now()-start>8000)reject(new Error('AVATARS_NOT_PAINTED'));else setTimeout(check,40);};check();})`);
    await writeFile(join(artifactRoot,'bots.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`window.anywhere.theme('dark')`);
    await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{const nodes=[...document.querySelectorAll('.avatar')];if(nodes.length&&nodes.every(n=>n.shadowRoot?.querySelector('svg')))resolve(true);else if(Date.now()-start>8000)reject(new Error('AVATARS_NOT_PAINTED'));else setTimeout(check,40);};check();})`);
    await writeFile(join(artifactRoot,'bots-dark.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`window.anywhere.theme('light')`);
    const botId=latestState.bots[0].id;
    await rpc.call('configure',{botId,patch:{enabled:true,sources:{drop:true}}});
    const fixture=join(temporaryRoot,'会议记录.zip');await writeFile(fixture,Buffer.alloc(5*1024*1024,7));
    const receipt=await rpc.call('receive',{botId,source:'drop',files:[fixture],text:'把这份会议记录整理成待办'});
    if(receipt.status!=='needs-input'||receipt.files[0].bytes!==5*1024*1024)throw new Error('LOCAL_INTAKE_FAILED');
    await window.webContents.executeJavaScript(`(async()=>{document.querySelector('.nav-button[data-page="settings"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    await writeFile(join(artifactRoot,'settings.png'),(await window.webContents.capturePage()).toPNG());
    await window.webContents.executeJavaScript(`(async()=>{document.querySelector('.nav-button[data-page="inbox"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    await writeFile(join(artifactRoot,'inbox.png'),(await window.webContents.capturePage()).toPNG());
    await openComposer(botId,receipt);
    await floatWindow.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{if(document.querySelector('textarea.composer-input')&&document.querySelector('.float-avatar .avatar'))resolve(true);else if(Date.now()-start>8000)reject(new Error('FLOAT_NOT_READY'));else setTimeout(tick,40);};tick();})`);
    const floatControls=await floatWindow.webContents.executeJavaScript(`({composerCount:document.querySelectorAll('textarea.composer-input').length,avatarCount:document.querySelectorAll('.float-avatar .avatar').length})`);
    if(floatControls.composerCount!==1||floatControls.avatarCount!==1)throw new Error('FLOAT_UI_FAILED');
    await writeFile(join(artifactRoot,'composer.png'),(await floatWindow.webContents.capturePage()).toPNG());
    hideFloat();
    const controls=await window.webContents.executeJavaScript(`({composerCount:document.querySelectorAll('textarea.composer-input').length,receiptCount:document.querySelectorAll('article').length})`);
    if(controls.composerCount!==0||controls.receiptCount!==1)throw new Error('SHARED_UI_FAILED');
    console.log(JSON.stringify({smoke:'passed',...result,...controls,...avatarStats,nativeCompanion:!!companion?.ready,node:process.versions.node}));
    quitting=true;app.quit();return;
  }
  if(!preview){
    explorerBatch.arm(async(botId,files,meta)=>{try{await deliverExplorer({botId,files,argv:meta?.argv??[]});}catch(error){issue(errorCode(error));}});
    try{const credentials=await vault.load();if(credentials){const result=await rpc.call('connect',credentials);latestState=result.state;applyShortcuts(latestState.shortcuts);update();void rpc.call('resume').catch(error=>issue(errorCode(error)));presentPendingComposer();}}
    catch(error){issue(errorCode(error));}
    explorerSettled=true;
    deeplinkReady=true;
    for(const raw of pendingLinks.splice(0))acceptDeeplink(raw);
  }
 }).catch(error=>{console.error(errorCode(error));app.exit(1);});
}
app.on('activate',()=>showMainWindow());
app.on('window-all-closed',()=>{if(smoke)app.quit();});
app.on('session-end',()=>{quitting=true;});
app.on('before-quit',()=>{quitting=true;if(tray){tray.destroy();tray=null;}stopExplorerSelection();unregisterShortcuts();menuReconciler?.close();companion?.stop();worker?.kill();rpc?.close();});
// Preview data uses an OS temporary directory. Do not delete Chromium's cache
// while its helper processes are still shutting down.
