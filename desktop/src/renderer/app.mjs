import {createAvatar} from 'grok-bot-avatar-engine';
import {acceleratorFromEvent,formatAccelerator} from '../shortcuts.mjs';
const api=window.anywhere;
let state,page='bots',selected='',search='',avatars=[],busy=false,recording=false,toastTimer;
const chinese=()=>state?.host?.locale?.startsWith('zh')??navigator.language.startsWith('zh');
const t=(cn,en)=>chinese()?cn:en;
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const errorMessages={
 NATIVE_COMPOSER_UNAVAILABLE:['输入框暂时打不开，请重新打开应用。','The composer is unavailable. Reopen the app.'],
 SOURCE_DISABLED:['请先为这个 Bot 打开接收，并打开对应来源。','Enable this Bot and the source you are using.'],
 LOGIN_REQUIRED:['请登录后发送。内容已留在这台电脑上。','Sign in to send. Your context stays on this computer.'],
 BOT_SEND_HELD:['这个 Bot 有一条未确认的发送，请先到收件里核对。','This Bot has an unconfirmed send. Check Inbox first.'],
 PREVIEW_ONLY:['当前是预览，不能发送。','Messages cannot be sent in preview.'],
 DELIVERY_IN_PROGRESS:['上一条还在发送，请稍等。','Delivery is still running.'],
 ACCOUNT_BUSY:['账号操作还在进行。','An account operation is in progress.'],
 RECEIPT_NOT_SENDABLE:['这条内容现在不能发送。','This item cannot be sent right now.'],
 RECEIPT_EMPTY:['先写一点内容，或加上文件。','Write something or add a file.'],
 REQUEST_TIMEOUT:['等得太久了，请到收件里看结果。','The operation timed out. Check Inbox.'],
 CREDENTIAL_STORAGE_UNAVAILABLE:['系统凭据存储暂不可用。','System credential storage is unavailable.'],
 SERVICE_EXITED:['后台停了，请重新打开应用。','The background service stopped. Reopen the app.'],
 MENU_RECIPIENT_REQUIRED:['请先为接收单位打开微信来源。','Enable WeChat for a recipient first.'],
 MENU_UPDATE_FAILED:['微信菜单没有更新，原来的菜单还在。','The forwarding menu could not be updated.'],
 MENU_UNAVAILABLE:['这个版本没有带上分享扩展。','This build does not include sharing extensions.'],
 SHORTCUT_INVALID:['这个按键组合不能用。请带上 Ctrl、Option 或 Command。','Use a shortcut with Ctrl, Option, or Command.'],
 SHORTCUT_UNAVAILABLE:['这个快捷键被占用了，请另外录一个。','That shortcut is taken. Record another one.'],
 SEND_UNCONFIRMED:['发送结果未确认，请到收件里核对。这条不会自动重发。','Delivery was not confirmed. Check Inbox. It will not be resent.'],
 SEND_FAILED:['没有发出去，请到收件里重试。','Delivery failed. Retry it from Inbox.']
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
function render(){
 for(const handle of avatars)handle.destroy();avatars=[];
 document.documentElement.lang=chinese()?'zh-CN':'en';document.documentElement.dataset.theme=state.theme;
 document.documentElement.dataset.material=state.host?.material||'none';
 document.documentElement.classList.toggle('os-mac',state.host?.platform==='darwin');
 document.documentElement.classList.toggle('os-windows',state.host?.platform==='win32');
 if(!state.bots.some(bot=>bot.id===selected))selected=orderedBots()[0]?.id??'';
 $('search').placeholder=t('搜索','Search');$('search').setAttribute('aria-label',$('search').placeholder);
 renderGrid();renderNav();renderMain();
 document.documentElement.dataset.ready='true';
}
function renderGrid(){
 const grid=$('grid');grid.replaceChildren();grid.scrollLeft=0;
 const bots=orderedBots().filter(bot=>bot.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 if(!bots.length){grid.append(el('p','hint',state.bots.length?t('没有匹配的 Bot','No matching Bots'):t('登录后，Bot 会出现在这里','Bots show up here after you sign in')));return;}
 for(const bot of bots){
  const recipient=recipientOf(bot.id),cell=el('button',`bot-cell${bot.id===selected?' selected':''}`);cell.type='button';
  cell.setAttribute('aria-pressed',String(bot.id===selected));cell.title=t(`拖放文件给 ${bot.name}`,`Drop files for ${bot.name}`);
  const face=el('div','bot-face');face.append(avatar(bot,52));if(recipient?.enabled)face.append(el('span','bot-dot'));
  cell.append(face,el('span','bot-cell-name',bot.name));
  cell.addEventListener('click',()=>{selected=bot.id;page='bots';void api.noteBot(bot.id).catch(()=>{});render();});
  cell.addEventListener('dragover',event=>{event.preventDefault();cell.classList.add('selected');});
  cell.addEventListener('dragleave',()=>{if(bot.id!==selected)cell.classList.remove('selected');});
  cell.addEventListener('drop',event=>{event.preventDefault();selected=bot.id;page='bots';render();void run(()=>api.dropFiles(bot.id,[...event.dataTransfer.files]));});
  grid.append(cell);
 }
}
function renderNav(){
 $('navigation').replaceChildren();
 for(const [id,label] of [['bots',t('对话','Chat')],['inbox',t('收件','Inbox')],['settings',t('设置','Settings')]]){
  const button=el('button',`nav-button${page===id?' selected':''}`,label);button.type='button';button.setAttribute('aria-current',page===id?'page':'false');
  button.addEventListener('click',()=>{page=id;render();});$('navigation').append(button);
 }
 const shortcut=state.shortcuts?.compose?formatAccelerator(state.shortcuts.compose,state.host?.platform):t('未设置快捷键','No shortcut');
 $('shortcut-hint').textContent=shortcut;$('shortcut-hint').onclick=()=>{page='settings';render();};
 $('account-nav').textContent=state.account?.name??t('连接账号','Connect account');$('account-nav').onclick=()=>{page='settings';render();};
 $('notice').hidden=!state.host?.preview&&!state.host?.issue;
 $('notice').textContent=state.host?.preview?t('界面预览，不会发送消息','Preview. Messages are not sent.'):errorMessages[state.host?.issue]?t(...errorMessages[state.host.issue]):t('请检查账号连接。','Check the account connection.');
}
function renderMain(){const content=$('content');content.replaceChildren();if(page==='inbox')renderInbox(content);else if(page==='settings')renderSettings(content);else renderChat(content);}
function renderChat(content){
 if(!state.bots.length){
  const panel=el('div','empty');panel.append(el('h1','',t('你的 Bot','Your Bots')),el('p','',t('连接账号后，从左边点一个 Bot，在下面把内容发给它。','Connect an account, pick a Bot, and send from the box below.')));
  const actions=el('div','row-actions');actions.append(loginButton());if(state.host?.platform==='darwin')actions.append(smallButton(t('使用本机登录','Use local login'),()=>api.desktopLogin()));panel.append(actions);content.append(panel);return;
 }
 const bot=state.bots.find(item=>item.id===selected),recipient=recipientOf(bot.id);
 const head=el('div','chat-head'),copy=el('div','chat-copy'),titles=el('div','chat-titles');
 titles.append(el('h1','bot-title',bot.name),el('div','subtle',bot.description||t('把文件和对话交给这个 Bot','Send files and notes to this Bot')));
 copy.append(avatar(bot,36),titles);
 const actions=el('div','head-actions');actions.append(smallButton(t('开始对话','Start'),()=>api.compose(bot.id),'primary'),el('span',`dot ${state.connected?'connected':''}`),smallButton(t('同步','Sync'),async()=>{state=await api.refresh();render();}));
 head.append(copy,actions);content.append(head);
 const card=el('section','settings-card'),line=el('div','setting-line');line.append(el('span','group-label',t('接收转发','Receive forwards')));
 const enabled=el('input','switch');enabled.type='checkbox';enabled.checked=!!recipient?.enabled;enabled.setAttribute('aria-label',t(`让 ${bot.name} 接收转发`,`Let ${bot.name} receive forwards`));
 enabled.addEventListener('change',()=>run(()=>api.configure(bot.id,{enabled:enabled.checked})));line.append(enabled);card.append(line);
 if(recipient?.enabled){
  const mode=el('div','segment');mode.setAttribute('aria-label',t('收到之后','After receiving'));
  for(const [value,label] of [['compose',t('先放进输入框','Open in composer')],['direct',t('直接发送','Send directly')]]){
   const choice=el('button',value===recipient.mode?'selected':'',label);choice.type='button';choice.addEventListener('click',()=>run(()=>api.configure(bot.id,{mode:value})));mode.append(choice);
  }
  const sources=el('div','sources');
  for(const [key,label] of [['wechat',t('微信','WeChat')],['drop',t('拖放','Drop')],['shortcuts',t('快捷键','Shortcut')],['share',t('系统分享','System share')]]){
   const chip=el('button',`source-chip${recipient.sources[key]?' selected':''}`,label);chip.type='button';chip.setAttribute('aria-pressed',String(!!recipient.sources[key]));
   if(key==='share')chip.title=t('选择会保存。单独的系统分享扩展还没装上，微信转发用「微信」。','This choice is saved. The separate system share extension is not installed; WeChat uses WeChat.');
   if(key==='shortcuts')chip.title=t('全局快捷键优先打开勾选了这一项的 Bot。','The global shortcut prefers Bots with this on.');
   chip.addEventListener('click',()=>run(()=>api.configure(bot.id,{sources:{[key]:!recipient.sources[key]}})));sources.append(chip);
  }
  const orders=el('div','order-buttons');
  orders.append(smallButton(t('前移','Earlier'),()=>moveBot(bot.id,-1)),smallButton(t('后移','Later'),()=>moveBot(bot.id,1)));
  card.append(mode,sources,orders);
  if(recipient.mode==='direct'){
   const prefix=el('input','prefix');prefix.placeholder=t('直接发送时加在正文前','Prefix for direct sends');prefix.setAttribute('aria-label',prefix.placeholder);prefix.value=recipient.prefix;
   prefix.addEventListener('change',()=>run(()=>api.configure(bot.id,{prefix:prefix.value})));card.append(prefix);
  }
  card.append(el('p','hint',t('前移、后移决定微信菜单顺序，最多 12 个。','Earlier and later set the WeChat menu order, up to 12.')));
 }else card.append(el('p','hint',t('打开后，微信、拖放和快捷键才会把内容交给这个 Bot。','Turn this on before WeChat, drops, or the shortcut deliver here.')));
 content.append(card);
 const thread=el('div','thread');
 const history=[...state.inbox].filter(item=>item.botId===bot.id).sort((a,b)=>a.createdAt-b.createdAt);
 for(const item of history){
  if(item.text||item.files?.length){
   const bubble=el('div','bubble user');if(item.text)bubble.append(document.createTextNode(item.text));
   for(const file of item.files??[])bubble.append(el('span','file',file.name));thread.append(bubble);
   const meta=el('div','meta',['uploading','sending'].includes(item.phase)?t('正在发送','Sending'):statusLabel(item));thread.append(meta);
  }
  for(const reply of item.replies??[])thread.append(el('div','bubble bot',reply.text));
  if(item.status==='needs-input')thread.append(smallButton(t('放入输入框','Open in composer'),()=>api.openReceipt(item.id)));
  if(item.status==='failed')thread.append(smallButton(t('重试','Retry'),()=>api.retry(item.id)));
  if(item.status==='unconfirmed'&&!item.holdResolved)thread.append(smallButton(t('已核对，恢复发送','Checked, unlock sending'),()=>api.resolve(item.id)));
 }
 if(!history.length){const shortcut=state.shortcuts?.compose?formatAccelerator(state.shortcuts.compose,state.host?.platform):t('快捷键','the shortcut');thread.append(el('p','empty-thread',t(`按 ${shortcut}，或点「开始对话」。`,`Press ${shortcut}, or choose Start.`)));}
 content.append(thread);
}
function statusLabel(item){return {sent:t('已发送','Sent'),unconfirmed:t('未确认','Unconfirmed'),failed:t('失败','Failed'),expired:t('过期','Expired'),'needs-input':t('待发送','Waiting')}[item.status]??item.status;}
function renderInbox(content){
 content.append(el('h1','page-title',t('收件','Inbox')));
 if(!state.inbox.length){content.append(el('p','subtle',t('还没有收件。','Nothing here yet.')));return;}
 for(const item of state.inbox){
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
  content.append(row);
 }
}
function renderSettings(content){
 content.append(el('h1','page-title',t('设置','Settings')));
 const account=el('section','group'),accountRow=el('div','group-row'),name=el('div');
 name.append(el('div','group-label',state.account?.name??t('尚未连接','Not connected')),el('div','group-help',state.connected?t('账号已连接','Connected'):t('登录后同步 Bot','Sign in to sync Bots')));
 const actions=el('div','row-actions');
 if(state.connected)actions.append(smallButton(t('退出','Sign out'),()=>api.logout()));
 else{actions.append(loginButton());if(state.host?.platform==='darwin')actions.append(smallButton(t('本机登录','Local login'),()=>api.desktopLogin()));}
 accountRow.append(name,actions);account.append(accountRow);content.append(account);
 const appearance=el('section','group'),themeRow=el('div','group-row');themeRow.append(el('span','group-label',t('外观','Appearance')));
 const themes=el('div','segment');
 for(const [value,label] of [['system',t('系统','System')],['light',t('白','Light')],['dark',t('黑','Dark')]]){
  const choice=el('button',state.theme===value?'selected':'',label);choice.type='button';choice.addEventListener('click',()=>run(()=>api.theme(value)));themes.append(choice);
 }
 themeRow.append(themes);appearance.append(themeRow);content.append(appearance);
 const keys=el('section','group'),keyRow=el('div','group-row'),keyCopy=el('div');
 keyCopy.append(el('div','group-label',t('打开输入框','Open composer')),el('div','group-help',t('点右边的按键，再按下想用的组合。Esc 取消。','Click the key, then press a combination. Esc cancels.')));
 const keyActions=el('div','row-actions');
 const cap=el('button',`keycap${recording?' recording':''}`,recording?t('请按键','Press keys'):(state.shortcuts?.compose?formatAccelerator(state.shortcuts.compose,state.host?.platform):t('未设置','None')));
 cap.type='button';cap.addEventListener('click',()=>{if(recording)void finishRecording(null);else void beginRecording();});
 keyActions.append(cap,smallButton(t('清除','Clear'),()=>api.setShortcut('compose','')));
 keyRow.append(keyCopy,keyActions);keys.append(keyRow);content.append(keys);
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
 dismissRow.append(dismissCopy,dismiss);behavior.append(dismissRow);content.append(behavior);
 if(state.host?.platform==='darwin'){
  const menu=state.host.menu??{},panel=el('section','group'),row=el('div','group-row'),info=el('div');
  info.append(el('div','group-label',t('微信转发','WeChat')),el('div','group-help',!menu.available?t('这个版本没有分享扩展','Sharing extensions are not in this build'):menu.busy?t('正在同步菜单','Syncing the menu'):menu.needsUpdate?t('设置已保存，正在同步','Saved. Syncing the menu.'):t(`已启用 ${menu.registered??0} 个入口`,`${menu.registered??0} destinations on`)));
  const update=smallButton(t('重新同步','Sync again'),async()=>{update.disabled=true;try{const result=await api.updateMenu();toast(t(`已同步 ${result.registered} 个入口`,`Synced ${result.registered} destinations`));}finally{update.disabled=false;}});
  update.disabled=!menu.available||menu.busy;row.append(info,update);panel.append(row);content.append(panel);
 }
}
function loginButton(){return smallButton(busy?t('正在登录…','Signing in…'):t('连接账号','Connect'),async()=>{busy=true;render();try{await api.login();}finally{busy=false;render();}},'primary');}
function smallButton(text,action,className='text-button'){const button=el('button',className,text);button.type='button';button.addEventListener('click',()=>run(action));return button;}
async function moveBot(id,delta){
 const ids=orderedBots().map(bot=>bot.id),index=ids.indexOf(id),next=index+delta;
 if(index<0||next<0||next>=ids.length)return;
 const order=ids.slice();const [moved]=order.splice(index,1);order.splice(next,0,moved);
 for(let position=0;position<order.length;position++)if((recipientOf(order[position])?.order??0)!==position)await api.configure(order[position],{order:position});
}
async function beginRecording(){recording=true;render();try{await api.suppressShortcuts(true);}catch{recording=false;render();}}
async function finishRecording(accelerator){
 if(!recording&&accelerator==null)return;recording=false;
 try{if(accelerator)await api.setShortcut('compose',accelerator);}finally{try{await api.suppressShortcuts(false);}catch{}render();}
}
$('search').addEventListener('input',()=>{search=$('search').value;render();});
window.addEventListener('keydown',event=>{
 if(!recording)return;
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
