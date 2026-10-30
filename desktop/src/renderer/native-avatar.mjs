import {createAvatar,createStrip,renderAvatarPng} from 'grok-bot-avatar-engine';
let avatar,live,strip;
window.setAvatar=config=>{const target=document.querySelector('#avatar');if(!avatar)avatar=createAvatar(target,{...config,size:Math.min(innerWidth,innerHeight)});else avatar.update(config);};
window.renderStill=config=>renderAvatarPng({...config,size:128});
window.prepareLive=config=>{const target=document.querySelector('#live');target.style.display='block';if(!live)live=createAvatar(target,{...config,size:128});else live.update(config);};
window.captureLive=()=>live?.capture(128)??'';
window.renderStrip=config=>{document.body.classList.add('strip');const target=document.querySelector('#stage');if(!strip)strip=createStrip(target,config);else strip.update(config);};
window.stepStrip=()=>{};
window.acknowledge=id=>strip?.acknowledge(id);
window.nodNeighbors=()=>strip?.nodNeighbors()??'';
window.captureMenuAvatar=async config=>{const handle=createAvatar(document.querySelector('#avatar'),{...config,size:128,reducedMotion:true,theme:'light'});try{return await handle.capture(128);}finally{handle.destroy();}};

// Flatten share icons before macOS supplies a material tile for transparency.
// Live avatars continue using their transparent captures.
window.whiteMenuIcon=async source=>{
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('MENU_AVATAR_MISSING'));image.src=source;});
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,128,128);context.drawImage(image,0,0,128,128);
 return canvas.toDataURL('image/png');
};
