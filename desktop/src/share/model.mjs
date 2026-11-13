import {groupMembers,listedBots,stackIconVersion} from '../renderer/group-avatar.mjs';
export const menuHostName='Grok Bot Anywhere Menu';
export const MENU_ID='dev.ronglecat.grokbotanywhere.menu';
export const destinationIdentifier=slot=>`${MENU_ID}.destination${String(slot).padStart(2,'0')}`;
export const slotIdentifier=slot=>`${destinationIdentifier(slot)}.share`;
export const extensionIdentifier=(slot,generation=1)=>`${destinationIdentifier(slot)}.g${generation}.share`;
export const saveDestinationIdentifier=`${MENU_ID}.destinationSave`;
export const saveExtensionIdentifier=(generation=1)=>`${saveDestinationIdentifier}.g${generation}.share`;
export const saveDestinationPath=root=>`${root}/Contents/Helpers/DestinationSave.app`;
export const saveExtensionPath=root=>`${saveDestinationPath(root)}/Contents/PlugIns/GrokBotSave.appex`;
export const legacySlotIdentifier=slot=>`${MENU_ID}.slot${String(slot).padStart(2,'0')}`;
export function pluginIdentifier(installed,slot){
  if((installed?.layoutVersion??0)<2)return legacySlotIdentifier(slot);
  if((installed?.layoutVersion??0)<4)return slotIdentifier(slot);
  const entry=installed?.entries?.find(item=>item.slot===slot);
  return entry?.extensionId??extensionIdentifier(slot,entry?.generation??0);
}
export const destinationPath=(root,slot)=>`${root}/Contents/Helpers/Destination${String(slot).padStart(2,'0')}.app`;
export const slotExtensionPath=(root,slot)=>`${destinationPath(root,slot)}/Contents/PlugIns/GrokBotShare.appex`;
export function accountsOf(state){
  const rows=(state.accounts??[]).filter(entry=>entry?.checked!==false&&entry?.account?.id);
  if(rows.length)return rows.map((entry,index)=>({id:entry.account.id,account:entry.account,order:index,checked:true}));
  if(state.account?.id)return [{id:state.account.id,account:state.account,order:0,checked:true}];
  return [];
}
function accountBots(state,accountId){
  const legacy=accountId===state.account?.id;
  return (state.bots??[]).filter(bot=>legacy?bot.accountId===undefined||bot.accountId===accountId:bot.accountId===accountId);
}
export function menuEntries(state){
  if(!state.account?.id||state.accountBusy)return [];
  const limit=state.saveToLocal?11:12;
  const entries=[];
  for(const account of accountsOf(state)){
    const bots=accountBots(state,account.id);
    const visible=new Set(listedBots(bots).map(bot=>bot.id));
    const recipients=(state.recipients??[]).filter(recipient=>(recipient.accountId??account.id)===account.id);
    recipients.filter(r=>r.enabled&&r.sources.wechat).map((r,index)=>({r,index,bot:bots.find(b=>b.id===r.botId)})).filter(row=>row.bot&&visible.has(row.bot.id))
      .sort((a,b)=>a.r.order-b.r.order||a.index-b.index).forEach(({r,bot})=>entries.push({accountId:account.id,botId:bot.id,botName:bot.name||'Bot',sessionId:bot.sessionId??'',mode:r.mode,prefix:r.prefix,
        avatarKey:avatarKey(bot,bots),bot,accountOrder:account.order,order:r.order,index:entries.length}));
  }
  return entries.sort((a,b)=>a.accountOrder-b.accountOrder||a.order-b.order||a.index-b.index).slice(0,limit);
}
function avatarKey(bot,bots){
 const base=[bot.avatarShape,bot.avatarColor,bot.avatar?.picture?.url,bot.avatar?.picture?.version];
 const members=groupMembers(bot,bots);
 if(members.length<2)return JSON.stringify(base);
 const shown=members.slice(0,4);
 return JSON.stringify([...base,shown.map(member=>[member.id,member.avatarShape??'',member.avatarColor??'',member.avatar?.kind==='picture'?member.avatar.picture?.url??'':'']),stackIconVersion]);
}
function stickyMenu(desired,previous){
  const used=new Set();
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
  return {stable,enabled};
}
export function menuPlan(state,installed){
  const desired=menuEntries(state),previous=installed?.entries??[],sticky=stickyMenu(desired,previous);
  const bySlot=[...sticky.enabled].sort((a,b)=>a.slot-b.slot).map(entry=>entry.botId);
  const wanted=desired.map(entry=>entry.botId);
  const ordered=bySlot.length===wanted.length&&bySlot.every((id,index)=>id===wanted[index]);
  if(ordered){
    const stable=sticky.stable;
    return {rebuild:!stable,entries:stable?previous:sticky.enabled,enabledSlots:sticky.enabled.map(entry=>entry.slot),saveEnabled:state.saveToLocal===true};
  }
  const entries=desired.map((entry,index)=>{
    const prior=previous.find(item=>item.accountId===entry.accountId&&item.botId===entry.botId&&item.slot);
    const same=!!prior&&prior.botName===entry.botName&&prior.avatarKey===entry.avatarKey;
    return {...entry,slot:index+1,generation:prior?(same?(prior.generation??1):(prior.generation??1)+1):1};
  });
  return {rebuild:true,entries,enabledSlots:entries.map(entry=>entry.slot),saveEnabled:state.saveToLocal===true};
}
export function shareConfiguration(state){
 const accounts=state.accountBusy?[]:accountsOf(state).map(account=>account.id);
 return {version:2,accountId:state.accountBusy?null:(accounts.length===1?accounts[0]:null),accounts,saveToLocal:!!state.saveToLocal,entries:menuEntries(state).map(({bot,...entry})=>entry)};
}
