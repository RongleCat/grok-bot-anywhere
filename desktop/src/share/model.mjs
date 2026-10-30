export const menuHostName='Grok Bot Anywhere Menu';
export const MENU_ID='dev.ronglecat.grokbotanywhere.menu';
export const destinationIdentifier=slot=>`${MENU_ID}.destination${String(slot).padStart(2,'0')}`;
export const slotIdentifier=slot=>`${destinationIdentifier(slot)}.share`;
export const extensionIdentifier=(slot,generation=1)=>`${destinationIdentifier(slot)}.g${generation}.share`;
export const legacySlotIdentifier=slot=>`${MENU_ID}.slot${String(slot).padStart(2,'0')}`;
export function pluginIdentifier(installed,slot){
  if((installed?.layoutVersion??0)<2)return legacySlotIdentifier(slot);
  if((installed?.layoutVersion??0)<4)return slotIdentifier(slot);
  const entry=installed?.entries?.find(item=>item.slot===slot);
  return entry?.extensionId??extensionIdentifier(slot,entry?.generation??0);
}
export const destinationPath=(root,slot)=>`${root}/Contents/Helpers/Destination${String(slot).padStart(2,'0')}.app`;
export const slotExtensionPath=(root,slot)=>`${destinationPath(root,slot)}/Contents/PlugIns/GrokBotShare.appex`;
export function menuEntries(state){
  if(!state.account?.id||state.accountBusy)return [];
  return state.recipients.filter(r=>r.enabled&&r.sources.wechat).map((r,index)=>({r,index,bot:state.bots.find(b=>b.id===r.botId)})).filter(row=>row.bot)
    .sort((a,b)=>a.r.order-b.r.order||a.index-b.index).slice(0,12).map(({r,bot})=>({accountId:state.account.id,botId:bot.id,botName:bot.name||'Bot',sessionId:bot.sessionId??'',mode:r.mode,prefix:r.prefix,
      avatarKey:JSON.stringify([bot.avatarShape,bot.avatarColor,bot.avatar?.picture?.url,bot.avatar?.picture?.version,state.runtime?.mainAgentId===bot.id]),bot}));
}
export function menuPlan(state,installed){
  const desired=menuEntries(state),previous=installed?.entries??[],used=new Set();
  let changed=false;
  const assigned=desired.map(entry=>{
    const prior=previous.find(item=>item.accountId===entry.accountId&&item.botId===entry.botId&&item.slot);
    if(!prior){changed=true;return {...entry,slot:0,generation:1};}
    const same=prior.botName===entry.botName&&prior.avatarKey===entry.avatarKey;
    if(!same)changed=true;
    used.add(prior.slot);
    return {...entry,slot:prior.slot,generation:same?(prior.generation??1):(prior.generation??1)+1,extensionId:same?prior.extensionId:undefined};
  });
  for(const entry of assigned){
    if(entry.slot)continue;
    let slot=1;while(used.has(slot))slot++;
    if(slot>12){entry.slot=-1;continue;}
    entry.slot=slot;used.add(slot);
  }
  const enabled=assigned.filter(entry=>entry.slot>=1&&entry.slot<=12);
  const stable=!changed&&enabled.every(entry=>{
    const prior=previous.find(item=>item.slot===entry.slot&&item.botId===entry.botId);
    return prior&&prior.botName===entry.botName&&prior.avatarKey===entry.avatarKey&&(prior.generation??1)===entry.generation;
  });
  return stable?{rebuild:false,entries:previous,enabledSlots:enabled.map(entry=>entry.slot)}:{rebuild:true,entries:enabled,enabledSlots:enabled.map(entry=>entry.slot)};
}
export function shareConfiguration(state){return {version:1,accountId:state.accountBusy?null:state.account?.id??null,entries:menuEntries(state).map(({bot,...entry})=>entry)};}
