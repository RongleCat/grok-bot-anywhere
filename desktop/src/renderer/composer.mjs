import {createAvatar} from 'grok-bot-avatar-engine';
import {cutoutStack,groupMembers,listedBots,placeStack,stackPlan} from './group-avatar.mjs';
import {acceptLateFiles,composerAfterSend} from '../shell/actions.mjs';
const api=window.anywhere;
const part=new URLSearchParams(location.search).get('part')||'card';
const columns=10;
let state,picking=false,pickIndex=0,sending=false,focus=false,lastHit=null,toastTimer,avatarKey='',placed='',pickerStamp='',cardStamp='',fileToken,queuedFiles=null;
const handles=[],pickerHandles=[];
const field=document.createElement('textarea');field.className='composer-input';field.rows=1;field.addEventListener('input',()=>{draft.text=field.value;fileToken=null;queuedFiles=null;grow(field);const send=document.querySelector('.send');if(send)send.disabled=sending||!canSend();reportSize();});field.addEventListener('keydown',onKey);
const draft={botId:'',text:'',paths:[],names:[],receiptId:null,remote:[]};
const $=id=>document.getElementById(id);
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const chinese=()=>state?.host?.locale?.startsWith('zh')??navigator.language.startsWith('zh');
const t=(cn,en)=>chinese()?cn:en;
const prefs=()=>state?.composerPrefs??{afterSend:'hide',dismissOnOutside:true};
const ordered=()=>{
 if(!state)return [];
 const visible=new Set(listedBots(state.bots).map(bot=>bot.id));
 return state.bots.map((bot,index)=>({bot,index,order:state.recipients.find(item=>item.botId===bot.id)?.order??0})).filter(item=>visible.has(item.bot.id)).sort((a,b)=>a.order-b.order||a.index-b.index).map(item=>item.bot);
};
const errors={
 PREVIEW_ONLY:['当前是预览，不能发送。','Messages cannot be sent in preview.'],
 RECEIPT_EMPTY:['先写一点内容，或加上文件。','Write something or add a file.'],
 LOGIN_REQUIRED:['请登录后发送。','Sign in to send.'],
 SEND_UNCONFIRMED:['发送结果未确认，请到发送记录里核对。','Delivery was not confirmed. Check Send history.'],
 SEND_FAILED:['没有发出去，请到发送记录里重试。','Delivery failed. Retry it from Send history.'],
 BOT_SEND_HELD:['这个 Bot 有一条未确认的发送，请先到发送记录里核对。','This Bot has an unconfirmed send. Check Send history first.']
};
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function lucide(paths){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('width','16');node.setAttribute('height','16');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','2');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('aria-hidden','true');for(const d of paths){const shape=document.createElementNS('http://www.w3.org/2000/svg','path');shape.setAttribute('d',d);node.append(shape);}return node;}
function paintOne(bot,size,reducedMotion,bucket=handles){
 const target=el('div','avatar');target.style.width=target.style.height=`${size}px`;
 if(bot.avatar?.kind==='picture'&&bot.avatar.picture?.url){
  try{const url=new URL(bot.avatar.picture.url);if(['https:','data:'].includes(url.protocol)){const image=el('img');image.src=url.href;image.alt='';target.append(image);return target;}}catch{}
 }
 requestAnimationFrame(()=>{if(!target.isConnected)return;const handle=createAvatar(target,{agentId:bot.id,shape:bot.avatarShape,color:bot.avatarColor,size,main:!reducedMotion&&state.runtime?.mainAgentId===bot.id,state:reducedMotion?'idle':state.runtime?.statuses?.some(row=>row.agentId===bot.id&&row.isRunning)?'working':'idle',theme:state.theme==='system'?'auto':state.theme,reducedMotion:reducedMotion||matchMedia('(prefers-reduced-motion:reduce)').matches});bucket.push(handle);});
 return target;
}
function paintFace(bot,size,reducedMotion=false,bucket=handles){
 const members=groupMembers(bot,state?.bots??[]);
 if(members.length<2)return paintOne(members[0]??bot,size,reducedMotion,bucket);
 const plan=stackPlan(members),root=el('div','avatar-stack');
 root.style.width=root.style.height=`${size}px`;root.dataset.count=String(plan.count);
 const faceSize=Math.round(size*plan.ratio);
 const add=node=>{const face=el('div','stack-face');face.append(node);root.append(face);return face;};
 if(plan.extra){const badge=add(el('span','stack-more',`+${plan.extra}`));badge.style.fontSize=`${(faceSize*0.34).toFixed(1)}px`;}
 for(const member of plan.shown)add(paintOne(member,faceSize,true,bucket));
 placeStack(root);root.__cutout=cutoutStack(root);
 return root;
}
function paintAvatar(bot){
 const key=`${bot.id}:${state.theme}:${state.runtime?.mainAgentId===bot.id}:${(bot.memberAgentIds??[]).join('|')}`;
 const host=$('avatar');
 if(avatarKey===key&&host.childElementCount)return;
 avatarKey=key;host.querySelector('.avatar-stack')?.__cutout?.();host.replaceChildren();
 for(const handle of handles)handle.destroy();handles.length=0;
 host.append(paintFace(bot,88));
}
function movePick(dx,dy){
 const bots=ordered(),count=bots.length;if(!count)return;
 if(dx){const next=pickIndex+dx;if(next>=0&&next<count)pickIndex=next;return;}
 const column=pickIndex%columns,next=pickIndex+dy*columns;
 if(next>=0&&next<count)pickIndex=next;
 else if(dy>0&&Math.floor(pickIndex/columns)<Math.floor((count-1)/columns))pickIndex=Math.min(count-1,Math.floor((count-1)/columns)*columns+column);
}
function confirmPick(){
 const bots=ordered();
 if(!picking||!bots[pickIndex]){picking=false;render();return;}
 const bot=bots[pickIndex];
 picking=false;
 if(bot.id!==draft.botId){draft.botId=bot.id;draft.receiptId=null;draft.remote=[];fileToken=null;queuedFiles=null;}
 void api.noteBot(bot.id).catch(()=>{});
 render();
}
function mergePaths(paths){
 for(const path of paths??[]){if(typeof path!=='string'||!path||draft.paths.includes(path)||draft.paths.length+draft.remote.length>=100)continue;draft.paths.push(path);draft.names.push(path.split(/[\\/]/).pop());}
}
function applyPayload(data){
 if(!data?.botId)return;
 if(data.id){draft.botId=data.botId;draft.receiptId=data.id;draft.text=data.text??'';draft.remote=data.files??[];draft.paths=[];draft.names=[];}
 else{
  if(data.botId!==draft.botId){draft.botId=data.botId;draft.receiptId=null;draft.remote=[];}
  if(typeof data.text==='string'){draft.botId=data.botId;draft.text=data.text;draft.receiptId=null;draft.remote=[];draft.paths=[];draft.names=[];}
  mergePaths(data.localPaths);
 }
 fileToken=data.attachToken??null;
 const waiting=queuedFiles;queuedFiles=null;
 if(waiting)acceptComposerFiles(waiting,false);
 picking=false;focus=true;
}
function acceptComposerFiles(data,paint){
 if(fileToken===undefined){queuedFiles=data;return;}
 const paths=acceptLateFiles({token:data?.token,current:fileToken,botId:data?.botId,currentBotId:draft.botId,paths:data?.localPaths});
 if(!paths.length)return;
 mergePaths(paths);
 if(paint)render();
}
function grow(field){field.style.height='auto';field.style.height=`${Math.min(160,Math.max(22,field.scrollHeight))}px`;}
function box(node){
 if(!node||node.hidden)return null;
 const rect=node.getBoundingClientRect();
 if(rect.width<8||rect.height<8)return null;
 return {x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)};
}
function reportSize(){
 if(part==='picker'){
  const node=$('picker');if(!node||node.hidden)return;
  const height=Math.ceil(node.getBoundingClientRect().height);
  const key=`picker:${height}`;
  if(key===placed||height<8)return;placed=key;
  void api.placeComposer(760,height,{part:'picker'}).catch(()=>{});
  return;
 }
 if(part!=='card')return;
 const card=$('card');if(!card)return;
 const rect=card.getBoundingClientRect();
 const width=Math.ceil(rect.width),height=Math.ceil(rect.height);
 const key=`card:${width}x${height}:${picking}:${pickIndex}`;
 if(key===placed||height<8)return;placed=key;
 void api.placeComposer(width,height).catch(()=>{});
 void api.syncPicker({open:picking,index:pickIndex}).catch(()=>{});
}
function canSend(){return !!(draft.text.trim()||draft.paths.length||draft.remote.length);}
function renderPicker(bots){
 const picker=$('picker');
 const stamp=`${picking}:${pickIndex}:${state.theme}:${bots.map(bot=>`${bot.id}:${(bot.memberAgentIds??[]).join(',')}`).join('|')}`;
 if(stamp===pickerStamp)return;
 pickerStamp=stamp;
 for(const handle of pickerHandles)handle.destroy();pickerHandles.length=0;
 picker.querySelectorAll('.avatar-stack').forEach(stack=>stack.__cutout?.());
 picker.replaceChildren();
 if(!picking)return;
 if(pickIndex>=bots.length)pickIndex=Math.max(0,bots.length-1);
 const grid=el('div','picker-grid');grid.setAttribute('role','listbox');
 const activeRow=Math.floor(pickIndex/columns);
 bots.forEach((item,index)=>{
  const cell=el('button',`pick${index===pickIndex?' selected':''}`);cell.type='button';cell.setAttribute('role','option');cell.setAttribute('aria-selected',String(index===pickIndex));
  if(Math.floor(index/columns)===activeRow)cell.append(el('span','pick-index',index%columns===9?'0':String(index%columns+1)));
  const face=paintFace(item,36,true,pickerHandles);
  cell.append(face,el('span','pick-name',item.name||t('未命名 Bot','Unnamed Bot')));
  cell.addEventListener('click',()=>{if(part==='picker'){void api.pickBot(item.id);return;}pickIndex=index;confirmPick();});
  grid.append(cell);
 });
 picker.append(grid,el('p','hint',t('1–0 选择当前行    − + 换行    回车或 Tab 确认    Esc 取消','1–0 picks this row, − + changes row, Enter or Tab confirms, Esc cancels')));
 const selected=grid.children[pickIndex];
 if(selected)selected.scrollIntoView({block:'nearest'});
}
function renderAvatar(){
 if(!state)return;
 document.documentElement.dataset.part='avatar';
 document.documentElement.dataset.theme=state.theme;
 const bot=ordered().find(item=>item.id===(draft.botId||state.activeBotId))||ordered()[0];
 if(!bot)return;
 draft.botId=bot.id;paintAvatar(bot);
 document.documentElement.dataset.ready='true';
}
function renderPickerOnly(){
 if(!state)return;
 document.documentElement.dataset.part='picker';
 document.documentElement.dataset.theme=state.theme;
 $('picker').hidden=!picking;
 renderPicker(ordered());
 document.documentElement.dataset.ready='true';
 if(picking)requestAnimationFrame(reportSize);
}
function render(){
 if(part==='avatar'){renderAvatar();return;}
 if(part==='picker'){renderPickerOnly();return;}
 if(!state)return;
 document.documentElement.lang=chinese()?'zh-CN':'en';
 document.documentElement.dataset.part='card';
 document.documentElement.dataset.theme=state.theme;
 const bots=ordered();
 if(!bots.some(bot=>bot.id===draft.botId)){const next=bots[0]?.id??'';if(next!==draft.botId){fileToken=null;queuedFiles=null;}draft.botId=next;}
 const bot=bots.find(item=>item.id===draft.botId);
 $('picker').hidden=true;$('avatar').hidden=true;
 const card=$('card');
 const held=bot?(state.inbox??[]).find(item=>item.botId===bot.id&&item.status==='unconfirmed'&&!item.holdResolved):null;
 const nextStamp=JSON.stringify([bot?.id??'',draft.names,draft.remote.map(file=>file.name),held?.id??'',prefs().dismissOnOutside,sending]);
 if(!bot){cardStamp='';card.replaceChildren();card.append(el('p','issue',t('登录后才能发送。','Sign in to send.')));$('avatar').replaceChildren();avatarKey='';reportSize();return;}
 if(nextStamp===cardStamp&&card.contains(field)){const send=card.querySelector('.send');if(send)send.disabled=sending||!canSend();if(field.value!==draft.text)field.value=draft.text;if(focus){focus=false;field.focus();}document.documentElement.dataset.ready='true';requestAnimationFrame(reportSize);return;}
 cardStamp=nextStamp;card.replaceChildren();
 paintAvatar(bot);
 field.placeholder=t('消息','Message');field.setAttribute('aria-label',t(`发给${bot.name}的消息`,`Message ${bot.name}`));
 if(field.value!==draft.text)field.value=draft.text;
 card.append(field);
 if(held){
  const line=el('p','hold');line.append(el('span','',t('上次投递尚未确认。','The last delivery is still unconfirmed. ')));
  const unlock=el('button','',t('解除暂停','Unlock'));unlock.type='button';unlock.addEventListener('click',()=>void api.resolve(held.id).catch(error=>toast(errors[error.message]?t(...errors[error.message]):t('没有完成。','That did not finish.'))));
  line.append(unlock);card.append(line);
 }
 const files=[...draft.remote.map(file=>({name:file.name})),...draft.names.map((name,index)=>({name,index}))];
 if(files.length){
  const chips=el('div','chips');
  for(const file of files){
   const chip=el('span','chip');chip.append(el('span','',file.name));
   if(file.index!==undefined){const remove=el('button','','×');remove.type='button';remove.setAttribute('aria-label',t('移除','Remove'));remove.addEventListener('click',()=>{draft.names.splice(file.index,1);draft.paths.splice(file.index,1);render();});chip.append(remove);}
   chips.append(chip);
  }
  card.append(chips);
 }
 const bar=el('div','toolbar');
 const attach=el('button','icon');attach.type='button';attach.setAttribute('aria-label',t('添加文件','Add files'));attach.append(lucide(['m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551']));
 attach.addEventListener('click',()=>void addPicked());
 const sendButton=el('button','send');sendButton.type='button';sendButton.setAttribute('aria-label',t('发送','Send'));sendButton.append(lucide(['m5 12 7-7 7 7','M12 19V5']));
 sendButton.disabled=sending||!canSend();sendButton.addEventListener('click',()=>void send());
 bar.append(attach,sendButton);
 if(!prefs().dismissOnOutside){const close=el('button','close');close.type='button';close.setAttribute('aria-label',t('收起','Close'));close.append(lucide(['M18 6 6 18','m6 6 12 12']));close.addEventListener('click',()=>void api.hideComposer());bar.append(close);}
 card.append(bar);
 card.ondragover=event=>event.preventDefault();
 card.ondrop=event=>{event.preventDefault();addPaths(api.filePaths([...event.dataTransfer.files]));};
 grow(field);
 if(focus){focus=false;field.focus();}
 document.documentElement.dataset.ready='true';
 requestAnimationFrame(reportSize);
}
function onKey(event){
 if(event.isComposing||event.keyCode===229)return;
 if(event.key==='Escape'){event.preventDefault();if(picking){picking=false;render();}else void api.hideComposer();return;}
 if(event.key==='Tab'&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
  event.preventDefault();
  if(picking)confirmPick();
  else if(ordered().length){pickIndex=Math.max(0,ordered().findIndex(bot=>bot.id===draft.botId));picking=true;render();}
  return;
 }
 if(picking&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
  if(event.key==='+'||event.key==='='){event.preventDefault();movePick(0,1);render();return;}
  if(event.key==='-'||event.key==='_'){event.preventDefault();movePick(0,-1);render();return;}
  if(!event.shiftKey&&event.key>='1'&&event.key<='9'){event.preventDefault();const next=Math.floor(pickIndex/columns)*columns+(Number(event.key)-1);if(ordered()[next]){pickIndex=next;confirmPick();}return;}
  if(!event.shiftKey&&event.key==='0'){event.preventDefault();const next=Math.floor(pickIndex/columns)*columns+9;if(ordered()[next]){pickIndex=next;confirmPick();}return;}
  if(event.key==='ArrowLeft'){event.preventDefault();movePick(-1,0);render();return;}
  if(event.key==='ArrowRight'){event.preventDefault();movePick(1,0);render();return;}
  if(event.key==='ArrowUp'){event.preventDefault();movePick(0,-1);render();return;}
  if(event.key==='ArrowDown'){event.preventDefault();movePick(0,1);render();return;}
 }
 if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(picking)confirmPick();else void send();}
}
function addPaths(paths){mergePaths(paths);render();}
async function addPicked(){try{addPaths(await api.pickFiles());}catch(error){toast(errors[error.message]?t(...errors[error.message]):t('没有选到文件。','No file was chosen.'));}}
async function send(){
 const bot=ordered().find(item=>item.id===draft.botId);
 if(!bot||sending||(!draft.text.trim()&&!draft.paths.length&&!draft.remote.length))return;
 sending=true;render();
 try{
  const result=await api.sendDraft(bot.id,draft.text,draft.paths,draft.receiptId);
  if(result?.status!=='sent')throw new Error(result?.status==='unconfirmed'?'SEND_UNCONFIRMED':result?.error||'SEND_FAILED');
  draft.text='';draft.paths=[];draft.names=[];draft.remote=[];draft.receiptId=null;
  const recipient=state?.recipients?.find(row=>row.botId===bot.id);
  const action=composerAfterSend(recipient,prefs());
  await api.hideComposer();
  if(action==='open'){try{await api.openBot(bot.id);}catch{}}
 }catch(error){toast(errors[error.message]?t(...errors[error.message]):t('没有发出去。','It was not sent.'));}
 finally{sending=false;focus=true;render();}
}
window.addEventListener('resize',()=>reportSize());
if(part==='avatar'){
 api.onChange(message=>{
  if(message.event==='state')state=message.data;
  if(message.event==='composer'&&message.data?.botId)draft.botId=message.data.botId;
  if(message.event==='state'&&state?.activeBotId)draft.botId=state.activeBotId;
  renderAvatar();
 });
}else if(part==='picker'){
 api.onChange(message=>{
  if(message.event==='state')state=message.data;
  if(message.event==='picker'){picking=!!message.data?.open;pickIndex=message.data?.index??pickIndex;placed='';}
  if(message.event==='composer')picking=false;
  renderPickerOnly();
 });
}else{
 api.onChange(message=>{
  if(message.event==='composer-files'){acceptComposerFiles(message.data,true);return;}
  if(message.event==='composer'){placed='';applyPayload(message.data);}
  if(message.event==='pick'&&message.data?.botId){const index=ordered().findIndex(bot=>bot.id===message.data.botId);if(index>=0)pickIndex=index;confirmPick();return;}
  if(message.event==='state')state=message.data;
  if(state)render();
 });
}
try{
 state=await api.state();
 if(part==='card'){const pending=await api.pendingComposer();if(pending)applyPayload(pending);}
 if(part==='avatar'){const pending=await api.pendingComposer();if(pending?.botId)draft.botId=pending.botId;else if(state?.activeBotId)draft.botId=state.activeBotId;}
 render();
}catch{document.documentElement.dataset.ready='true';}
