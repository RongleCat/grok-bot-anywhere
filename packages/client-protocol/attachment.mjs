import { createHash } from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import { API_ORIGIN, clientHeaders, requestJSON, validateOrigin } from './core.mjs';

export function chooseAgent(agents,name){
  const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const matches=agents.filter(agent=>typeof agent?.name==='string'&&normalize(agent.name)===normalize(name));
  if(matches.length!==1)throw new Error(matches.length?'RECIPIENT_AMBIGUOUS':'RECIPIENT_NOT_FOUND');
  if(!matches[0].agentId)throw new Error('RECIPIENT_ID_MISSING');
  return matches[0];
}

export function apiClient(options){
  return async(method,body)=>requestJSON(API_ORIGIN+'/aiserver.v1.GrokBotService/'+method,{headers:clientHeaders(options),body,fetchImpl:options.fetchImpl});
}

function uploadURL(value){
  let url;try{url=new URL(value);}catch{throw new Error('UNTRUSTED_UPLOAD_ORIGIN');}
  const host=url.hostname;
  const trusted=host.endsWith('.amazonaws.com')||host.endsWith('.r2.cloudflarestorage.com')||host==='storage.googleapis.com'||host.endsWith('.storage.googleapis.com');
  if(!trusted||url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443'))throw new Error('UNTRUSTED_UPLOAD_ORIGIN');
  return url.toString();
}

export function validateReplies(entries,expected){
  const replies=entries.filter(entry=>entry.kind==='send-message'&&entry.message?.type==='text'&&typeof entry.message.content==='string');
  const text=replies.filter(entry=>entry.message.content.includes(expected.messageId)).map(entry=>entry.message.content).join('\n');
  const checks={hashMatched:text.toLowerCase().includes(expected.attachment.sha256),byteCountMatched:text.replace(/,/g,'').includes(String(expected.attachment.bytes)),titleMatched:text.includes(expected.attachment.firstHeading),markerMatched:text.includes(expected.messageId)};
  return {...checks,verified:Object.values(checks).every(Boolean)};
}

async function uploadBox(options,rpc,step){
  let connection;
  for(let attempt=0;attempt<13;attempt++){
    const result=await rpc('EnsureSandBox',{wake:attempt>0,supportsAsleepBox:true});
    if(!result.ok)throw new Error('UPLOAD_BROKER_FAILED');
    if(result.data?.gatewayUrl&&result.data?.gatewayToken){connection=result.data;break;}
    step({name:'EnsureSandBox',httpStatus:result.httpStatus,hostReady:false,wake:attempt>0});
    if(attempt>0)await(options.sleepImpl??sleep)(10000);
  }
  if(!connection)throw new Error('UPLOAD_HOST_NOT_READY');
  const base=validateOrigin(connection.gatewayUrl,'gateway');
  const headers={authorization:`Bearer ${connection.gatewayToken}`,'content-type':'application/json'};
  if(connection.networkToken)headers['x-anyrun-network-token']=connection.networkToken;
  const result=await requestJSON(base+'/api/uploadAttachment',{headers,body:{agentId:options.agent.agentId,filename:options.filename,bytesBase64:options.bytes.toString('base64')},fetchImpl:options.fetchImpl});
  if(!result.ok||typeof result.data?.path!=='string'||!result.data.path)throw new Error('UPLOAD_GATEWAY_FAILED');
  step({name:'gateway.uploadAttachment',httpStatus:result.httpStatus,pathPresent:true,bytes:options.bytes.length});
  return result.data.path;
}

export async function uploadAttachment(options){
  const {agent,filename,bytes}=options;
  if(!agent?.agentId||!filename||!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>4*1024*1024)throw new Error('ATTACHMENT_INPUT_INVALID');
  const rpc=apiClient(options);
  const step=options.onStep??(()=>{});
  const begun=await rpc('BeginGrokBotAttachmentUpload',{agentId:agent.agentId,...agent.viewerSessionId?{sessionId:agent.viewerSessionId}:{},fileName:filename,sizeBytes:String(bytes.length),supportsStoreAttachmentRefs:true,supportsMultipart:false,sha256Hex:createHash('sha256').update(bytes).digest('hex')});
  if(!begun.ok)throw new Error('UPLOAD_BEGIN_FAILED');
  const session=begun.data;
  step({name:'BeginGrokBotAttachmentUpload',httpStatus:begun.httpStatus,mode:session?.mode});
  let attachmentPath;
  if([1,'GROK_BOT_ATTACHMENT_UPLOAD_MODE_USE_BOX'].includes(session?.mode)){
    attachmentPath=await uploadBox(options,rpc,step);
  }else{
  if(![2,'GROK_BOT_ATTACHMENT_UPLOAD_MODE_SINGLE_PUT'].includes(session?.mode))throw new Error('UPLOAD_MODE_UNSUPPORTED');
  if(!session.uploadToken||!session.put?.url)throw new Error('UPLOAD_TARGET_INVALID');
  const url=uploadURL(session.put.url);
  const headers={};
  for(const [key,value] of Object.entries(session.put.headers??{})){
    const name=key.toLowerCase();
    if(name==='authorization'||name==='cookie'||name.startsWith('x-cursor-'))throw new Error('UPLOAD_HEADERS_INVALID');
    if(name==='content-length'){if(value!==String(bytes.length))throw new Error('UPLOAD_LENGTH_MISMATCH');continue;}
    headers[name]=value;
  }
  let put;
  try{put=await(options.fetchImpl??fetch)(url,{method:'PUT',headers,body:bytes,redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new Error('UPLOAD_PUT_FAILED');}
  await put.body?.cancel();
  if(!put.ok)throw new Error('UPLOAD_PUT_FAILED');
  step({name:'storage.PUT',httpStatus:put.status,bytes:bytes.length});
  const completed=await rpc('CompleteGrokBotAttachmentUpload',{uploadToken:session.uploadToken});
  if(!completed.ok)throw new Error('UPLOAD_COMMIT_FAILED');
  const committed=completed.data;
  if(!committed||![undefined,0,'GROK_BOT_ATTACHMENT_UPLOAD_REFUSAL_UNSPECIFIED'].includes(committed.refusal)||typeof committed.alias!=='string'||!committed.alias)throw new Error('UPLOAD_COMMIT_REFUSED');
  if(committed.sizeBytes!==undefined&&BigInt(committed.sizeBytes)!==BigInt(bytes.length))throw new Error('UPLOAD_SIZE_MISMATCH');
  step({name:'CompleteGrokBotAttachmentUpload',httpStatus:completed.httpStatus,aliasPresent:true});
  attachmentPath=committed.alias;
  }
  return attachmentPath;
}

export async function uploadAndSend(options){
  const {agent,filename,bytes,messageId,prompt}=options;
  if(!messageId||!prompt)throw new Error('ATTACHMENT_INPUT_INVALID');
  const attachmentPath=await uploadAttachment(options);
  const rpc=apiClient(options),step=options.onStep??(()=>{});
  step({name:'send-attempt',messageId});
  const result=await rpc('SendGrokBotUserMessage',{agentId:agent.agentId,messageId,text:prompt,sentAtMs:String(Date.now()),sessionId:agent.viewerSessionId??'',attachmentPaths:[attachmentPath],attachmentNames:[filename],isFork:false,source:1,initiator:1,sendSource:1});
  if(!result.ok)throw new Error('SEND_UNCONFIRMED');
  const deliveries={1:'accepted-box',2:'accepted-temporal',3:'duplicate',GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_BOX:'accepted-box',GROK_BOT_USER_MESSAGE_DELIVERY_ACCEPTED_TEMPORAL:'accepted-temporal',GROK_BOT_USER_MESSAGE_DELIVERY_DUPLICATE:'duplicate'};
  const delivery=deliveries[result.data?.delivery];
  if(!delivery)throw new Error('SEND_REFUSED_OR_UNCONFIRMED');
  step({name:'SendGrokBotUserMessage',httpStatus:result.httpStatus,delivery});
  return {messageId,delivery,dispatched:result.data.dispatched===true,attachment:{filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}};
}
