// Compatibility layer over grok-bot-avatar-engine 0.1.x.
//
// 1.0.0 exposed createStrip, renderAvatarPng, colorHex, the main-bot star,
// theme palettes, reducedMotion and handle.capture(). The 0.1.x main branch is
// the 0.78.1 client renderer: it has none of those, mounts into the light DOM,
// and its own colour table has no light/dark pair. The app still needs the old
// surface, so this module keeps the call sites stable and puts the removed
// chrome back around the new renderer.
import {
  COLORS, SHAPES, STATES,
  bodyFor,
  createAvatar as mountAvatar,
  paintOf,
  pinnedColor,
  colorValue,
  renderAvatarSvg as renderEngineSvg,
  resolveAvatar as resolveEngineAvatar,
} from 'grok-bot-avatar-engine';
import {colorHex} from './avatar-ink.mjs';

export {COLORS, SHAPES, STATES, colorHex};

const STATE_ALIASES=Object.freeze({wide:'listening',comet:'streaming'});
const BADGE_DIAMETER=0.276;
const BADGE_CENTER_X=0.87;
const BADGE_CENTER_Y=0.97;
const BADGE_GAP=0.052;
const SHADOW_CSS=`
:host{display:block;position:relative;width:100%;height:100%}
[data-gba-frame]{position:absolute;inset:0}
[data-gba-clip]{position:absolute;inset:0;overflow:hidden}
[data-gba-glyph]{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
[data-gba-engine]{position:absolute;inset:0}
[data-gba-badge]{position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2;visibility:hidden}
[data-gba-badge][hidden]{display:none}
[data-gba-badge] svg{display:block;width:100%;height:100%}
`;

