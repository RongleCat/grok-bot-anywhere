import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {basename,resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {desktopCredentials} from './desktop.mjs';
import {apiClient,chooseAgent,uploadAndSend,validateReplies} from './attachment.mjs';

const args=process.argv.slice(2);
const arg=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const reportPath=resolve(arg('--report')??'docs/reference/api/webhook-attachment-live-report.json');
let report;
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
const event=value=>console.log(JSON.stringify(value));
async function observe(rpc,agent,seconds){
  const deadline=Date.now()+seconds*1000;let attempts=0;
  while(Date.now()<deadline){
    const result=await rpc('ListGrokBotTranscriptEntries',{agentId:agent.agentId,sessionId:agent.viewerSessionId??'',limit:80});
    if(!result.ok){event({phase:'reply-read',status:'failed',httpStatus:result.httpStatus,code:result.code});await sleep(10000);continue;}
    const rows=result.data.entries??[];
    const changed=result.data.generation!==report.baselineGeneration;
    const fresh=rows.filter(row=>changed||BigInt(row.seq??0)>BigInt(report.baselineSeq));
    const replies=[],bodies=[];let kinds={};
    for(const row of fresh){
      if(!row.body)continue;
      let body;try{body=JSON.parse(Buffer.from(row.body,'base64').toString('utf8'));}catch{continue;}
      bodies.push(body);
      const kind=body.kind??row.entryKind;kinds[kind]=(kinds[kind]??0)+1;
      if(body.kind==='send-message'&&body.message?.type==='text'&&typeof body.message.content==='string')replies.push({seq:row.seq,id:body.id,text:body.message.content});
    }
    report.observation={attempts:++attempts,newRows:fresh.length,kinds,bodyOmittedCount:fresh.filter(x=>!x.body).length};
    const correlated=replies.filter(reply=>reply.text.includes(report.messageId));
    if(correlated.length){
      report.replies=correlated;
      report.validation=validateReplies(bodies,report);
      report.status=report.validation.verified?'attachment-read-verified':'reply-received';
      save();event({phase:'bot-reply',status:report.status,validation:report.validation,replies:correlated.map(x=>x.text.slice(0,4500))});
      if(report.status==='attachment-read-verified')return;
    }else{save();if(attempts===1||attempts%3===0)event({phase:'awaiting-bot-reply',...report.observation});}
    await sleep(10000);
  }
  if(report.status!=='reply-received')report.status='sent-awaiting-reply';save();event({phase:'observation-ended',status:report.status,reportPath});
}
try{
  if(!args.includes('--send')&&!args.includes('--observe')&&!args.includes('--resume-unsent'))throw new Error('SEND_OR_OBSERVE_REQUIRED');
  await mkdir(dirname(reportPath),{recursive:true});
  if(args.includes('--send')){
    try{await access(reportPath);throw new Error('SEND_REPORT_ALREADY_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
  }else report=JSON.parse(await readFile(reportPath,'utf8'));
  if(args.includes('--resume-unsent')&&report.sendAttempted!==false)throw new Error('SEND_ALREADY_ATTEMPTED');
  const credentials=await desktopCredentials();const rpc=apiClient(credentials);
  const roster=await rpc('ListGrokBotAgents',{includeTeamAgents:true});
  if(!roster.ok||!Array.isArray(roster.data?.agents))throw new Error('ROSTER_READ_FAILED');
  const agent=chooseAgent(roster.data.agents,arg('--bot')??'webhook 测试员');
  if(report&&report.targetAgentId!==agent.agentId)throw new Error('OBSERVATION_TARGET_CHANGED');
  event({phase:'recipient-selected',name:agent.name,harness:agent.harness});
  if(args.includes('--send')||args.includes('--resume-unsent')){
    const path=arg('--file');if(!path)throw new Error('FILE_REQUIRED');
    const bytes=await readFile(resolve(path));const filename=basename(path);const messageId=report?.messageId??randomUUID();
    if(report&&(report.attachment.filename!==filename||report.attachment.sha256!==createHash('sha256').update(bytes).digest('hex')))throw new Error('ATTACHMENT_CHANGED');
    const baseline=await rpc('ListGrokBotTranscriptEntries',{agentId:agent.agentId,sessionId:agent.viewerSessionId??'',limit:5});
    if(!baseline.ok||!Array.isArray(baseline.data?.entries))throw new Error('TRANSCRIPT_BASELINE_FAILED');
    const baselineSeq=baseline.data.entries.reduce((max,row)=>BigInt(row.seq??0)>BigInt(max)?String(row.seq):max,'0');
    const prompt=`附件读取验收 [MVP-attachment-check:${messageId}]\n请实际打开并读取附件《${filename}》的完整内容。本次任务为附件读取测试，请回复：\n1. 文件第一行标题的原文；\n2. 原始文件字节数和 SHA-256（按附件原始字节计算，不重新编码）；\n3. 所有一级和二级章节标题，以及末尾最后一个来源编号；\n4. 约 200 字中文概要，说明 ESP32 的定位、芯片路线、生态和真实案例。\n若无法访问附件，请明确说明，不要猜测标题、哈希或内容。请在回复里带上本次验收标记。`;
    report={date:new Date().toISOString(),targetName:agent.name,targetAgentId:agent.agentId,messageId,baselineSeq,baselineGeneration:baseline.data.generation,status:'prepared',sendAttempted:false,steps:[],attachment:{filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),firstHeading:bytes.toString('utf8').split('\n')[0].replace(/^#\s*/,'' )}};save();
    try{
      const result=await uploadAndSend({...credentials,agent,filename,bytes,messageId,prompt,onStep:step=>{report.steps.push(step);if(step.name==='send-attempt')report.sendAttempted=true;save();event({phase:'protocol-step',...step});}});
      report.send=result;report.status='sent';save();
    }catch(e){
      report.status='failed';report.code=/^[A-Z_]+$/.test(e.message)?e.message:'ATTACHMENT_TEST_FAILED';
      if(report.sendAttempted){
        const state=await rpc('GetGrokBotSendStatus',{agentId:agent.agentId,messageId,sessionId:agent.viewerSessionId??''});
        report.sendLookup={httpStatus:state.httpStatus,status:state.ok?state.data?.status:'failed'};
        if([2,'GROK_BOT_SEND_STATUS_ACCEPTED'].includes(state.data?.status))report.status='sent';
      }
      save();if(report.status!=='sent')throw e;
    }
  }
  await observe(rpc,agent,Number(arg('--wait-seconds')??180));
}catch(e){
  const code=/^[A-Z_]{1,80}$/.test(e.message)?e.message:'ATTACHMENT_TEST_FAILED';
  event({status:'failed',code,reportPath});process.exitCode=1;
}
