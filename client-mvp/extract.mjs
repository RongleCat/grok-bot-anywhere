import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export function balanced(source,start,open='{',close='}') {
  if(source[start]!==open)throw new Error('BLOCK_START_INVALID');
  let depth=0,quote=null,escape=false;
  for(let i=start;i<source.length;i++){
    const c=source[i];
    if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c===open)depth++;else if(c===close&&--depth===0)return {text:source.slice(start,i+1),end:i+1};
  }
  throw new Error('BLOCK_UNTERMINATED');
}

function fieldsOf(raw) {
  return raw.split('|').slice(1).map(part=>{
    const [tag,name,type]=part.trim().split(/\s+/);
    return {tag:Number(tag),name,type:type?.replace(/[?!*]$/,''),optional:type?.endsWith('?')??false,repeated:type?.endsWith('*')??false};
  });
}

export function parseProtocol(source) {
  const messages={};
  const classes=/([\w$]+)=class(?:\s+[\w$]+)?\s+extends\s+[\w$.]+\s*\{/g;
  for(const match of source.matchAll(classes)){
    const start=match.index+match[0].length-1;
    const block=balanced(source,start).text;
    const schema=block.match(/static\s+\$\(\)\{return\["([^"\n]+)"([^\]]*)\]/);
    if(schema)messages[match[1]]={name:schema[1].split('|')[0],fields:fieldsOf(schema[1]),references:schema[2].split(',').map(x=>x.trim()).filter(x=>/^[\w$]+$/.test(x))};
  }
  const services=[];
  for(const match of source.matchAll(/typeName:"([\w.]+)",methods:\{/g)){
    const block=balanced(source,match.index+match[0].length-1).text;
    const methods=[];
    for(const m of block.matchAll(/([\w$]+):\{name:"([\w]+)",I:([\w$]+),O:([\w$]+),kind:[\w$]+\.([\w]+)/g)){
      methods.push({clientMethod:m[1],name:m[2],kind:m[5],request:messages[m[3]]??{name:m[3],unresolved:true},response:messages[m[4]]??{name:m[4],unresolved:true},path:`/${match[1]}/${m[2]}`,evidence:'static-service-descriptor'});
    }
    services.push({name:match[1],methods});
  }
  return {services,messages};
}

function splitTop(source) {
  const parts=[];let start=0,depth=0,quote=null,escape=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if('({['.includes(c))depth++;else if(')}]'.includes(c))depth--;
    else if(c===','&&depth===0){parts.push(source.slice(start,i));start=i+1;}
  }
  parts.push(source.slice(start));return parts;
}

function resolveObject(source,expression,seen=new Set()) {
  const expr=expression.trim();
  if(expr.startsWith('{'))return balanced(expr,0).text;
  const wrapped=expr.match(/^\(0,[\w$]+\.rpcObject\)\(\s*\{/);
  if(wrapped)return balanced(expr,wrapped[0].length-1).text;
  const objectCall=expr.match(/^\(0,[\w$]+\.rpcObject\)\(/);
  if(objectCall)return resolveObject(source,balanced(expr,objectCall[0].length-1,'(',')').text.slice(1,-1),seen);
  if(!/^[\w$]+$/.test(expr)||seen.has(expr))return null;
  seen.add(expr);
  const escaped=expr.replace(/\$/g,'\\$');
  const matches=[...source.matchAll(new RegExp(`\\b${escaped}=`,'g'))];
  for(const m of matches.reverse()){
    const rest=source.slice(m.index+m[0].length);
    const prefix=rest.match(/^(?:\(0,[\w$]+\.rpcObject\)\()?\s*\{/);
    if(prefix)return balanced(rest,prefix[0].length-1).text;
    const transformed=rest.match(/^wF\(/);
    if(transformed){
      const args=balanced(rest,transformed[0].length-1,'(',')').text.slice(1,-1);
      return resolveObject(source,splitTop(args)[0],seen);
    }
  }
  return null;
}

function fieldShape(expression) {
  const match=expression.trim().match(/^\(0,[\w$]+\.rpc([\w]+)\)\(/);
  if(!match)return {type:'custom',optional:false,nullable:false};
  const kind=match[1].toLowerCase();
  if(kind==='optional'||kind==='nullable'){
    const raw=expression.trim();
    const inner=balanced(raw,match[0].length-1,'(',')').text.slice(1,-1);
    return {...fieldShape(inner),[kind]:true};
  }
  return {type:['array','record','object','union','string','number','boolean','literal'].includes(kind)?kind:'custom',optional:false,nullable:false};
}

function gatewayFields(source,expression,seen=new Set()) {
  const object=resolveObject(source,expression,seen);
  if(!object)return [];
  const result=[];
  for(const part of splitTop(object.slice(1,-1))){
    if(part.startsWith('...')){result.push(...gatewayFields(source,part.slice(3),new Set(seen)));continue;}
    const m=part.match(/^\s*([\w$]+):([\s\S]*)$/);if(!m)continue;
    result.push({name:m[1],...fieldShape(m[2])});
  }
  return result;
}

export function parseGateway(source) {
  const match=/\b[\w$]+=Zo\("gateway",\{methods:\{/.exec(source);
  if(!match)return [];
  const start=match.index+match[0].length-1;
  const block=balanced(source,start).text;
  const results=[];
  for(const part of splitTop(block.slice(1,-1))){
    const method=part.match(/^([\w$]+):k\(\)\.(noArgs|args)/);if(!method)continue;
    let argument='';
    if(method[2]==='args'){
      const pos=part.indexOf('(',method[0].length);
      argument=balanced(part,pos,'(',')').text.slice(1,-1);
    }
    results.push({name:method[1],path:`/api/${method[1]}`,fields:argument?gatewayFields(source.slice(0,start),argument):[],.../^[\w$]+$/.test(argument)?{schemaReference:argument}:{},evidence:'static-client-gateway-declaration',tested:false});
  }
  return results;
}

export async function readBundle(app) {
  const bytes=await readFile(app+'/Contents/Resources/app.asar');
  const length=bytes.readUInt32LE(12);
  const header=JSON.parse(bytes.subarray(16,16+length).toString());
  const base=8+bytes.readUInt32LE(4);
  function entry(path){let value=header;for(const part of path.split('/'))value=value.files[part];return value;}
  const read=path=>{const info=entry(path);return bytes.subarray(base+Number(info.offset),base+Number(info.offset)+info.size).toString();};
  return {read,sha256:createHash('sha256').update(bytes).digest('hex')};
}

export async function generateInventory(app) {
  const bundle=await readBundle(app);
  const proto=bundle.read('dist/electron-main/proto.cjs');
  const main=bundle.read('dist/electron-main/main-app.cjs');
  const protocol=parseProtocol(proto);
  for(const service of protocol.services)for(const method of service.methods){
    method.staticCallReferenceCount=[...main.matchAll(new RegExp(`\\.${method.clientMethod}\\s*\\(`,'g'))].length;
  }
  const version=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',app+'/Contents/Info.plist'],{encoding:'utf8'}).trim();
  const result={source:{appVersion:version,asarSHA256:bundle.sha256,date:'2026-10-14'},...protocol,gateway:parseGateway(main)};
  const directory=resolve('docs/api');await mkdir(directory,{recursive:true});
  await writeFile(directory+'/client-api-inventory.json',JSON.stringify(result,null,2)+'\n');
  const lines=['# Grok Bot 客户端静态接口目录','',`来源：本机 ${version}，app.asar SHA256 ${bundle.sha256}。`,'','此目录是bundle中的服务/方法声明，不是全部请求的抓包记录。实测范围见 grok-bot-client-api.md 和脱敏报告；其他方法不宣称已经调用或可由普通账号访问。引用数按 main-app.cjs 中 .clientMethod( 的文本匹配计数，同名方法跨服务会重复计数，不能当作网络调用次数。字段来自发布包的schema元数据，接口版本更新后应重新提取。','','## Connect RPC 服务',''];
  for(const service of result.services){
    lines.push(`### ${service.name}`,'','| Method | 类型 | Request | Response | 静态引用数 |','| --- | --- | --- | --- | --- |');
    for(const method of service.methods)lines.push(`| ${method.name} | ${method.kind} | ${method.request.name} | ${method.response.name} | ${method.staticCallReferenceCount} |`);
    lines.push('');
  }
  lines.push('## Gateway 客户端方法声明','','这些方法按已验证的 /api/<method> 传输规则列出；写/审批/管理员操作没有执行。字段类型为静态组合器解析结果，custom/引用的严格约束见人工文档和JSON目录。','','| 方法 | 字段 |','| --- | --- |');
  for(const method of result.gateway)lines.push(`| ${method.name} | ${method.fields.map(f=>`${f.name}${f.optional?'?':''}: ${f.type}${f.nullable?' or null':''}`).join('; ')||'无参数或未解析schema'} |`);
  lines.push('','## 数量','',`- ${result.services.length} 个服务描述符，${result.services.reduce((n,s)=>n+s.methods.length,0)} 个RPC方法。`,`- ${result.gateway.length} 个gateway方法声明。`,'- JSON目录包含请求/响应字段、tag、类型及引用；没有用户账号数据或凭据。','');
  await writeFile(directory+'/client-api-catalog.md',lines.join('\n'));
  return {appVersion:version,serviceCount:result.services.length,rpcMethodCount:result.services.reduce((n,s)=>n+s.methods.length,0),gatewayMethodCount:result.gateway.length,outputFiles:['docs/api/client-api-inventory.json','docs/api/client-api-catalog.md']};
}
