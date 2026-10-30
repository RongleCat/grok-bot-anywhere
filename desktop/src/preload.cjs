const {contextBridge,ipcRenderer,webUtils}=require('electron');
const call=(method,params={})=>ipcRenderer.invoke('anywhere:call',method,params).then(result=>{
  if(result?.error)throw new Error(result.error);return result?.value;
});
contextBridge.exposeInMainWorld('anywhere',{
  state:()=>call('state'),login:()=>call('login'),desktopLogin:()=>call('desktopLogin'),logout:()=>call('logout'),refresh:()=>call('refresh'),
  configure:(botId,patch)=>call('configure',{botId,patch}),theme:theme=>call('theme',{theme}),
  compose:botId=>call('compose',{botId}),openReceipt:id=>call('openReceipt',{id}),sendReceipt:id=>call('sendReceipt',{id}),
  sendDraft:(botId,text,files,receiptId)=>call('sendDraft',{botId,text,files,receiptId}),
  retry:id=>call('retry',{id}),
  resolve:id=>call('resolve',{id}),
  updateMenu:()=>call('updateMenu'),
  menuOrder:()=>call('menuOrder'),
  chooseFiles:botId=>call('chooseFiles',{botId}),
  pickFiles:()=>call('pickFiles'),
  setShortcut:(slot,accelerator)=>call('setShortcut',{slot,accelerator}),
  suppressShortcuts:on=>call('suppressShortcuts',{on}),
  setComposerPrefs:prefs=>call('setComposerPrefs',prefs),
  noteBot:botId=>call('noteBot',{botId}),
  pendingComposer:()=>call('pendingComposer'),
  hideComposer:()=>call('hideComposer'),
  setHit:hit=>call('setHit',{hit}),
  placeComposer:(width,height,regions)=>call('placeComposer',{width,height,regions}),
  syncPicker:payload=>call('syncPicker',payload??{}),
  pickBot:botId=>call('pickBot',{botId}),
  dropFiles:(botId,files)=>call('dropFiles',{botId,files:files.map(file=>webUtils.getPathForFile(file)).filter(Boolean)}),
  filePaths:files=>files.map(file=>webUtils.getPathForFile(file)).filter(Boolean),
  onChange:listener=>{const handler=(_event,data)=>listener(data);ipcRenderer.on('anywhere:event',handler);return()=>ipcRenderer.removeListener('anywhere:event',handler);}
});