function themeName(theme){
  return theme==='light'||theme==='dark'?theme:(typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
}

function paletteColor(value,theme){
  if(typeof value!=='string'||!value)return undefined;
  if(value.startsWith('#'))return value;
  return colorHex(value,theme)||value;
}

function engineState(value){
  if(typeof value!=='string'||!value)return 'idle';
  const state=STATE_ALIASES[value]??value;
  return STATES.includes(state)?state:'idle';
}

function engineOptions(options,size){
  const theme=themeName(options.theme);
  const output={
    agentId:options.agentId,
    shape:options.shape??options.avatarShape,
    color:paletteColor(options.color||options.avatarColor,theme),
    size,
    state:engineState(options.state),
    isStatic:options.reducedMotion===true,
    isPlaying:options.visible!==false,
    isFollowingPointer:options.follow!==false,
  };
  if(options.seed!==undefined)output.seed=options.seed;
  if(options.id!==undefined&&options.id!==null&&options.id!=='')output.id=String(options.id);
  if(Number.isFinite(options.maxFrameRate)&&options.maxFrameRate>0)output.maxFrameRate=options.maxFrameRate;
  return output;
}

// Exported for the Node regression test; not part of the app's public surface.
export function engineProps(options,size){
  const source=engineOptions(options,size);
  const pinned=pinnedColor(source.shape);
  const color=(pinned?colorValue(pinned):source.color)||'#1084FE';
  return {...source,body:bodyFor(source.shape),appearance:paintOf(color),id:options.id===undefined||options.id===null||options.id===''?`avatar-${source.shape}`:String(options.id)};
}

function normalizeInitial(options){
  const next={...options};
  if(next.agentId&&(!next.shape&&!next.avatarShape||!next.color&&!next.avatarColor)){
    const resolved=resolveEngineAvatar(next.agentId);
    if(!next.shape&&!next.avatarShape)next.shape=resolved.shape;
    if(!next.color&&!next.avatarColor)next.color=resolved.color;
  }
  if(!next.shape&&!next.avatarShape)next.shape='blob';
  if(!next.color&&!next.avatarColor&&!next.agentId)next.color='#1084FE';
  return next;
}

function fmt(value){
  return Number(value).toFixed(3);
}

function roundedStarPath(cx,cy,outer,inner,round){
  const points=[];
  for(let index=0;index<10;index+=1){
    const radius=index%2===0?outer:inner;
    const angle=-Math.PI/2+index*Math.PI/5;
    points.push([cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius]);
  }
  let path='';
  for(let index=0;index<10;index+=1){
    const previous=points[(index+9)%10],current=points[index],next=points[(index+1)%10];
    const previousLength=Math.hypot(previous[0]-current[0],previous[1]-current[1])||1;
    const nextLength=Math.hypot(next[0]-current[0],next[1]-current[1])||1;
    const distance=Math.min(round,previousLength*0.45,nextLength*0.45);
    const start=[current[0]+(previous[0]-current[0])/previousLength*distance,current[1]+(previous[1]-current[1])/previousLength*distance];
    const end=[current[0]+(next[0]-current[0])/nextLength*distance,current[1]+(next[1]-current[1])/nextLength*distance];
    path+=`${index===0?'M':'L'}${fmt(start[0])} ${fmt(start[1])}Q${fmt(current[0])} ${fmt(current[1])} ${fmt(end[0])} ${fmt(end[1])}`;
  }
  return `${path}Z`;
}

function makeBadge(){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 16 16');
  svg.setAttribute('aria-hidden','true');
  const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
  for(const [name,value] of Object.entries({cx:'8',cy:'8',r:'7.75',fill:'#f59312','stroke':'#1c1c1c','stroke-opacity':'0.06','stroke-width':'0.5'}))circle.setAttribute(name,value);
  const star=document.createElementNS('http://www.w3.org/2000/svg','path');
  star.setAttribute('d',roundedStarPath(8,8,3.9,2.2,0.45));
  star.setAttribute('fill','#ffffff');
  svg.append(circle,star);
  return svg;
}

function ensureParts(target){
  const shadow=target.shadowRoot??target.attachShadow({mode:'open'});
  let frame=shadow.querySelector('[data-gba-frame]');
  if(!frame){
    for(const node of shadow.querySelectorAll('[data-grok-avatar-root], style[data-grok-avatar]'))node.remove();
    if(!shadow.querySelector('style[data-gba-style]')){
      const style=document.createElement('style');
      style.dataset.gbaStyle='';
      style.textContent=SHADOW_CSS;
      shadow.prepend(style);
    }
    frame=document.createElement('div');
    frame.dataset.gbaFrame='';
    const clip=document.createElement('div');
    clip.dataset.gbaClip='';
    const glyph=document.createElement('div');
    glyph.dataset.gbaGlyph='';
    const engine=document.createElement('div');
    engine.dataset.gbaEngine='';
    glyph.append(engine);
    clip.append(glyph);
    frame.append(clip);
    shadow.append(frame);
  }
  const clip=frame.querySelector('[data-gba-clip]');
  const glyph=frame.querySelector('[data-gba-glyph]');
  let engine=frame.querySelector('[data-gba-engine]');
  if(!engine){
    engine=document.createElement('div');
    engine.dataset.gbaEngine='';
    glyph.append(engine);
  }
  let badge=shadow.querySelector('[data-gba-badge]');
  if(!badge){
    badge=document.createElement('span');
    badge.dataset.gbaBadge='';
    badge.append(makeBadge());
    shadow.append(badge);
  }
  return {clip,glyph,engine,badge,shadow};
}

function clearMask(clip){
  for(const name of ['maskImage','webkitMaskImage']){
    clip.style[name]='';
  }
}

function notchMask(width,height,cx,cy,radius){
  const w=fmt(width),h=fmt(height),x=fmt(cx),y=fmt(cy),r=fmt(radius),diameter=fmt(radius*2);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path fill="#fff" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${fmt(cx-radius)} ${y}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 -${diameter} 0Z"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function layoutBadge(target,parts,fallback=false){
  const host=target.getBoundingClientRect();
  if(host.width<2||host.height<2)return false;
  const svg=parts.engine.querySelector('svg');
  const use=svg?.querySelector('g[transform] use')??svg?.querySelector('use');
  let body=use?.getBoundingClientRect?.();
  if((!body||body.width<2||body.height<2)&&fallback){
    body={left:host.left+host.width*0.2,top:host.top+host.height*0.2,width:host.width*0.6,height:host.height*0.6};
  }
  if(!body||body.width<2||body.height<2)return false;

  // Reference icon: badge diameter is 27.6% of the body width. The centre is
  // nudged from the measured 83.2% / 93.4% to 87% / 97% so the badge intrudes
  // less into the silhouette; the cut-out keeps a 5.2% gap.
  const diameter=Math.max(5,body.width*BADGE_DIAMETER);
  const cx=(body.left-host.left)+body.width*BADGE_CENTER_X;
  const cy=(body.top-host.top)+body.height*BADGE_CENTER_Y;
  const radius=diameter/2+body.width*BADGE_GAP;
  parts.badge.style.left=`${fmt(cx-diameter/2)}px`;
  parts.badge.style.top=`${fmt(cy-diameter/2)}px`;
  parts.badge.style.width=`${fmt(diameter)}px`;
  parts.badge.style.height=`${fmt(diameter)}px`;
  parts.badge.style.visibility='visible';

  const mask=notchMask(host.width,host.height,cx,cy,radius);
  parts.clip.style.maskImage=mask;
  parts.clip.style.webkitMaskImage=mask;
  for(const [name,value] of [['maskSize','100% 100%'],['webkitMaskSize','100% 100%'],['maskRepeat','no-repeat'],['webkitMaskRepeat','no-repeat'],['maskMode','alpha'],['webkitMaskSourceType','alpha']]){
    parts.clip.style[name]=value;
  }
  return true;
}

function scheduleBadge(target,parts){
  let attempts=0;
  const run=()=>{
    if(!target.isConnected)return;
    if(layoutBadge(target,parts))return;
    if(attempts++<6&&typeof requestAnimationFrame==='function')requestAnimationFrame(run);
    else layoutBadge(target,parts,true);
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);
  else run();
}

function paintChrome(target,parts,options){
  const main=options.main===true;
  target.classList.toggle('main',main);
  parts.badge.hidden=!main;
  if(!main){
    parts.badge.style.visibility='hidden';
    clearMask(parts.clip);
    return;
  }
  scheduleBadge(target,parts);
}

function rasterizeSvg(svg,size){
  const clone=svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('width',String(size));
  clone.setAttribute('height',String(size));
  const text=new XMLSerializer().serializeToString(clone);
  const url=`data:image/svg+xml,${encodeURIComponent(text)}`;
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=size;
      canvas.height=size;
      const context=canvas.getContext('2d');
      if(!context){reject(new Error('AVATAR_RASTER_FAILED'));return;}
      context.clearRect(0,0,size,size);
      context.drawImage(image,0,0,size,size);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror=()=>reject(new Error('AVATAR_RASTER_FAILED'));
    image.src=url;
  });
}

