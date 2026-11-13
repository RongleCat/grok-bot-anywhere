import net from 'node:net';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink,chmod} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_LINE=1024*1024;
const MAX_CLIENTS=16;

export function localApiPaths({userData,platform=process.platform}){
  if(platform==='win32'){
    const digest=createHash('sha256').update(String(userData)).digest('hex').slice(0,16);
    return {socketPath:`\\\\.\\pipe\\grok-bot-anywhere-${digest}`,tokenPath:join(userData,'local-api.token'),userData};
  }
  return {socketPath:join(userData,'local-api.sock'),tokenPath:join(userData,'local-api.token'),userData};
}

function sameToken(left,right){
  const a=Buffer.from(String(left??'')),b=Buffer.from(String(right??''));
  return a.length===b.length&&timingSafeEqual(a,b);
}

export class LocalApiServer {
  constructor({userData,platform=process.platform,handler,logger=()=>{}}){
    if(typeof handler!=='function')throw new Error('LOCAL_API_HANDLER_REQUIRED');
    Object.assign(this,{userData,platform,handler,logger});
    this.paths=localApiPaths({userData,platform});
    this.server=null;this.token='';this.clients=new Set();this.closed=false;
  }
  async start(){
    await mkdir(this.userData,{recursive:true,mode:0o700});
    this.token=randomBytes(32).toString('base64url');
    await writeFile(`${this.paths.tokenPath}.tmp`,this.token,{mode:0o600});
    await rename(`${this.paths.tokenPath}.tmp`,this.paths.tokenPath);
    try{await chmod(this.paths.tokenPath,0o600);}catch{}
    if(this.platform!=='win32'){
      try{await unlink(this.paths.socketPath);}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    this.server=net.createServer(socket=>this.accept(socket));
    this.server.maxConnections=MAX_CLIENTS;
    await new Promise((resolve,reject)=>{
      const onError=error=>{this.server?.off('error',onError);reject(error);};
      this.server.once('error',onError);
      this.server.listen(this.paths.socketPath,()=>{this.server?.off('error',onError);resolve();});
    });
    if(this.platform!=='win32')await chmod(this.paths.socketPath,0o600);
    return {...this.paths,token:this.token};
  }
  accept(socket){
    this.clients.add(socket);
    socket.setEncoding('utf8');
    let buffer='';
    let busy=false;
    const reply=value=>{try{socket.write(`${JSON.stringify(value)}\n`);}catch{/* client went away */}};
    const fail=(id,code)=>reply({id:id??null,error:{code}});
    socket.on('data',chunk=>{
      if(busy){buffer='';return;}
      buffer+=chunk;
      if(buffer.length>MAX_LINE){fail(null,'REQUEST_TOO_LARGE');socket.destroy();return;}
      let index;
      while((index=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,index);buffer=buffer.slice(index+1);
        if(!line.trim())continue;
        void this.handleLine(line,reply,fail,socket);
      }
    });
    const cleanup=()=>{this.clients.delete(socket);};
    socket.on('close',cleanup);socket.on('error',cleanup);
  }
  async handleLine(line,reply,fail,socket){
    let request;
    try{request=JSON.parse(line);}catch{fail(null,'INVALID_REQUEST');return;}
    if(!request||typeof request!=='object'||typeof request.method!=='string'||!request.method){fail(request?.id??null,'INVALID_REQUEST');return;}
    if(!sameToken(request.token,this.token)){fail(request.id??null,'LOCAL_API_UNAUTHORIZED');socket.destroy();return;}
    const id=typeof request.id==='string'||typeof request.id==='number'?request.id:null;
    try{
      const result=await this.handler(request.method,request.params&&typeof request.params==='object'?request.params:{});
      reply({id,result});
    }catch(error){
      const code=/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code??error?.message??'')?error.code??error.message:'LOCAL_API_FAILED';
      reply({id,error:{code}});
    }
  }
  async close(){
    if(this.closed)return;this.closed=true;
    for(const socket of this.clients)socket.destroy();this.clients.clear();
    if(this.server)await new Promise(resolve=>this.server.close(()=>resolve()));
    this.server=null;
    if(this.platform!=='win32'){try{await unlink(this.paths.socketPath);}catch{}}
  }
}

export async function callLocalApi({socketPath,tokenPath,method,params={},timeout=120000}){
  const token=await readFile(tokenPath,'utf8');
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(socketPath);
    let buffer='',settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();if(error)reject(error);else resolve(value);};
    const timer=timeout>0?setTimeout(()=>finish(Object.assign(new Error('LOCAL_API_TIMEOUT'),{code:'LOCAL_API_TIMEOUT'})),timeout):null;
    socket.setEncoding('utf8');
    socket.on('connect',()=>socket.write(`${JSON.stringify({id:createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('base64url'),method,params,token:token.trim()})}\n`));
    socket.on('data',chunk=>{
      buffer+=chunk;
      if(buffer.length>MAX_LINE){finish(Object.assign(new Error('LOCAL_API_TOO_LARGE'),{code:'LOCAL_API_TOO_LARGE'}));return;}
      const index=buffer.indexOf('\n');if(index<0)return;
      let response;try{response=JSON.parse(buffer.slice(0,index));}catch{finish(Object.assign(new Error('LOCAL_API_INVALID_RESPONSE'),{code:'LOCAL_API_INVALID_RESPONSE'}));return;}
      if(response?.error){finish(Object.assign(new Error(response.error.code??'LOCAL_API_FAILED'),{code:response.error.code??'LOCAL_API_FAILED'}));return;}
      finish(null,response?.result);
    });
    socket.on('error',error=>finish(Object.assign(new Error(error.code==='ENOENT'||error.code==='ECONNREFUSED'?'APP_NOT_RUNNING':'LOCAL_API_CONNECT_FAILED'),{code:error.code==='ENOENT'||error.code==='ECONNREFUSED'?'APP_NOT_RUNNING':'LOCAL_API_CONNECT_FAILED'})));
  });
}
