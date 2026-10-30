import {createAvatar} from 'grok-bot-avatar-engine';
import {acceleratorFromEvent,formatAccelerator} from '../shortcuts.mjs';
import {spliceWechatOrder} from '../share/order.mjs';
const api=window.anywhere;
let state,page='bots',selected='',search='',avatars=[],busy=false,recordingSlot=null,inboxBot='',menuReading=false,toastTimer,viewKey='';
const chinese=()=>state?.host?.locale?.startsWith('zh')??navigator.language.startsWith('zh');
const t=(cn,en)=>chinese()?cn:en;
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const errorMessages={
 NATIVE_COMPOSER_UNAVAILABLE:['输入框暂时打不开，请重新打开应用。','The composer is unavailable. Reopen the app.'],
 SOURCE_DISABLED:['请先为这个 Bot 打开接收，并打开对应来源。','Enable this Bot and the source you are using.'],
 LOGIN_REQUIRED:['请登录后发送。内容已留在这台电脑上。','Sign in to send. Your context stays on this computer.'],
 BOT_SEND_HELD:['这个 Bot 有一条未确认的发送，请先到发送记录里核对。','This Bot has an unconfirmed send. Check Send history first.'],
 PREVIEW_ONLY:['当前是预览，不能发送。','Messages cannot be sent in preview.'],
 DELIVERY_IN_PROGRESS:['上一条还在发送，请稍等。','Delivery is still running.'],
 ACCOUNT_BUSY:['账号操作还在进行。','An account operation is in progress.'],
 RECEIPT_NOT_SENDABLE:['这条内容现在不能发送。','This item cannot be sent right now.'],
 RECEIPT_EMPTY:['先写一点内容，或加上文件。','Write something or add a file.'],
 REQUEST_TIMEOUT:['等得太久了，请到发送记录里看结果。','The operation timed out. Check Send history.'],
 CREDENTIAL_STORAGE_UNAVAILABLE:['系统凭据存储暂不可用。','System credential storage is unavailable.'],
 SERVICE_EXITED:['后台停了，请重新打开应用。','The background service stopped. Reopen the app.'],
 MENU_RECIPIENT_REQUIRED:['请先为接收单位打开微信来源。','Enable WeChat for a recipient first.'],
 MENU_UPDATE_FAILED:['微信菜单没有更新，原来的菜单还在。','The forwarding menu could not be updated.'],
 MENU_UNAVAILABLE:['这个版本没有带上分享扩展。','This build does not include sharing extensions.'],
 SHORTCUT_INVALID:['这个按键组合不能用。请带上 Ctrl、Option 或 Command。','Use a shortcut with Ctrl, Option, or Command.'],
 SHORTCUT_UNAVAILABLE:['这个快捷键被占用了，请另外录一个。','That shortcut is taken. Record another one.'],
 BOT_NOT_FOUND:['没有找到这个 Bot。','That Bot was not found.'],
 SEND_UNCONFIRMED:['发送结果未确认，请到发送记录里核对。这条不会自动重发。','Delivery was not confirmed. Check Send history. It will not be resent.'],
 SEND_FAILED:['没有发出去，请到发送记录里重试。','Delivery failed. Retry it from Send history.']
};
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
async function run(action){try{await action();}catch(error){const pair=errorMessages[error.message];toast(pair?t(...pair):t('操作没有完成，请重试。','The operation did not complete. Please try again.'));}}
function recipientOf(id){return state.recipients.find(item=>item.botId===id);}
function orderedBots(){return state.bots.map((bot,index)=>({bot,index,order:recipientOf(bot.id)?.order??0})).sort((a,b)=>a.order-b.order||a.index-b.index).map(item=>item.bot);}
function avatar(bot,size=48){
 const target=el('div','avatar');target.style.width=target.style.height=`${size}px`;
 if(bot.avatar?.kind==='picture'&&bot.avatar.picture?.url){
  const image=el('img');try{const url=new URL(bot.avatar.picture.url);if(!['https:','data:'].includes(url.protocol))throw new Error();image.src=url.href;image.alt='';target.append(image);return target;}catch{}
 }
 requestAnimationFrame(()=>{if(!target.isConnected)return;avatars.push(createAvatar(target,{agentId:bot.id,shape:bot.avatarShape,color:bot.avatarColor,size,main:state.runtime?.mainAgentId===bot.id,state:state.runtime?.statuses?.some(row=>row.agentId===bot.id&&row.isRunning)?'working':'idle',theme:state.theme==='system'?'auto':state.theme,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches}));});
 return target;
}
function icon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 const paths={
  history:['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8','M3 3v5h5','M12 7v5l4 2'],
  settings:['M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'],
  up:['m18 15-6-6-6 6'],
  down:['m6 9 6 6 6-6']
 };
 for(const d of paths[name]){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);svg.append(path);}
 if(name==='settings'){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx','12');circle.setAttribute('cy','12');circle.setAttribute('r','3');svg.append(circle);}
 return svg;
}
function viewSignature(){
 const bots=orderedBots().map(bot=>{const recipient=recipientOf(bot.id);return [bot.id,bot.name,bot.description??'',bot.avatarShape??'',bot.avatarColor??'',bot.avatar?.kind==='picture'?bot.avatar.picture?.url??'':'',recipient?.enabled?1:0,recipient?.mode??'',recipient?.order??0,recipient?.prefix??'',recipient?.sources??null];});
 const running=(state.runtime?.statuses??[]).filter(row=>row.isRunning).map(row=>row.agentId).sort();
 return JSON.stringify({theme:state.theme,material:state.host?.material??'',platform:state.host?.platform??'',locale:state.host?.locale??'',preview:!!state.host?.preview,issue:state.host?.issue??'',connected:!!state.connected,account:state.account?.name??'',page,selected,search,busy,recording:recordingSlot??'',inboxBot,menuReading,shortcuts:state.shortcuts??null,prefs:state.composerPrefs??null,main:state.runtime?.mainAgentId??'',running,bots,menu:page==='settings'?state.host?.menu??null:null,inbox:page==='inbox'?state.inbox??null:null});
}
function render(){
 if(!state.bots.some(bot=>bot.id===selected))selected=orderedBots()[0]?.id??'';
 if(inboxBot&&!state.bots.some(bot=>bot.id===inboxBot))inboxBot='';
 const key=viewSignature();
 if(key===viewKey)return;
 viewKey=key;
 for(const handle of avatars)handle.destroy();avatars=[];
 document.documentElement.lang=chinese()?'zh-CN':'en';document.documentElement.dataset.theme=state.theme;
 document.documentElement.dataset.material=state.host?.material||'none';
 document.documentElement.classList.toggle('os-mac',state.host?.platform==='darwin');
 document.documentElement.classList.toggle('os-windows',state.host?.platform==='win32');
 $('search').placeholder=t('搜索','Search');$('search').setAttribute('aria-label',$('search').placeholder);
 renderGrid();renderNav();renderMain();
 document.documentElement.dataset.ready='true';
}
function renderGrid(){
 const grid=$('grid');grid.replaceChildren();grid.scrollLeft=0;
 const bots=orderedBots().filter(bot=>bot.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 if(!bots.length){grid.append(el('p','list-empty',state.bots.length?t('没有匹配的 Bot','No matching Bots'):t('登录后，Bot 会出现在这里','Bots show up here after you sign in')));return;}
 for(const bot of bots){
  const recipient=recipientOf(bot.id),active=page==='bots'&&bot.id===selected,cell=el('button',`bot-cell${active?' selected':''}`);cell.type='button';
  cell.setAttribute('aria-pressed',String(active));cell.title=t(`拖放文件给 ${bot.name}`,`Drop files for ${bot.name}`);
  const face=el('div','bot-face');face.append(avatar(bot,34));if(recipient?.enabled)face.append(el('span','bot-dot'));
  const meta=el('span','bot-meta');meta.append(el('span','bot-cell-name',bot.name));
  if(bot.description)meta.append(el('span','bot-cell-sub',bot.description));
  cell.append(face,meta);
  cell.addEventListener('click',()=>{selected=bot.id;page='bots';void api.noteBot(bot.id).catch(()=>{});render();});
  cell.addEventListener('dragover',event=>{event.preventDefault();cell.classList.add('selected');});
  cell.addEventListener('dragleave',()=>{if(!(page==='bots'&&bot.id===selected))cell.classList.remove('selected');});
  cell.addEventListener('drop',event=>{event.preventDefault();selected=bot.id;page='bots';render();void run(()=>api.dropFiles(bot.id,[...event.dataTransfer.files]));});
  grid.append(cell);
 }
}
function renderNav(){
 $('navigation').replaceChildren();
 $('navigation').setAttribute('aria-label',t('导航','Navigation'));
 for(const [id,label,glyph] of [['inbox',t('发送记录','Send history'),'history'],['settings',t('设置','Settings'),'settings']]){
  const button=el('button',`nav-button${page===id?' selected':''}`);button.type='button';button.dataset.page=id;button.setAttribute('aria-current',page===id?'page':'false');
  button.append(icon(glyph),el('span','',label));
  button.addEventListener('click',()=>{page=id;render();});$('navigation').append(button);
 }
 const issueCode=state.host?.issue&&state.host.issue!=='ACCOUNT_BUSY'?state.host.issue:'';
 $('notice').hidden=!state.host?.preview&&!issueCode;
 $('notice').textContent=state.host?.preview?t('界面预览，不会发送消息','Preview. Messages are not sent.'):errorMessages[issueCode]?t(...errorMessages[issueCode]):t('请检查账号连接。','Check the account connection.');
}
function renderMain(){const content=$('content');content.replaceChildren();if(page==='inbox')renderInbox(content);else if(page==='settings')renderSettings(content);else renderChat(content);}
function settingRow(label,control,help){
 const row=el('div','group-row'),copy=el('div','group-copy');
 copy.append(el('div','group-label',label));
 if(help)copy.append(el('div','group-help',help));
 row.append(copy,control);return row;
}
function renderChat(content){
 if(!state.bots.length){
  const panel=el('div','empty');panel.append(el('h1','',t('你的 Bot','Your Bots')),el('p','',t('连接账号后，从左边选择一个 Bot。','Connect an account, then choose a Bot on the left.')));
  const actions=el('div','row-actions');actions.append(loginButton());if(state.host?.platform==='darwin')actions.append(smallButton(t('使用本机登录','Use local login'),()=>api.desktopLogin()));panel.append(actions);content.append(panel);return;
 }
 const bot=state.bots.find(item=>item.id===selected),recipient=recipientOf(bot.id);
 const detail=el('div','detail'),hero=el('section','hero'),face=el('div','hero-face');
 face.append(avatar(bot,112));
 hero.append(face,el('h1','hero-name',bot.name));
 if(bot.description)hero.append(el('p','hero-bio',bot.description));
 const actions=el('div','hero-actions');
 actions.append(smallButton(t('开始对话','Start'),()=>api.compose(bot.id),'primary'),smallButton(t('同步','Sync'),async()=>{state=await api.refresh();render();},'secondary'));
 hero.append(actions);
 const ownShortcut=state.shortcuts?.bots?.[bot.id];
 if(ownShortcut)hero.append(el('p','hero-shortcut',formatAccelerator(ownShortcut,state.host?.platform)));
 const card=el('section','group');
 const enabled=el('input','switch');enabled.type='checkbox';enabled.checked=!!recipient?.enabled;enabled.setAttribute('aria-label',t(`让 ${bot.name} 接收转发`,`Let ${bot.name} receive forwards`));
 enabled.addEventListener('change',()=>run(()=>api.configure(bot.id,{enabled:enabled.checked})));
 card.append(settingRow(t('接收转发','Receive forwards'),enabled,recipient?.enabled?'':t('打开后，微信、拖放和快捷键才会把内容交给这个 Bot。','Turn this on before WeChat, drops, or the shortcut deliver here.')));
 if(recipient?.enabled){
  const mode=el('div','segment');mode.setAttribute('aria-label',t('收到之后','After receiving'));
  for(const [value,label] of [['compose',t('先放进输入框','Open in composer')],['direct',t('直接发送','Send directly')]]){
   const choice=el('button',value===recipient.mode?'selected':'',label);choice.type='button';choice.addEventListener('click',()=>run(()=>api.configure(bot.id,{mode:value})));mode.append(choice);
  }
  card.append(settingRow(t('收到之后','After receiving'),mode));
  const sources=el('div','sources');
  for(const [key,label] of [['wechat',t('微信','WeChat')],['drop',t('拖放','Drop')],['shortcuts',t('快捷键','Shortcut')],['share',t('系统分享','System share')]]){
   const chip=el('button',`source-chip${recipient.sources[key]?' selected':''}`,label);chip.type='button';chip.setAttribute('aria-pressed',String(!!recipient.sources[key]));
   if(key==='share')chip.title=t('选择会保存。单独的系统分享扩展还没装上，微信转发用「微信」。','This choice is saved. The separate system share extension is not installed; WeChat uses WeChat.');
   if(key==='shortcuts')chip.title=t('单独快捷键在下面设置。通用快捷键打开上次用过的 Bot。','Set this Bot’s shortcut below. The general shortcut opens the Bot you used last.');
   chip.addEventListener('click',()=>run(()=>api.configure(bot.id,{sources:{[key]:!recipient.sources[key]}})));sources.append(chip);
  }
  card.append(settingRow(t('来源','Sources'),sources));
  if(recipient.mode==='direct'){
   const prefix=el('input','prefix');prefix.placeholder=t('加在正文前','Prefix');prefix.setAttribute('aria-label',t('直接发送时加在正文前','Prefix for direct sends'));prefix.value=recipient.prefix;
   prefix.addEventListener('change',()=>run(()=>api.configure(bot.id,{prefix:prefix.value})));
   card.append(settingRow(t('前缀','Prefix'),prefix));
  }
 }
 card.append(shortcutRow(bot.id,t('快捷键','Shortcut'),t('只打开这个 Bot。','Opens only this Bot.')));
 detail.append(hero,card);content.append(detail);
}
function statusLabel(item){return {sent:t('已发送','Sent'),unconfirmed:t('未确认','Unconfirmed'),failed:t('失败','Failed'),expired:t('过期','Expired'),'needs-input':t('待发送','Waiting')}[item.status]??item.status;}
function renderInbox(content){
 const pageEl=el('div','page');
 pageEl.append(el('h1','page-title',t('发送记录','Send history')));
 const filters=el('div','filter-row');
 const all=el('button',`source-chip${inboxBot?'':' selected'}`,t('全部','All'));all.type='button';
 all.addEventListener('click',()=>{inboxBot='';render();});filters.append(all);
 for(const bot of orderedBots()){
  const chip=el('button',`source-chip${inboxBot===bot.id?' selected':''}`,bot.name);chip.type='button';
  chip.addEventListener('click',()=>{inboxBot=bot.id;render();});filters.append(chip);
 }
 pageEl.append(filters);
 const items=inboxBot?state.inbox.filter(item=>item.botId===inboxBot):state.inbox;
 if(!state.inbox.length){pageEl.append(el('p','empty-note',t('还没有发送记录。','No sends yet.')));content.append(pageEl);return;}
 if(!items.length){pageEl.append(el('p','empty-note',t('这个 Bot 还没有发送记录。','This Bot has no sends yet.')));content.append(pageEl);return;}
 const list=el('section','group');
 for(const item of items){
  const row=el('article','receipt'),top=el('div','receipt-top'),label=el('div');
  label.append(el('h2','',item.title||item.botName),el('div','receipt-meta',`${item.botName} · ${new Date(item.createdAt).toLocaleString(document.documentElement.lang)}`));
  top.append(label,el('span',`status ${item.status}`,['uploading','sending'].includes(item.phase)?t('正在发送','Sending'):statusLabel(item)));row.append(top);
  if(item.text)row.append(el('p','record-text',item.text));
  const files=el('div','files');for(const file of item.files??[])files.append(el('span','file',`${file.name} · ${(file.bytes/1024/1024).toFixed(1)} MB`));if(item.files?.length)row.append(files);
  const actions=el('div','row-actions');
  if(item.status==='needs-input')actions.append(smallButton(t('放入输入框','Open in composer'),()=>api.openReceipt(item.id),'primary'));
  if(item.status==='failed')actions.append(smallButton(t('重试','Retry'),()=>api.retry(item.id)));
  if(item.status==='unconfirmed'&&!item.holdResolved)actions.append(smallButton(t('已核对，恢复发送','Checked, unlock sending'),()=>api.resolve(item.id)));
  if(actions.childElementCount)row.append(actions);
  for(const reply of item.replies??[])row.append(el('p','reply',reply.text));
  list.append(row);
 }
 pageEl.append(list);content.append(pageEl);
}
function renderSettings(content){
 const pageEl=el('div','page');
 pageEl.append(el('h1','page-title',t('设置','Settings')));
 const account=el('section','group'),accountRow=el('div','group-row'),name=el('div'),heading=el('div','account-heading');
 heading.append(el('span',`account-dot${state.connected?' connected':''}`),el('span','group-label',state.account?.name??t('尚未连接','Not connected')));
 name.append(heading,el('div','group-help',state.connected?t('账号已连接','Connected'):t('登录后同步 Bot','Sign in to sync Bots')));
 const actions=el('div','row-actions');
 if(state.connected)actions.append(smallButton(t('退出','Sign out'),()=>api.logout()));
 else{actions.append(loginButton());if(state.host?.platform==='darwin')actions.append(smallButton(t('本机登录','Local login'),()=>api.desktopLogin()));}
 accountRow.append(name,actions);account.append(accountRow);pageEl.append(account);
 const appearance=el('section','group'),themeRow=el('div','group-row');themeRow.append(el('span','group-label',t('外观','Appearance')));
 const themes=el('div','segment');
 for(const [value,label] of [['system',t('系统','System')],['light',t('白','Light')],['dark',t('黑','Dark')]]){
  const choice=el('button',state.theme===value?'selected':'',label);choice.type='button';choice.addEventListener('click',()=>run(()=>api.theme(value)));themes.append(choice);
 }
 themeRow.append(themes);appearance.append(themeRow);pageEl.append(appearance);
 const keys=el('section','group');
 keys.append(shortcutRow('compose',t('通用快捷键','General shortcut'),t('打开上次用过的 Bot。点按键，再按下组合。Esc 取消。','Opens the Bot you used last. Click the key, then press a combination. Esc cancels.')));
 pageEl.append(keys);
 const prefs=state.composerPrefs??{keepAfterSend:true,dismissOnOutside:true};
 const behavior=el('section','group'),keepRow=el('div','group-row');
 keepRow.append(el('span','group-label',t('发送后','After sending')));
 const keep=el('div','segment');
 for(const [value,label] of [[true,t('保留输入框','Keep open')],[false,t('直接隐藏','Hide')]]){
  const choice=el('button',prefs.keepAfterSend===value?'selected':'',label);choice.type='button';
  choice.addEventListener('click',()=>run(()=>api.setComposerPrefs({keepAfterSend:value,dismissOnOutside:prefs.dismissOnOutside!==false})));
  keep.append(choice);
 }
 keepRow.append(keep);behavior.append(keepRow);
 const dismissRow=el('div','group-row'),dismissCopy=el('div');
 dismissCopy.append(el('div','group-label',t('点按外部关闭','Click outside closes')),el('div','group-help',t('关掉以后，悬浮输入框会显示关闭按钮。','When this is off, the floating composer shows a close button.')));
 const dismiss=el('input','switch');dismiss.type='checkbox';dismiss.checked=prefs.dismissOnOutside!==false;dismiss.setAttribute('aria-label',t('点按外部关闭','Click outside closes'));
 dismiss.addEventListener('change',()=>run(()=>api.setComposerPrefs({keepAfterSend:prefs.keepAfterSend!==false,dismissOnOutside:dismiss.checked})));
 dismissRow.append(dismissCopy,dismiss);behavior.append(dismissRow);pageEl.append(behavior);
 if(state.host?.platform==='darwin'){
  const menu=state.host.menu??{},panel=el('section','group'),row=el('div','group-row'),info=el('div');
  info.append(el('div','group-label',t('微信转发','WeChat')),el('div','group-help',!menu.available?t('这个版本没有分享扩展','Sharing extensions are not in this build'):menu.busy?t('正在同步菜单','Syncing the menu'):menu.needsUpdate?t('设置已保存，正在同步','Saved. Syncing the menu.'):t(`已启用 ${menu.registered??0} 个入口`,`${menu.registered??0} destinations on`)));
  const update=smallButton(t('重新同步','Sync again'),async()=>{update.disabled=true;try{const result=await api.updateMenu();toast(t(`已同步 ${result.registered} 个入口`,`Synced ${result.registered} destinations`));}finally{update.disabled=false;}});
  update.disabled=!menu.available||menu.busy;row.append(info,update);panel.append(row);
  const read=smallButton(menuReading?t('正在读取','Reading'):t('读取微信顺序','Read WeChat order'),readMenuOrder);
  read.disabled=menuReading;
  panel.append(settingRow(t('菜单顺序','Menu order'),read,t('读取微信里现在的顺序。排好以后，按这个顺序重新注册菜单。最多 12 个。','Read the current WeChat order. After you sort, the menu is registered in that order. Up to 12.')));
  const menuBots=wechatBots();
  menuBots.forEach((bot,index)=>{
   const line=el('div','menu-order-row'),buttons=el('div','order-buttons');
   const up=el('button','icon-button');up.type='button';up.disabled=index===0;up.setAttribute('aria-label',t('前移','Earlier'));up.append(icon('up'));
   up.addEventListener('click',()=>run(()=>moveMenu(bot.id,-1)));
   const down=el('button','icon-button');down.type='button';down.disabled=index===menuBots.length-1;down.setAttribute('aria-label',t('后移','Later'));down.append(icon('down'));
   down.addEventListener('click',()=>run(()=>moveMenu(bot.id,1)));
   buttons.append(up,down);line.append(el('span','menu-order-name',bot.name),buttons);panel.append(line);
  });
  pageEl.append(panel);
 }
 content.append(pageEl);
}
function loginButton(){return smallButton(busy?t('正在登录…','Signing in…'):t('连接账号','Connect'),async()=>{busy=true;render();try{await api.login();}finally{busy=false;render();}},'primary');}
function smallButton(text,action,className='text-button'){const button=el('button',className,text);button.type='button';button.addEventListener('click',()=>run(action));return button;}
function shortcutRow(slot,label,help){
 const shown=slot==='compose'?state.shortcuts?.compose:state.shortcuts?.bots?.[slot];
 const recording=recordingSlot===slot;
 const cap=el('button',`keycap${recording?' recording':''}`,recording?t('请按键','Press keys'):(shown?formatAccelerator(shown,state.host?.platform):t('未设置','None')));
 cap.type='button';cap.addEventListener('click',()=>{if(recordingSlot===slot)void finishRecording(null);else void beginRecording(slot);});
 const actions=el('div','row-actions');
 actions.append(cap,smallButton(t('清除','Clear'),()=>api.setShortcut(slot,'')));
 return settingRow(label,actions,help);
}
function wechatBots(){return orderedBots().filter(bot=>{const recipient=recipientOf(bot.id);return recipient?.enabled&&recipient.sources?.wechat;}).slice(0,12);}
async function applyBotOrder(ids){
 for(let position=0;position<ids.length;position++)if((recipientOf(ids[position])?.order??0)!==position)await api.configure(ids[position],{order:position});
}
async function moveMenu(id,delta){
 const ids=wechatBots().map(bot=>bot.id),index=ids.indexOf(id),next=index+delta;
 if(index<0||next<0||next>=ids.length)return;
 const order=ids.slice();const [moved]=order.splice(index,1);order.splice(next,0,moved);
 await applyBotOrder(spliceWechatOrder(orderedBots().map(bot=>bot.id),ids,order));
}
async function readMenuOrder(){
 if(menuReading)return;
 menuReading=true;render();
 try{
  const result=await api.menuOrder();
  const message={wechat:t('已按微信里的顺序排好','Sorted to match WeChat.'),installed:t('已按当前安装的菜单排好','Sorted to match the installed menu.'),settings:t('没有读到微信菜单','Could not read the WeChat menu.')}[result?.source]??t('没有读到微信菜单','Could not read the WeChat menu.');
  if(result?.source==='wechat'||result?.source==='installed')await applyBotOrder(spliceWechatOrder(orderedBots().map(bot=>bot.id),wechatBots().map(bot=>bot.id),result.ids??[]));
  toast(message);
 }finally{menuReading=false;render();}
}
async function beginRecording(slot){recordingSlot=slot;render();try{await api.suppressShortcuts(true);}catch{recordingSlot=null;render();}}
async function finishRecording(accelerator){
 const slot=recordingSlot;
 if(!slot&&accelerator==null)return;recordingSlot=null;
 try{if(accelerator&&slot)await api.setShortcut(slot,accelerator);}
 catch(error){const pair=errorMessages[error.message];toast(pair?t(...pair):t('操作没有完成，请重试。','The operation did not complete. Please try again.'));}
 finally{try{await api.suppressShortcuts(false);}catch{}render();}
}
$('search').addEventListener('input',()=>{search=$('search').value;render();});
window.addEventListener('keydown',event=>{
 if(!recordingSlot)return;
 event.preventDefault();
 if(event.key==='Escape'){void finishRecording(null);return;}
 const accelerator=acceleratorFromEvent(event);
 if(accelerator)void finishRecording(accelerator);
});
api.onChange(message=>{
 if(message.event==='navigate'&&message.data?.page)page=message.data.page;
 if(message.event==='composer'&&message.data?.botId)selected=message.data.botId;
 if(message.event==='state')state=message.data;
 if(state)render();
});
try{state=await api.state();selected=orderedBots()[0]?.id??'';if(selected)void api.noteBot(selected).catch(()=>{});render();}catch{toast(t('应用没有打开，请再试一次。','The app did not open. Please try again.'));}
