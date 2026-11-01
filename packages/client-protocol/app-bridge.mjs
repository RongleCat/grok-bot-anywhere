import {createInterface} from 'node:readline';
import {BridgeSession,publicError} from './app-session.mjs';
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
const session=new BridgeSession({emit});
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
  if(Buffer.byteLength(line)>1024*1024){emit({error:{code:'REQUEST_TOO_LARGE'}});return;}
  let request;try{request=JSON.parse(line);if(typeof request.id!=='string'||typeof request.method!=='string')throw new Error();}catch{emit({error:{code:'INVALID_REQUEST'}});return;}
  void session.call(request.method,request.params).then(result=>emit({id:request.id,result}),error=>emit({id:request.id,error:{code:publicError(error)}}));
});
lines.on('close',()=>{void session.call('logout').catch(()=>{});process.exit(0);});
