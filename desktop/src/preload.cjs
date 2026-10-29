const {contextBridge,ipcRenderer,webUtils}=require('electron');
const call=(method,params={})=>ipcRenderer.invoke('anywhere:call',method,params).then(result=>{
  if(result?.error)throw new Error(result.error);return result?.value;
});
contextBridge.exposeInMainWorld('anywhere',{
  state:()=>call('state'),login:()=>call('login'),desktopLogin:()=>call('desktopLogin'),logout:()=>call('logout'),refresh:()=>call('refresh'),
  configure:(botId,patch)=>call('configure',{botId,patch}),theme:theme=>call('theme',{theme}),
  compose:botId=>call('compose',{botId}),openReceipt:id=>call('openReceipt',{id}),retry:id=>call('retry',{id}),
  resolve:id=>call('resolve',{id}),
  updateMenu:()=>call('updateMenu'),
  chooseFiles:botId=>call('chooseFiles',{botId}),
  dropFiles:(botId,files)=>call('dropFiles',{botId,files:files.map(file=>webUtils.getPathForFile(file)).filter(Boolean)}),
  onChange:listener=>{const handler=(_event,data)=>listener(data);ipcRenderer.on('anywhere:event',handler);return()=>ipcRenderer.removeListener('anywhere:event',handler);}
});
