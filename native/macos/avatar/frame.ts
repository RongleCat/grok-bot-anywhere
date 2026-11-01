// Bloub engine by Jérémy Perret (MIT), see assets/bloub/LICENSE.
import {BotEngine, type BotFrame} from '../../../vendor/bloub/src/bot/engine';
import {SHAPE_BY_ID,mixHex} from '../../../vendor/bloub/src/bot/skins';
import {STATE_BY_ID,type StateId} from '../../../vendor/bloub/src/bot/states';
const shapes: Record<string,string>={blob:'cercle',pebble:'galet',squircle:'squircle',tablet:'capsule',wedge:'triangle',hex:'hexagone',cloud:'nuage',teardrop:'goutte'};
export function engineFor(shape:string,state:string){return new BotEngine(100,(STATE_BY_ID.has(state as StateId)?state:'idle') as StateId,SHAPE_BY_ID.get(shapes[shape]??'cercle')?.radii??null);}
const escape=(value:unknown)=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function frameSVG(frame:BotFrame,color:string,paper='#f4f4f5'){
 const ink=/^#[a-f0-9]{6}$/i.test(color)?color:'#4788C8';
 const defs=frame.arcs.map((arc,i)=>`<linearGradient id="arc${i}" gradientUnits="userSpaceOnUse" x1="${arc.grad.x1}" y1="${arc.grad.y1}" x2="${arc.grad.x2}" y2="${arc.grad.y2}">${arc.grad.stops.map((stop,j)=>`<stop offset="${j/(arc.grad.stops.length-1)}" stop-color="${escape(stop)}"/>`).join('')}</linearGradient>`).join('');
 const dots=frame.dots.map(dot=>{
   const fill=dot.color??(dot.depth===undefined?ink:mixHex(paper,ink,dot.depth));
   return dot.d?`<path d="${escape(dot.d)}" transform="translate(${dot.x} ${dot.y}) rotate(${dot.rot??0}) scale(100)" fill="${escape(fill)}" opacity="${dot.opacity}"/>`:`<circle cx="${dot.x}" cy="${dot.y}" r="${dot.r}" fill="${escape(fill)}" opacity="${dot.opacity}"/>`;
 }).join('');
 const arcs=(front:boolean)=>`<g data-layer="${front?'front':'back'}" fill="none" stroke-linecap="round">${frame.arcs.map((arc,i)=>`<path d="${escape(front?arc.front:arc.back)}" stroke="url(#arc${i})" stroke-width="${arc.width}" opacity="${arc.opacity}"/>`).join('')}</g>`;
 const notch=frame.notch?`<circle cx="${frame.notch.x}" cy="${frame.notch.y}" r="${frame.notch.r}" fill="black"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-158 -158 316 316"><defs>${defs}<mask id="face" maskUnits="userSpaceOnUse" x="-158" y="-158" width="316" height="316"><path d="${escape(frame.bodyPath)}" fill="white"/>${frame.eyes.map(eye=>`<path d="${escape(eye.d)}" transform="${escape(eye.matrix)}" opacity="${eye.alpha}" fill="black"/>`).join('')}${notch}</mask></defs>${arcs(false)}${frame.dotsBehind?dots:''}<g opacity="${frame.bodyAlpha}"><path d="${escape(frame.bodyPath)}" fill="none"/><rect x="-158" y="-158" width="316" height="316" fill="${ink}" mask="url(#face)"/></g>${frame.dotsBehind?'':dots}${frame.notif?`<circle cx="${frame.notif.x}" cy="${frame.notif.y}" r="${frame.notif.r}" fill="#3696ff"/>`:''}${arcs(true)}</svg>`;
}
export function renderFrame({state='idle',shape='blob',color='#4788C8',time=0}={}){return frameSVG(engineFor(shape,state).sample(time),color);}
