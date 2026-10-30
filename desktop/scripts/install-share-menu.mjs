// Maintenance command: install current recipient bindings without reading tokens
// or invoking any SDK/network message operation.
import {app,BrowserWindow} from 'electron';
import {DatabaseSync} from 'node:sqlite';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ShareMenu} from '../src/main/share-menu.mjs';
import {menuEntries} from '../src/share/model.mjs';
import {MenuReconciler} from '../src/share/reconciler.mjs';
import {captureMenuIcons} from '../src/main/menu-icons.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const application=process.argv[process.argv.indexOf('--application')+1];
if(!process.argv.includes('--application')||!application)throw new Error('APPLICATION_PATH_REQUIRED');
app.whenReady().then(async()=>{try{
 const userData=join(homedir(),'Library/Application Support/Grok Bot Anywhere');
 const db=new DatabaseSync(join(userData,'inbox/inbox.sqlite'),{readOnly:true});
 const last=JSON.parse(db.prepare('SELECT value FROM preferences WHERE key=?').get('lastAccount')?.value??'null');
 if(!last?.account)throw new Error('LOGIN_REQUIRED');
 const recipients=db.prepare('SELECT value FROM recipients WHERE account=?').all(last.account.id).map(r=>JSON.parse(r.value));db.close();
 const state={account:last.account,bots:last.bots,recipients,runtime:{}};
 const keepAlive=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false}});
 const icons=await captureMenuIcons(state,join(root,'out/native-avatar/index.html'));
 const menu=new ShareMenu({root:join(userData,'ShareInbox'),template:join(root,'native/GrokBotMenuHost.app'),applicationsRoot:join(homedir(),'Applications'),applicationPath:resolve(application),locale:app.getLocale()});
 await menu.initialize();const result=await menu.update(state,icons);
 console.log(JSON.stringify({menuUpdated:true,registered:result.registered,expected:result.enabled,needsUpdate:result.needsUpdate}));
 if(process.argv.includes('--verify-reconcile')){
  const reconciler=new MenuReconciler({sync:s=>menu.sync(s),publish:s=>menu.sync(s),needsUpdate:()=>menu.status.needsUpdate,update:async(s,isCurrent)=>menu.update(s,await captureMenuIcons(s,join(root,'out/native-avatar/index.html')),{isCurrent})});
  try{
   const first=menuEntries(state)[0],second=menuEntries(state)[1];
   if(!first||!second)throw new Error('TWO_RECIPIENTS_REQUIRED');
   const changed={...state,recipients:state.recipients.map(r=>r.botId===first.botId?{...r,enabled:false}:r),bots:state.bots.map(b=>b.id===second.botId?{...b,name:b.name+' (menu verification)'}:b)};
   reconciler.request(changed);await reconciler.flush();
   if(menu.status.registered!==1||!menu.installed.entries.some(e=>e.botName.endsWith('(menu verification)')))throw new Error('DYNAMIC_CHANGE_FAILED');
   console.log(JSON.stringify({dynamicRemoveAndRename:'passed'}));
  }finally{reconciler.request(state);await reconciler.flush();reconciler.close();}
  if(menu.status.registered!==menuEntries(state).length||menu.status.needsUpdate)throw new Error('RESTORE_FAILED');
  console.log(JSON.stringify({dynamicRestore:'passed'}));
 }
 app.quit();
}catch(error){console.error(error.message);app.exit(1);}}).catch(()=>app.exit(1));