function rasterizeSvgText(text,size){
  if(typeof DOMParser!=='function')throw new Error('AVATAR_RASTER_FAILED');
  const documentNode=new DOMParser().parseFromString(text,'image/svg+xml');
  const svg=documentNode.documentElement;
  if(!svg||svg.nodeName.toLowerCase()!=='svg')throw new Error('AVATAR_RASTER_FAILED');
  return rasterizeSvg(svg,size);
}

export function renderAvatarSvg(options={}){
  const next={...options};
  const theme=themeName(next.theme);
  const requested=next.color||next.avatarColor;
  if(requested)next.color=paletteColor(requested,theme)||requested;
  delete next.avatarColor;
  return renderEngineSvg(next);
}

export async function renderAvatarPng(options={}){
  const size=Number.isFinite(options.size)&&options.size>0?options.size:128;
  return rasterizeSvgText(renderAvatarSvg({...options,size}),size);
}

export function createAvatar(target,options={}){
  if(!target||target.nodeType!==1)throw new TypeError('Avatar target must be an element');
  const parts=ensureParts(target);
  const initial=normalizeInitial(options);
  const size=Number.isFinite(initial.size)&&initial.size>0?initial.size:Math.max(1,Math.round(target.getBoundingClientRect?.().width||48));
  let current={...initial,size};
  let destroyed=false;
  let media=null;
  if(!target.style.position)target.style.position='relative';
  const controller=mountAvatar(parts.engine,engineProps(current,size));

  const onMediaChange=()=>{if(!destroyed)update({});};
  function armMedia(){
    if(media){media.removeEventListener?.('change',onMediaChange);media=null;}
    if(current.theme!=='auto'||typeof matchMedia!=='function')return;
    media=matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change',onMediaChange);
  }

  function update(patch={}){
    if(destroyed)return;
    const next={...current,...patch};
    if(patch.agentId&&patch.agentId!==current.agentId){
      const resolved=resolveEngineAvatar(patch.agentId);
      if(!patch.shape&&!patch.avatarShape)next.shape=resolved.shape;
      if(!patch.color&&!patch.avatarColor)next.color=resolved.color;
    }
    if(Number.isFinite(next.size)&&next.size>0)next.size=next.size;
    current=next;
    controller.update(engineProps(current,current.size));
    paintChrome(target,parts,current);
    armMedia();
  }

  function capture(requested=128){
    if(destroyed)return Promise.resolve('');
    const svg=parts.engine.querySelector('svg');
    if(!svg)return Promise.resolve('');
    const output=Number.isFinite(requested)&&requested>0?requested:128;
    return rasterizeSvg(svg,output);
  }

  function destroy(){
    if(destroyed)return;
    destroyed=true;
    media?.removeEventListener?.('change',onMediaChange);
    controller.destroy();
    parts.badge.remove();
    parts.engine.replaceChildren();
    clearMask(parts.clip);
    target.classList.remove('main');
  }

  armMedia();
  paintChrome(target,parts,current);
  return {
    element:target,
    update,
    setState:state=>update({state}),
    setShape:shape=>update({shape}),
    setColor:color=>update({color}),
    setMain:main=>update({main:main===true}),
    setVisible:visible=>update({visible:visible!==false}),
    setReducedMotion:reducedMotion=>update({reducedMotion:reducedMotion===true}),
    blink:()=>controller.blink(),
    look:angle=>controller.look(angle),
    gaze:point=>controller.gaze(point),
    setExpression:(name,value)=>controller.setExpression(name,value),
    restart:()=>controller.restart(),
    poke:(name,value)=>controller.poke(name,value),
    capture,
    destroy,
  };
}

