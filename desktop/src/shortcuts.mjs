export const DEFAULT_SHORTCUTS={compose:'Ctrl+Alt+Space'};
const MODIFIERS=new Set(['Command','Cmd','Control','Ctrl','CommandOrControl','CmdOrCtrl','Alt','Option','AltGr','Shift','Super','Meta']);
const STRONG=new Set(['Command','Cmd','Control','Ctrl','CommandOrControl','CmdOrCtrl','Alt','Option','Super','Meta']);
const NAMED=new Set(['Space','Tab','Esc','Escape','Return','Enter','Up','Down','Left','Right','Home','End','PageUp','PageDown','Backspace','Delete','Plus',...Array.from({length:24},(_,index)=>`F${index+1}`)]);

export function normalizeAccelerator(input){
  if(input==null||input==='')return null;
  if(typeof input!=='string'||input.length>64)throw new Error('SHORTCUT_INVALID');
  const parts=input.split('+').map(part=>part.trim()).filter(Boolean);
  if(parts.length<2||parts.length>4)throw new Error('SHORTCUT_INVALID');
  const key=parts.at(-1),mods=parts.slice(0,-1);
  if(!mods.every(part=>MODIFIERS.has(part))||!mods.some(part=>STRONG.has(part)))throw new Error('SHORTCUT_INVALID');
  if(!NAMED.has(key)&&!/^[A-Z0-9]$/.test(key))throw new Error('SHORTCUT_INVALID');
  return [...mods,key].join('+');
}

export function acceleratorFromEvent(event){
  if(!event||event.isComposing)return null;
  const key=event.key;
  if(!key||['Control','Shift','Alt','Meta'].includes(key))return null;
  const mods=[];
  if(event.metaKey)mods.push('Command');
  if(event.ctrlKey)mods.push('Ctrl');
  if(event.altKey)mods.push('Alt');
  if(event.shiftKey)mods.push('Shift');
  if(!mods.some(part=>STRONG.has(part)))return null;
  const named={' ':'Space',Escape:'Esc',Enter:'Return',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Backspace:'Backspace',Delete:'Delete',Tab:'Tab'};
  let token=named[key];
  if(!token){
    if(key.length===1)token=key.toUpperCase();
    else if(/^F([1-9]|1[0-9]|2[0-4])$/.test(key))token=key;
    else return null;
  }
  return [...mods,token].join('+');
}

export function formatAccelerator(accelerator,platform='darwin'){
  if(!accelerator)return '';
  if(platform!=='darwin')return accelerator;
  const symbols={Command:'⌘',Cmd:'⌘',Control:'⌃',Ctrl:'⌃',CommandOrControl:'⌘',CmdOrCtrl:'⌘',Alt:'⌥',Option:'⌥',Shift:'⇧',Space:'Space'};
  return accelerator.split('+').map(part=>symbols[part]??part).join('');
}
