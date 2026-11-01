import {engineFor,frameSVG} from './frame';
import type {StateId} from '../../../vendor/bloub/src/bot/states';
import {STATE_BY_ID} from '../../../vendor/bloub/src/bot/states';
let shape='blob',color='#4788C8',state='idle',visible=false,reduced=false;
let engine=engineFor(shape,state),raf=0,clock=0,last=0;
const host=document.getElementById('avatar')!;
function draw(){const paper=matchMedia('(prefers-color-scheme: dark)').matches?'#292a2c':'#f4f4f5';host.innerHTML=frameSVG(engine.sample(reduced?0:clock),color,paper);}
function tick(now:number){if(!visible||reduced){raf=0;return;}if(last)clock+=Math.min((now-last)/1000,0.05);last=now;draw();raf=requestAnimationFrame(tick);}
(window as any).setAvatar=(config:{shape?:string;color?:string;state?:string;visible?:boolean;reducedMotion?:boolean})=>{
 if(typeof config.shape==='string'&&config.shape!==shape){shape=config.shape;engine=engineFor(shape,state);clock=0;}
 if(typeof config.color==='string'&&/^#[a-f0-9]{6}$/i.test(config.color))color=config.color;
 if(typeof config.state==='string'&&STATE_BY_ID.has(config.state as StateId)&&state!==config.state){state=config.state;engine.setState(state as StateId,clock);}
 visible=config.visible===true;reduced=config.reducedMotion===true;
 cancelAnimationFrame(raf);raf=0;last=0;draw();if(visible&&!reduced)raf=requestAnimationFrame(tick);
};
host.addEventListener('pointermove',event=>{const rect=host.getBoundingClientRect();engine.setLook({yaw:(event.clientX-rect.left-rect.width/2)/rect.width*50,pitch:(event.clientY-rect.top-rect.height/2)/rect.height*30,mix:1,spin:0,wander:0},clock);});
host.addEventListener('pointerleave',()=>engine.setLook({yaw:0,pitch:0,mix:0,spin:0,wander:1},clock));
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else if(visible&&!reduced&&!raf)raf=requestAnimationFrame(tick);});
draw();