export function createStrip(target,options={}){
  if(!target||target.nodeType!==1)throw new TypeError('Avatar target must be an element');
  let config={...options};
  const handles=new Map();
  let destroyed=false;
  function clear(){
    for(const handle of handles.values())handle.destroy();
    handles.clear();
  }
  function render(){
    clear();
    target.replaceChildren();
    target.style.position='relative';
    target.style.display='flex';
    target.style.alignItems='center';
    const mark=Number.isFinite(config.mark)&&config.mark>0?config.mark:40;
    const cell=mark+16;
    for(const [index,bot] of (config.bots??[]).entries()){
      const wrapper=document.createElement('div');
      wrapper.style.cssText=`position:relative;width:${cell}px;height:${cell}px;flex:0 0 ${cell}px;display:flex;align-items:center;justify-content:center;overflow:hidden`;
      const face=document.createElement('div');
      face.className='avatar';
      face.style.width=face.style.height=`${mark}px`;
      wrapper.append(face);
      target.append(wrapper);
      handles.set(String(bot.id??index),createAvatar(face,{...bot,size:mark,theme:config.theme,reducedMotion:config.reducedMotion}));
    }
  }
  render();
  return {
    element:target,
    get:id=>handles.get(String(id))??null,
    update(patch={}){if(destroyed)return;config={...config,...patch};render();},
    nodNeighbors(){
      const ids=[...handles.keys()];
      if(ids.length<2)return '';
      const index=Math.floor(Math.random()*(ids.length-1));
      handles.get(ids[index])?.blink();
      handles.get(ids[index+1])?.blink();
      return `${ids[index]}|${ids[index+1]}`;
    },
    acknowledge(id){const handle=handles.get(String(id));if(!handle)return '';handle.blink();return String(id);},
    capture(id,size=128){return handles.get(String(id))?.capture(size)??Promise.resolve('');},
    destroy(){if(destroyed)return;destroyed=true;clear();target.replaceChildren();},
  };
}
