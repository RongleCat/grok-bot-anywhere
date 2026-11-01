import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createLogin, verify, pollLogin } from './core.mjs';

import {desktopCredentials,version} from './desktop.mjs';

const args=process.argv.slice(2);
async function report(value){
  if(value.steps?.some(step=>step.status==='failed'))process.exitCode=1;
  const output=JSON.stringify(value,null,2)+'\n';
  console.log(output.trim());
  const index=args.indexOf('--report');
  if(index>=0){
    if(!args[index+1])throw new Error('REPORT_PATH_REQUIRED');
    const path=resolve(args[index+1]);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,output,{mode:0o600});
  }
}
try{
  if(args[0]==='inventory'){
    const {generateInventory}=await import('./extract.mjs');
    console.log(JSON.stringify(await generateInventory('/Applications/Grok Bot.app'),null,2));
  }else if(args[0]==='verify'&&args.includes('--desktop')){
    console.log(JSON.stringify({phase:'desktop-authorization',credentialValuesLogged:false}));
    await report(await verify({...await desktopCredentials(),cloudRoster:true,cloudOnly:args.includes('--cloud-only')}));
  }else if(args[0]==='login'){
    const flow=createLogin();
    console.log(JSON.stringify({phase:'browser-login',loginUrl:flow.loginUrl,credentialsPersisted:false}));
    if(!args.includes('--no-open'))execFileSync('/usr/bin/open',[flow.loginUrl],{stdio:'ignore'});
    const credentials=await pollLogin(flow,{onPending:attempt=>{if(attempt===1||attempt%6===0)console.log(JSON.stringify({phase:'awaiting-browser-authorization',attempt}));}});
    console.log(JSON.stringify({phase:'authorized',accessTokenPresent:!!credentials.accessToken,refreshTokenPresent:!!credentials.refreshToken}));
    await report(await verify({accessToken:credentials.accessToken,teamId:credentials.selectedTeamId,version:version(),mode:'fresh-browser-login',cloudRoster:true,cloudOnly:args.includes('--cloud-only')}));
  }else{
    console.log('Usage: node packages/client-protocol/cli.mjs inventory | verify --desktop [--cloud-only] [--report path] | login [--no-open] [--cloud-only] [--report path]');
    process.exitCode=2;
  }
}catch(error){
  const code=error instanceof Error && /^[A-Z_]{1,80}$/.test(error.message)?error.message:'MVP_FAILED';
  console.log(JSON.stringify({status:'failed',code,credentialValuesLogged:false}));process.exitCode=1;
}
