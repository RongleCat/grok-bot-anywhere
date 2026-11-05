// Static palette and ink helpers for the avatar adapter.
//
// The renderer in grok-bot-avatar-engine 0.1.x uses the shipped client's single
// colour table. The app still has a light/dark surface, so keep the 0.70.2
// light/dark pair here and hand the engine an explicit hex where the surface
// needs it. `eyeInk` is retained for the old build-time fix and for callers
// that still need a contrast ink.
export const AVATAR_PALETTE=Object.freeze({
  black:{light:'#000000',dark:'#FFFFFF'},
  brown:{light:'#A27952',dark:'#855C36'},
  red:{light:'#FF3E51',dark:'#E02135'},
  orange:{light:'#FF781C',dark:'#FF6700'},
  yellow:{light:'#FFAF38',dark:'#FF9800'},
  green:{light:'#00C972',dark:'#009957'},
  cyan:{light:'#1CC3B0',dark:'#00A592'},
  blue:{light:'#2A92FE',dark:'#0E74E0'},
  violet:{light:'#A97EFE',dark:'#804EE0'},
  magenta:{light:'#FF5EB1',dark:'#E02A88'},
  gray:{light:'#959595',dark:'#777777'}
});

export function colorHex(name,theme='light'){
  if(typeof name!=='string'||!name)return '';
  const entry=AVATAR_PALETTE[name];
  if(entry)return theme==='dark'?entry.dark:entry.light;
  return name;
}

export function eyeInk(value){
  const match=/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(value??'').trim());
  if(!match)return '#fff';
  let hex=match[1];
  if(hex.length===3)hex=hex.split('').map(char=>char+char).join('');
  const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  const linear=channel=>{const part=channel/255;return part<=0.03928?part/12.92:((part+0.055)/1.055)**2.4;};
  const luminance=0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b);
  const whiteContrast=1.05/(luminance+0.05),blackContrast=(luminance+0.05)/0.05;
  return blackContrast>=whiteContrast?'#111':'#fff';
}
