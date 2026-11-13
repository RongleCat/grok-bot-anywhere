#!/usr/bin/env node
import net from 'node:net';
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';

const VERSION='0.1.0';
const BOOLEANS=new Set(['json','help','version','direct','compose','now','all']);
const VALUES=new Set(['account','bot','text','file','timeout','limit','title','shape','color']);

function userDataDir(){
  if(process.env.GBA_USER_DATA)return process.env.GBA_USER_DATA;
  if(process.platform==='win32')return join(process.env.APPDATA||homedir(),'Grok Bot Anywhere');
  if(process.platform==='darwin')return join(homedir(),'Library','Application Support','Grok Bot Anywhere');
  return join(process.env.XDG_CONFIG_HOME||join(homedir(),'.config'),'Grok Bot Anywhere');
}
function paths(){
  const base=userDataDir();
  return {
    socket:process.env.GBA_SOCKET||join(base,'local-api.sock'),
    token:process.env.GBA_TOKEN_FILE||join(base,'local-api.token')
  };
}
function usage(){
  console.log(`gba ${VERSION} — Grok Bot Anywhere local API CLI

Usage:
  gba status [--json]
  gba accounts list [--json]
  gba accounts check <id|name> [--json]
  gba accounts uncheck <id|name> [--json]
  gba accounts remove <id|name> [--json]
  gba accounts refresh [--json]
  gba bots list [--account <id>] [--json]
  gba bots duplicate <bot> [--account <id>] [--json]
  gba bots avatar <bot> --shape <shape> --color <color> [--json]
  gba recipients list [--account <id>] [--json]
  gba recipients configure <bot> '<json patch>' [--account <id>] [--json]
  gba inbox list [--account <id>] [--bot <id>] [--limit <n>] [--json]
  gba inbox get <receipt-id> [--json]
  gba inbox create --account <id> --bot <id> --text <text> [--json]
  gba inbox submit <receipt-id> --text <text> [--file <path>] [--json]
  gba inbox retry <receipt-id> [--json]
  gba inbox resolve <receipt-id> [--json]
  gba inbox dismiss <receipt-id> [--json]
  gba send --account <id> --bot <id> --text <text> [--file <path>] [--direct|--compose] [--json]
  gba wait <receipt-id> [--timeout <sec>] [--json]
  gba share status|update|order [--json]
  gba settings get|theme <system|light|dark>|composer --after-send <hide|open> [--json]
  gba app show [--json]
  gba api <method> [JSON params] [--json]

Environment: GBA_SOCKET, GBA_TOKEN_FILE (set by the GBA launcher).
`);
}
function parse(argv){
  const flags={};const positionals=[];const files=[];
  for(let index=0;index<argv.length;index+=1){
    const arg=argv[index];
    if(arg==='--'){positionals.push(...argv.slice(index+1));break;}
    if(arg==='-h'){flags.help=true;continue;}
    if(arg==='-V'){flags.version=true;continue;}
    if(!arg.startsWith('--')){positionals.push(arg);continue;}
    const eq=arg.indexOf('=');const name=eq<0?arg.slice(2):arg.slice(2,eq);const inline=eq<0?undefined:arg.slice(eq+1);
    if(!BOOLEANS.has(name)&&!VALUES.has(name))throw Object.assign(new Error(`Unknown flag --${name}`),{code:'USAGE'});
    if(BOOLEANS.has(name)){flags[name]=true;continue;}
    if(inline!==undefined)flags[name]=inline;
    else if(argv[index+1]!==undefined&&!argv[index+1].startsWith('--'))flags[name]=argv[++index];
    else throw Object.assign(new Error(`--${name} needs a value`),{code:'USAGE'});
    if(name==='file'){files.push(flags.file);delete flags.file;}
  }
  if(files.length)flags.files=files;
  return {flags,positionals};
}
function exitCode(code){
  if(code==='APP_NOT_RUNNING'||code==='LOCAL_API_CONNECT_FAILED')return 4;
  if(code==='LOCAL_API_TIMEOUT')return 5;
  if(code==='USAGE')return 3;
  return 2;
}
async function call(method,params={},timeout=120000){
  const {socket,token}=paths();
  const secret=await readFile(token,'utf8').catch(()=>{throw Object.assign(new Error('APP_NOT_RUNNING'),{code:'APP_NOT_RUNNING'});});
  return new Promise((resolve,reject)=>{
    const client=net.createConnection(socket);
    let buffer='',done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);client.destroy();if(error)reject(error);else resolve(value);};
    const timer=timeout>0?setTimeout(()=>finish(Object.assign(new Error('LOCAL_API_TIMEOUT'),{code:'LOCAL_API_TIMEOUT'})),timeout):null;
    client.setEncoding('utf8');
    client.on('connect',()=>client.write(`${JSON.stringify({id:`cli-${Date.now()}`,method,params,token:secret.trim()})}\n`));
    client.on('data',chunk=>{
      buffer+=chunk;
      if(buffer.length>1024*1024){finish(Object.assign(new Error('LOCAL_API_INVALID_RESPONSE'),{code:'LOCAL_API_INVALID_RESPONSE'}));return;}
      const index=buffer.indexOf('\n');if(index<0)return;
      let response;try{response=JSON.parse(buffer.slice(0,index));}catch{finish(Object.assign(new Error('LOCAL_API_INVALID_RESPONSE'),{code:'LOCAL_API_INVALID_RESPONSE'}));return;}
      if(response?.error){const code=response.error.code||'LOCAL_API_FAILED';finish(Object.assign(new Error(code),{code}));return;}
      finish(null,response?.result);
    });
    client.on('error',error=>finish(Object.assign(new Error('APP_NOT_RUNNING'),{code:error.code==='ENOENT'||error.code==='ECONNREFUSED'?'APP_NOT_RUNNING':'LOCAL_API_CONNECT_FAILED'})));
  });
}
function humanResult(result){
  if(result==null)return '';
  if(Array.isArray(result))return JSON.stringify(result,null,2);
  if(typeof result==='object'){
    if(Array.isArray(result.accounts))return result.accounts.map(row=>`${row.checked?'[x]':'[ ]'} ${row.account?.id??''}  ${row.account?.name??''}  ${row.connected?'connected':'offline'}  ${row.botCount??0} bots`).join('\n');
    if(Array.isArray(result.bots))return result.bots.map(row=>`${row.accountId??''}\t${row.id}\t${row.name??''}`).join('\n');
    if(Array.isArray(result.recipients))return result.recipients.map(row=>`${row.accountId??''}\t${row.botId}\t${row.enabled?'on':'off'}\t${row.mode??''}`).join('\n');
    if(Array.isArray(result.receipts))return result.receipts.map(row=>`${row.id}\t${row.status}\t${row.botName??row.botId??''}\t${String(row.text??'').slice(0,80)}`).join('\n');
  }
  return JSON.stringify(result,null,2);
}
function print(result,json){
  if(json)console.log(JSON.stringify({ok:true,result}));
  else console.log(humanResult(result));
}
function fail(error,json){
  const code=/^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code??error?.message??'')?error.code??error.message:'LOCAL_API_FAILED';
  if(json)console.log(JSON.stringify({ok:false,error:{code,message:code}}));
  else console.error(`${code}: ${code}`);
  process.exit(exitCode(code));
}
async function main(){
  const {flags,positionals}=parse(process.argv.slice(2));
  const json=!!flags.json;
  if(flags.version){if(json)console.log(JSON.stringify({ok:true,result:{version:VERSION}}));else console.log(`gba ${VERSION}`);return;}
  const [command,subcommand,...rest]=positionals;
  if(flags.help||!command){usage();return;}
  try{
    if(command==='status'){print(await call('app.status',{},30000),json);return;}
    if(command==='app'&&subcommand==='show'){print(await call('app.show'),json);return;}
    if(command==='accounts'){
      if(!subcommand||subcommand==='list'){print(await call('accounts.list'),json);return;}
      const id=rest[0]||flags.account;
      if(subcommand==='refresh'){print(await call('accounts.refresh',{},120000),json);return;}
      if(!id)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      const method={check:'accounts.check',uncheck:'accounts.uncheck',remove:'accounts.remove'}[subcommand];
      if(!method)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      print(await call(method,{accountId:id},120000),json);return;
    }
    if(command==='bots'){
      if(!subcommand||subcommand==='list'){print(await call('bots.list',{accountId:flags.account??null}),json);return;}
      const bot=rest[0]||flags.bot;if(!bot)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      if(subcommand==='duplicate'){print(await call('bots.duplicate',{accountId:flags.account??null,botId:bot},600000),json);return;}
      if(subcommand==='avatar'){print(await call('bots.updateAvatar',{accountId:flags.account??null,botId:bot,shape:flags.shape,color:flags.color},120000),json);return;}
      throw Object.assign(new Error('USAGE'),{code:'USAGE'});
    }
    if(command==='recipients'){
      if(!subcommand||subcommand==='list'){print(await call('recipients.list',{accountId:flags.account??null}),json);return;}
      if(subcommand==='configure'){
        const bot=rest[0]||flags.bot;if(!bot)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
        const patch=rest[1]?JSON.parse(rest[1]):{};
        print(await call('recipients.configure',{accountId:flags.account??null,botId:bot,patch},120000),json);return;
      }
      throw Object.assign(new Error('USAGE'),{code:'USAGE'});
    }
    if(command==='inbox'){
      if(!subcommand||subcommand==='list'){print(await call('inbox.list',{accountId:flags.account??null,botId:flags.bot??null,limit:Number(flags.limit)||50}),json);return;}
      const id=rest[0]||flags.bot;
      if(!id)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      if(subcommand==='get'){print(await call('inbox.get',{id}),json);return;}
      if(subcommand==='create'){print(await call('inbox.create',{accountId:flags.account??null,botId:flags.bot,text:flags.text??'',title:flags.title??'',files:flags.files??[]},600000),json);return;}
      if(subcommand==='submit'){print(await call('inbox.submit',{id,text:flags.text??'',files:flags.files??[]},600000),json);return;}
      if(subcommand==='retry'){print(await call('inbox.retry',{id},600000),json);return;}
      if(subcommand==='resolve'){print(await call('inbox.resolve',{id}),json);return;}
      if(subcommand==='dismiss'){print(await call('inbox.dismiss',{id}),json);return;}
      throw Object.assign(new Error('USAGE'),{code:'USAGE'});
    }
    if(command==='send'){
      if(!flags.bot)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      const mode=flags.direct?'direct':flags.compose?'compose':'now';
      print(await call('messages.send',{accountId:flags.account??null,botId:flags.bot,text:flags.text??'',files:flags.files??[],title:flags.title??'',mode},600000),json);return;
    }
    if(command==='wait'){
      const id=rest[0];if(!id)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      print(await call('messages.wait',{id,timeout:Number(flags.timeout)||60},(Number(flags.timeout)||60)*1000+5000),json);return;
    }
    if(command==='share'){
      if(subcommand==='update'){print(await call('share.update',{},120000),json);return;}
      if(subcommand==='order'){print(await call('share.order',{},120000),json);return;}
      print(await call('share.status'),json);return;
    }
    if(command==='settings'){
      if(!subcommand||subcommand==='get'){print(await call('settings.get'),json);return;}
      if(subcommand==='theme'){print(await call('settings.theme',{theme:rest[0]??'system'}),json);return;}
      if(subcommand==='composer'){print(await call('settings.composer',{afterSend:flags['after-send']??'hide',dismissOnOutside:flags.dismissOnOutside!==false}),json);return;}
      throw Object.assign(new Error('USAGE'),{code:'USAGE'});
    }
    if(command==='api'){
      const method=subcommand;if(!method)throw Object.assign(new Error('USAGE'),{code:'USAGE'});
      let params={};if(rest[0])params=JSON.parse(rest[0]);
      print(await call(method,params),json);return;
    }
    throw Object.assign(new Error('USAGE'),{code:'USAGE'});
  }catch(error){fail(error,json);}
}
await main();
