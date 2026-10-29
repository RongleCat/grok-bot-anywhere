import {shareConfiguration} from './model.mjs';
export class MenuReconciler {
 constructor({sync,publish,needsUpdate,update,onError=()=>{},delay=300}){Object.assign(this,{sync,publish,needsUpdate,update,onError,delay});this.revision=0;this.applied=0;this.closed=false;}
 request(state){
  this.latest=state;const key=JSON.stringify(shareConfiguration(state));if(key===this.key)return;
  this.key=key;this.revision++;clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush().catch(this.onError),this.delay);
  if(this.publish){this.published=Promise.resolve().then(()=>this.publish(state));this.published.catch(this.onError);}
 }
 async flush({force=false}={}){
  clearTimeout(this.timer);if(force&&this.latest)this.revision++;
  if(this.running)return this.running;if(!this.latest||this.closed)return this.result;
  this.running=(async()=>{
   while(!this.closed&&this.applied!==this.revision){
    const revision=this.revision,state=this.latest;
    if(this.publish)await this.published;else await this.sync(state);
    if(revision===this.revision&&!state.accountBusy&&this.needsUpdate())this.result=await this.update(state,()=>!this.closed&&revision===this.revision);
    this.applied=revision;
   }
   return this.result;
  })().finally(()=>{this.running=null;});
  return this.running;
 }
 close(){this.closed=true;clearTimeout(this.timer);}
}
