export const menuHostName='Grok Bot Anywhere Menu';
export const MENU_ID='dev.ronglecat.grokbotanywhere.menu';
export const destinationIdentifier=slot=>`${MENU_ID}.destination${String(slot).padStart(2,'0')}`;
export const slotIdentifier=slot=>`${destinationIdentifier(slot)}.share`;
export const legacySlotIdentifier=slot=>`${MENU_ID}.slot${String(slot).padStart(2,'0')}`;
export const destinationPath=(root,slot)=>`${root}/Contents/Helpers/Destination${String(slot).padStart(2,'0')}.app`;
export const slotExtensionPath=(root,slot)=>`${destinationPath(root,slot)}/Contents/PlugIns/GrokBotShare.appex`;
export function menuEntries(state){
  if(!state.account?.id||state.accountBusy)return [];
  return state.recipients.filter(r=>r.enabled&&r.sources.wechat).map((r,index)=>({r,index,bot:state.bots.find(b=>b.id===r.botId)})).filter(row=>row.bot)
    .sort((a,b)=>a.r.order-b.r.order||a.index-b.index).slice(0,12).map(({r,bot})=>({accountId:state.account.id,botId:bot.id,botName:bot.name||'Bot',sessionId:bot.sessionId??'',mode:r.mode,prefix:r.prefix,
      avatarKey:JSON.stringify([bot.avatarShape,bot.avatarColor,bot.avatar?.picture?.url,bot.avatar?.picture?.version,state.runtime?.mainAgentId===bot.id]),bot}));
}
export function menuPlan(state,installed){
  const desired=menuEntries(state),previous=installed?.entries??[];
  const existing=desired.map(e=>previous.find(p=>p.accountId===e.accountId&&p.botId===e.botId&&p.botName===e.botName&&p.avatarKey===e.avatarKey));
  const reuse=existing.every(Boolean)&&existing.every((e,i)=>i===0||e.slot>existing[i-1].slot);
  return reuse?{rebuild:false,entries:previous,enabledSlots:existing.map(e=>e.slot)}:{rebuild:true,entries:desired.map((e,i)=>({...e,slot:i+1})),enabledSlots:desired.map((_,i)=>i+1)};
}
export function shareConfiguration(state){return {version:1,accountId:state.accountBusy?null:state.account?.id??null,entries:menuEntries(state).map(({bot,...entry})=>entry)};}
