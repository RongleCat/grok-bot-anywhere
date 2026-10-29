import {createAvatar} from 'grok-bot-avatar-engine';
const api=window.anywhere;
let state,page='bots',search='',avatars=[],busy=false,toastTimer;
const chinese=()=>state?.host?.locale?.startsWith('zh')??navigator.language.startsWith('zh');
const t=(cn,en)=>chinese()?cn:en;
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action,className='secondary')=>{const b=el('button',className,text);b.type='button';b.addEventListener('click',()=>run(action));return b;};
const errorMessages={
 NATIVE_COMPOSER_UNAVAILABLE:['原生输入框尚未就绪，请先构建并启动原生伴侣。','The native composer is not ready. Build and start the companion first.'],
 SOURCE_DISABLED:['请先在设置中为此 Bot 开启接收和拖放来源。','Enable this recipient and its drag-and-drop source in Settings.'],
 LOGIN_REQUIRED:['请登录后发送。内容已保存在本地。','Sign in to send. Your context is saved locally.'],
 BOT_SEND_HELD:['此 Bot 有未确认的发送，请先核对收件记录。','This Bot has an unconfirmed send. Check your inbox first.'],
 PREVIEW_ONLY:['当前是预览，不能发送消息。','Messages cannot be sent in preview.'],
 DELIVERY_IN_PROGRESS:['投递仍在后台处理，请稍后再操作。','Delivery is still running. Please wait before trying again.'],
 ACCOUNT_BUSY:['账号操作正在进行。','An account operation is in progress.'],
 RECEIPT_NOT_SENDABLE:['这条收件当前不能发送，请检查状态。','This item cannot be sent in its current state.'],
 REQUEST_TIMEOUT:['操作超时，请检查收件记录中的结果。','The operation timed out. Check its result in Inbox.'],
 CREDENTIAL_STORAGE_UNAVAILABLE:['系统凭据存储暂不可用，请稍后重试。','System credential storage is unavailable. Try again later.'],
 SERVICE_EXITED:['后台服务已停止，请重新打开应用。','The background service stopped. Reopen the app.']
 ,MENU_RECIPIENT_REQUIRED:['请先为接收单位开启微信来源。','Enable WeChat for a recipient first.']
 ,MENU_UPDATE_FAILED:['微信菜单更新失败，原菜单已保留。请重试。','The forwarding menu could not be updated. Please try again.']
 ,MENU_UNAVAILABLE:['请使用包含分享扩展的 Mac 安装包。','Use the Mac build that includes sharing extensions.']
 ,DRAFT_BUSY:['该 Bot 有尚未发送的草稿，新内容已留在收件记录。','This Bot already has a draft. The new context is saved in Inbox.']
};
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
async function run(action){try{await action();}catch(error){const code=error.message;const pair=errorMessages[code];toast(pair?t(...pair):t('操作未完成，请重试。','The operation did not complete. Please try again.'));}}
function avatar(bot,size=48){
 const target=el('div','avatar');target.style.width=target.style.height=`${size}px`;
 if(bot.avatar?.kind==='picture'&&bot.avatar.picture?.url){
  const image=el('img');try{const url=new URL(bot.avatar.picture.url);if(!['https:','data:'].includes(url.protocol))throw new Error();image.src=url.href;image.alt='';target.append(image);return target;}catch{}
 }
 requestAnimationFrame(()=>{if(!target.isConnected)return;avatars.push(createAvatar(target,{agentId:bot.id,shape:bot.avatarShape,color:bot.avatarColor,size,main:state.runtime?.mainAgentId===bot.id,state:state.runtime?.statuses?.some(r=>r.agentId===bot.id&&r.isRunning)?'working':'idle',theme:state.theme==='system'?'auto':state.theme,reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches}));});
 return target;
}
function heading(title,subtitle,action){const wrapper=el('div','page-heading'),text=el('div');text.append(el('h1','',title),el('p','subtle',subtitle));wrapper.append(text);if(action)wrapper.append(action);return wrapper;}
function loginButton(){return button(busy?t('正在等待登录…','Waiting for sign-in…'):t('连接 Grok Bot 账号','Connect Grok Bot'),async()=>{busy=true;render();try{await api.login();}finally{busy=false;render();}},'primary');}
function render(){
 for(const handle of avatars)handle.destroy();avatars=[];
 document.documentElement.lang=chinese()?'zh-CN':'en';document.documentElement.dataset.theme=state.theme;
 $('navigation').replaceChildren();
 for(const [id,icon,label] of [['bots','◉',t('所有 Bots','All Bots')],['inbox','▤',t('收件记录','Inbox')],['settings','⚙',t('设置','Settings')]]){
  const b=button('',()=>{page=id;render();},`nav-button ${page===id?'selected':''}`);b.setAttribute('aria-current',page===id?'page':'false');b.append(el('span','nav-icon',icon),el('span','',label));$('navigation').append(b);
 }
 $('breadcrumb').textContent=page==='bots'?t('工作空间 / 所有 Bots','Workspace / All Bots'):page==='inbox'?t('工作空间 / 收件记录','Workspace / Inbox'):t('工作空间 / 设置','Workspace / Settings');
 $('connection').replaceChildren(el('span',`dot ${state.connected?'connected':''}`),el('span','',state.connected?t('已连接','Connected'):t('未连接','Disconnected')));
 $('account-nav').textContent=state.account?.name??t('连接账号','Connect account');$('account-nav').onclick=()=>{page='settings';render();};
 $('shortcut-label').textContent=t('随时打开输入框','Open the composer anywhere');
 $('notice').hidden=!state.host?.preview&&!state.host?.issue;
 $('notice').textContent=state.host?.preview?t('界面预览 · 示例数据，不会发送消息','Preview · Sample data, no messages will be sent'):errorMessages[state.host?.issue]?t(...errorMessages[state.host.issue]):t('请检查账号连接后重试。','Check your account connection and try again.');
 const content=$('content');content.replaceChildren();
 if(page==='bots')renderBots(content);else if(page==='settings')renderSettings(content);else renderInbox(content);
 document.documentElement.dataset.ready='true';
}
function renderBots(content){
 content.append(heading(t('你的 Bots','Your Bots'),t('选择一个伙伴，继续手头的事。','Pick a companion. Keep your work moving.'),button(t('同步名单','Refresh'),async()=>{state=await api.refresh();render();})));
 if(!state.bots.length){
  const panel=el('div','panel empty'),mark=avatar({id:'welcome',avatarShape:'cloud',avatarColor:'brown'},94);mark.classList.add('empty-avatar');
  panel.append(mark,el('h2','',t('让你的 Bot 随处可达','Your Bot, wherever you work')),el('p','',t('连接账号，把聊天、文件和灵感交给熟悉的 Bot。','Connect your account and bring conversations, files and ideas to your Bots.')));
  const actions=el('div','actions');actions.append(loginButton());panel.append(actions);content.append(panel);return;
 }
 const input=el('input','search');input.type='search';input.placeholder=t('搜索 Bot…','Search Bots…');input.setAttribute('aria-label',input.placeholder);input.value=search;
 const list=el('div','panel');const draw=()=>{
  for(const handle of avatars)handle.destroy();avatars=[];
  list.replaceChildren();
  for(const bot of state.bots.filter(bot=>bot.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))){
   const row=el('div','bot-row'),info=el('div','bot-info');info.append(el('div','bot-name',bot.name),el('div','bot-description',bot.description||t('随时接住你的下一步','Ready for your next idea')));
   row.append(avatar(bot),info);
   const recipient=state.recipients.find(r=>r.botId===bot.id);if(recipient?.enabled)row.append(el('span','recipient-label',t('接收已开启','Receiving enabled')));
   row.append(button(t('开始对话','Open composer'),()=>api.compose(bot.id),'row-action'));
   row.addEventListener('dragover',event=>{event.preventDefault();row.classList.add('drop-active');});row.addEventListener('dragleave',()=>row.classList.remove('drop-active'));
   row.addEventListener('drop',event=>{event.preventDefault();row.classList.remove('drop-active');void run(()=>api.dropFiles(bot.id,[...event.dataTransfer.files]));});
   list.append(row);
  }
 };
 input.addEventListener('input',()=>{search=input.value;draw();});draw();content.append(input,list,el('div','drop-hint',t('把文件拖到对应 Bot，按接收设置投递','Drop files onto a Bot to use its delivery settings')));
}
function renderSettings(content){
 content.append(heading(t('设置','Settings'),t('决定谁来接收，以及收到之后怎么做。','Choose who receives your context, and what happens next.')));
 const account=el('section','panel');account.append(el('div','panel-title',t('账号','Account')));
 const detail=el('div','account-detail'),name=el('div');name.append(el('div','account-name',state.account?.name??t('尚未连接','Not connected')),el('div','subtle',state.connected?t('账号已连接','Your account is connected'):t('登录后同步你的 Bot 名单','Sign in to sync your Bots')));
 const actions=el('div','actions');if(state.connected)actions.append(button(t('退出账号','Sign out'),()=>api.logout()));else{
  actions.append(loginButton());if(state.host?.platform==='darwin')actions.append(button(t('使用本机 Grok Bot 登录','Use local Grok Bot login'),()=>api.desktopLogin()));
 }detail.append(name,actions);account.append(detail);content.append(account);
 const appearance=el('section','panel'),row=el('div','setting');row.append(el('span','setting-label',t('外观','Appearance')));
 const select=el('select');select.setAttribute('aria-label',t('外观','Appearance'));for(const [value,label] of [['system',t('跟随系统','System')],['light',t('亮色','Light')],['dark',t('暗色','Dark')]]){const option=el('option','',label);option.value=value;select.append(option);}select.value=state.theme;select.onchange=()=>run(()=>api.theme(select.value));row.append(select);appearance.append(row);content.append(appearance);
 if(state.host?.platform==='darwin'){
  const panel=el('section','panel'),menu=state.host.menu??{},info=el('div'),line=el('div','account-detail');
  info.append(el('h2','',t('微信转发菜单','WeChat forwarding menu')),el('p','subtle',!menu.available?t('此版本尚未包含分享扩展','This build does not include sharing extensions'):menu.busy?t('正在自动同步菜单…','Syncing menu automatically…'):menu.error?t('菜单同步失败，请点击重新同步','Menu sync failed. Click to retry.'):menu.needsUpdate?t('接收设置已保存，正在同步微信菜单','Recipient settings saved. Syncing the WeChat menu.'):t(`已启用 ${menu.registered} 个微信入口`,`${menu.registered} WeChat destinations enabled`)));
  const updateButton=button(t('更新微信转发菜单','Update forwarding menu'),async()=>{
   updateButton.disabled=true;
   try{
    const result=await api.updateMenu();toast(t(`已同步 ${result.registered} 个入口。请重新打开微信的转发菜单。`,`${result.registered} destinations synced. Reopen the WeChat forwarding menu.`));
   }finally{updateButton.disabled=false;}
  });updateButton.disabled=!menu.available||menu.busy;line.append(info,updateButton);panel.append(line);content.append(panel);
 }
 if(!state.bots.length)return;
 content.append(el('div','divider-label',t('接收单位','Recipients')));
 for(const bot of [...state.bots].sort((a,b)=>(state.recipients.find(r=>r.botId===a.id)?.order??0)-(state.recipients.find(r=>r.botId===b.id)?.order??0))){
  const r=state.recipients.find(r=>r.botId===bot.id),panel=el('section','panel'),top=el('div','bot-row'),info=el('div','bot-info');info.append(el('div','bot-name',bot.name),el('div','subtle',t('可作为接收单位','Available as a recipient')));
  const enabled=el('input','switch');enabled.type='checkbox';enabled.checked=r.enabled;enabled.setAttribute('aria-label',t(`启用 ${bot.name}`,`Enable ${bot.name}`));enabled.onchange=()=>run(()=>api.configure(bot.id,{enabled:enabled.checked}));top.append(avatar(bot),info,enabled);panel.append(top);
  if(r.enabled){const options=el('div','recipient-options'),mode=el('select');mode.setAttribute('aria-label',t('收到之后','After receiving'));
   for(const [value,label] of [['compose',t('先放进输入框','Open in composer')],['direct',t('直接发送','Send directly')]]){const o=el('option','',label);o.value=value;mode.append(o);}mode.value=r.mode;mode.onchange=()=>run(()=>api.configure(bot.id,{mode:mode.value}));options.append(mode);
   const sources=el('div','source-options');for(const [key,label] of [['wechat',t('微信','WeChat')],['shortcuts',t('快捷指令（尚未接入）','Shortcuts (coming soon)')],['share',t('系统分享（尚未接入）','System sharing (coming soon)')],['drop',t('拖放','Drag and drop')]]){const labelNode=el('label'),check=el('input');check.type='checkbox';check.checked=r.sources[key];check.disabled=key==='shortcuts'||key==='share';check.onchange=()=>run(()=>api.configure(bot.id,{sources:{[key]:check.checked}}));labelNode.append(check,document.createTextNode(label));sources.append(labelNode);}options.append(sources);
   if(r.mode==='direct'){const prefix=el('input','prefix');prefix.placeholder=t('发送前缀（可选）','Message prefix (optional)');prefix.setAttribute('aria-label',prefix.placeholder);prefix.value=r.prefix;prefix.onchange=()=>run(()=>api.configure(bot.id,{prefix:prefix.value}));options.append(prefix);}panel.append(options);
  }content.append(panel);
 }
 content.append(el('p','footnote',t('微信入口最多 12 个；接收对象、名称和头像变更会自动同步。','Up to 12 WeChat destinations. Recipient, name and avatar changes sync automatically.')));
}
function renderInbox(content){
 content.append(heading(t('收件记录','Inbox'),t('传进来的上下文，都留在这里。','A place for every piece of context.')));
 if(!state.inbox.length){const panel=el('div','panel empty');panel.append(el('h2','',t('还没有收件','Nothing here yet')),el('p','',t('启用一个接收单位，然后把文件拖到它的名字上。','Enable a recipient, then drop a file onto its name.')));content.append(panel);return;}
 const statuses={'needs-input':t('待补充','Needs input'),sent:t('已发送','Sent'),unconfirmed:t('未确认','Unconfirmed'),failed:t('失败','Failed'),expired:t('过期','Expired')};
 for(const item of state.inbox){
  const panel=el('article','panel records'),head=el('div','record-head'),label=el('div');label.append(el('h2','',item.title||item.botName),el('div','record-meta',`${item.botName} · ${new Date(item.createdAt).toLocaleString(document.documentElement.lang)}`));
  head.append(label,el('span',`status ${item.status}`,['uploading','sending'].includes(item.phase)?t('正在发送','Sending'):item.mode==='direct'&&item.status==='needs-input'?t('待发送','Pending'):statuses[item.status]));panel.append(head);
  if(item.text)panel.append(el('p','record-text',item.text));
  const files=el('div','files');for(const file of item.files)files.append(el('span','file',`${file.name} · ${(file.bytes/1024/1024).toFixed(1)} MB`));panel.append(files);
  if(item.status==='needs-input')panel.append(button(t('补充后发送','Open composer'),()=>api.openReceipt(item.id)));
  if(item.status==='failed')panel.append(button(t('重试','Retry'),()=>api.retry(item.id)));
  if(item.status==='unconfirmed'){
   panel.append(el('p','subtle',item.holdResolved?t('已核对并恢复发送。此条不会重发。','Checked and unlocked. This item will not be resent.'):t('请在 Grok Bot 核对发送结果，此条不会自动重发。','Check delivery in Grok Bot. This item will not be resent automatically.')));
   if(!item.holdResolved)panel.append(button(t('已核对，恢复发送','Checked, unlock sending'),()=>api.resolve(item.id)));
  }
  for(const reply of item.replies??[])panel.append(el('p','reply',reply.text));content.append(panel);
 }
}
api.onChange(message=>{if(message.event==='state'){state=message.data;render();}});
try{state=await api.state();render();}catch{toast(t('应用启动失败，请重新打开。','The app could not start. Please reopen it.'));}
