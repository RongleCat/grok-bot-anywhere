import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {chmod,lstat,mkdir,readdir,readFile,readlink,symlink,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {disableCli,enableCli,parseRegPath,parseWindowsPathOutput,pathHasDir,posixLauncher,profileDocument,quoteSh,samePath,WINDOWS_ENV_BROADCAST,WINDOWS_PATH_ENV,WINDOWS_PATH_MISSING,WINDOWS_PATH_READ,WINDOWS_PATH_WRITE,windowsCommand,windowsPathAppend,windowsPathHasDir,windowsPathRemove,windowsPowerShell,writeCliCredential} from '../src/main/cli-bridge.mjs';

const run=promisify(execFile);

async function fixture(){
  const home=await mkdtemp(join(tmpdir(),'gba-cli-'));
  const bundle=join(home,'bundle'),runtime=join(home,'runtime');
  await mkdir(join(bundle,'bin'),{recursive:true});
  await writeFile(join(bundle,'SKILL.md'),'# grok-bot\n');
  await writeFile(join(bundle,'bin','grok-bot.mjs'),'console.log("bundled")\n');
  await writeFile(runtime,'#!/bin/sh\nprintf "%s\\n" "$ELECTRON_RUN_AS_NODE"\nprintf "%s\\n" "$GROK_BOT_CONFIG_DIR"\nprintf "%s\\n" "$1"\n');
  await chmod(runtime,0o755);
  return {home,bundle,runtime,config:join(home,'cli-config')};
}

test('profile keeps the app access token and leaves the refresh token out',()=>{
  assert.equal(profileDocument(null),null);
  assert.deepEqual(profileDocument({accessToken:'token-a',refreshToken:'secret',teamId:7}),{accessToken:'token-a',selectedTeamId:7});
  assert.equal(quoteSh(`/App's/Electron`),`'/App'\\''s/Electron'`);
});

test('windows path keeps unexpanded variables and appends only a missing directory',()=>{
  const queried='    Path    REG_EXPAND_SZ    %USERPROFILE%\\bin\r\n';
  assert.deepEqual(parseRegPath(queried),{type:'REG_EXPAND_SZ',value:'%USERPROFILE%\\bin'});
  assert.equal(windowsPathHasDir('%USERPROFILE%\\.local\\bin','C:\\Users\\me\\.local\\bin','C:\\Users\\me'),true);
  assert.equal(windowsPathHasDir('%USERPROFILE%\\.local\\bin','C:\\Users\\me\\.local\\bin'),false);
  assert.equal(windowsPathAppend('C:\\Windows','D:\\App\\.local\\bin'),'C:\\Windows;D:\\App\\.local\\bin');
  assert.equal(windowsPathAppend('C:\\Windows;D:\\App\\.local\\bin','D:\\App\\.local\\bin'),'C:\\Windows;D:\\App\\.local\\bin');
  assert.equal(windowsPathRemove('%USERPROFILE%\\.local\\bin;C:\\Abs\\.local\\bin','C:\\Abs\\.local\\bin'),'%USERPROFILE%\\.local\\bin');
  assert.equal(samePath('\\\\?\\C:\\App\\skill\\','c:\\app\\skill','win32'),true);
  assert.equal(samePath('\\\\?\\UNC\\server\\share\\','\\\\server\\share','win32'),true);
  assert.equal(samePath('/App/Skill','/app/skill','darwin'),false);
  assert.equal(samePath('/App/Skill/','/App/Skill','darwin'),true);
});

test('the PATH list splits with the target platform separator, not the host one',()=>{
  assert.equal(pathHasDir('/usr/local/bin:/usr/bin','/usr/bin','darwin'),true);
  assert.equal(pathHasDir('C:\\bin;D:\\tools','D:\\tools','win32'),true);
  // A ';' list is not a POSIX PATH: splitting it with ':' must not match.
  assert.equal(pathHasDir('C:\\bin;D:\\tools','D:\\tools','darwin'),false);
  assert.equal(pathHasDir('/usr/local/bin:/usr/bin','/usr/bin','win32'),false);
});

test('enable registers the command, skill, Claude link, and app credential',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  try{
    const enabled=await enableCli({home,platform:'darwin',pathEnv:'/usr/bin',bundleDir:bundle,configDir:config,runtime,credentials:{accessToken:'app-token',teamId:3},now:'2026-10-30T00:00:00.000Z'});
    assert.equal(enabled.enabled,true);
    assert.equal(enabled.credential,true);
    assert.equal(enabled.pathSnippet,true);
    assert.equal(await readlink(enabled.command),join(enabled.skillsPath,'scripts','grok-bot'));
    assert.equal(await readlink(join(home,'.claude','skills','grok-bot')),enabled.skillsPath);
    const skill=await readFile(join(enabled.skillsPath,'SKILL.md'),'utf8');
    assert.match(skill,/grok-bot/);
    const launcher=await readFile(join(enabled.skillsPath,'scripts','grok-bot'),'utf8');
    assert.match(launcher,/ELECTRON_RUN_AS_NODE/);
    assert.equal(launcher.includes('app-token'),false);
    const profile=JSON.parse(await readFile(join(config,'profiles','default.json'),'utf8'));
    assert.deepEqual(profile,{accessToken:'app-token',selectedTeamId:3});
    // Windows has no POSIX mode bits: chmod there reports 0o666 and the file is
    // protected by inherited ACLs instead, so only the POSIX hosts can assert 0600.
    if(process.platform!=='win32')assert.equal((await lstat(join(config,'profiles','default.json'))).mode&0o777,0o600);
    assert.match(await readFile(join(home,'.zprofile'),'utf8'),/# grok-bot-anywhere/);
    // The launcher installs as a POSIX shell script; Windows cannot exec it
    // (spawn has no shebang support). The layout above is still checked there.
    if(process.platform!=='win32'){
      const {stdout}=await run(enabled.command,['--version']);
      assert.equal(stdout,`1\n${config}\n${join(enabled.skillsPath,'bin','grok-bot.mjs')}\n`);
    }
    const disabled=await disableCli({home,platform:'darwin',configDir:config,removePath:enabled.pathSnippet});
    assert.equal(disabled.enabled,false);
    assert.equal(existsSync(enabled.command),false);
    assert.equal(existsSync(enabled.skillsPath),false);
    assert.equal(existsSync(join(home,'.claude','skills','grok-bot')),false);
    assert.equal(existsSync(join(config,'profiles','default.json')),false);
    assert.equal((await readFile(join(home,'.zprofile'),'utf8')).includes('# grok-bot-anywhere'),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('windows install writes the cmd launcher and appends Path as REG_EXPAND_SZ',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const links=[],commands=[];
  let pathValue='%USERPROFILE%\\Windows';
  const execFileImpl=async(file,args,options)=>{
    assert.equal(options?.windowsHide,true);
    assert.equal(options?.encoding,'utf8');
    commands.push([file,args]);
    const script=args.at(-1);
    if(script===WINDOWS_PATH_READ)return {stdout:`ExpandString\r\n${pathValue}\r\n`};
    if(script===WINDOWS_PATH_WRITE){
      const written=options?.env?.[WINDOWS_PATH_ENV];
      assert.equal(typeof written,'string');
      assert.equal(args.some(part=>String(part).includes(written)),false);
      pathValue=written;
      return {stdout:''};
    }
    if(script===WINDOWS_ENV_BROADCAST){assert.equal(options?.timeout,8000);assert.match(script,/SendMessageTimeout/);assert.match(script,/0x1A/);assert.match(script,/Environment/);return {stdout:''};}
    throw new Error(`unexpected ${file}`);
  };
  try{
    const enabled=await enableCli({home,platform:'win32',pathEnv:'',bundleDir:bundle,configDir:config,runtime,credentials:{accessToken:'app-token'},now:'2026-10-31T00:00:00.000Z',execFileImpl,symlinkImpl:async(target,path,type)=>{links.push({target,path,type});}});
    assert.equal(enabled.enabled,true);
    assert.equal(enabled.pathSnippet,true);
    assert.equal(enabled.claudeLinked,true);
    assert.equal(links.length,1);
    assert.equal(links[0].type,'junction');
    assert.equal(links[0].target,enabled.skillsPath);
    assert.match(enabled.command,/grok-bot\.cmd$/);
    const ps1=await readFile(join(enabled.skillsPath,'scripts','grok-bot.ps1'),'utf8');
    assert.equal(ps1.charCodeAt(0),0xFEFF);
    assert.match(ps1,/& "\$PSScriptRoot\\grok-bot\.cmd" @args; exit \$LASTEXITCODE/);
    assert.equal(ps1.includes('powershell.exe'),false);
    const expected=windowsCommand({runtime,script:join(enabled.skillsPath,'bin','grok-bot.mjs'),configDir:config});
    const command=await readFile(enabled.command,'utf8');
    assert.equal(command,expected);
    assert.equal(await readFile(join(enabled.skillsPath,'scripts','grok-bot.cmd'),'utf8'),expected);
    assert.match(expected,/for \/f "tokens=2 delims=:\." %%a in \('chcp'\) do set "_cp=%%a"\r\nchcp 65001 >nul\r\n/);
    assert.match(expected,/setlocal DisableDelayedExpansion\r\nfor \/f "tokens=2 delims=:\." %%a in \('chcp'\)/);
    assert.match(expected,/set "ELECTRON_RUN_AS_NODE=1"\r\n/);
    assert.match(expected,/set "GROK_BOT_CONFIG_DIR=/);
    assert.equal(expected.includes('="'),false);
    assert.match(expected,/set "GROK_BOT_NO_AUTO_INSTALL=1"\r\n/);
    assert.match(expected,/CLI_RUNTIME_MISSING/);
    assert.match(expected,/exit \/b 127/);
    assert.match(expected,/set "GROK_BOT_EXIT=%ERRORLEVEL%"\r\nchcp %_cp% >nul\r\nexit \/b %GROK_BOT_EXIT%\r\n$/);
    assert.equal(expected.includes('powershell'),false);
    assert.equal(expected.split('\n').slice(0,-1).every(line=>line.endsWith('\r')),true);
    const skill=await readFile(join(enabled.skillsPath,'SKILL.md'),'utf8');
    assert.match(skill,/grok-bot/);
    assert.equal(commands[0][0],'powershell.exe');
    assert.equal(commands[0][1].at(-1),WINDOWS_PATH_READ);
    assert.equal(commands[1][0],'powershell.exe');
    assert.equal(commands[1][1].at(-1),WINDOWS_PATH_WRITE);
    assert.equal(pathValue.startsWith('%USERPROFILE%\\Windows;'),true);
    assert.equal(pathValue.endsWith(join(home,'.local','bin')),true);
    const beforeRemove=commands.length;
    await disableCli({home,platform:'win32',configDir:config,removePath:true,execFileImpl});
    assert.equal(pathValue,'%USERPROFILE%\\Windows');
    assert.ok(commands.length>beforeRemove);
    assert.equal(existsSync(join(config,'profiles','default.json')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('windows leaves an existing user Path entry where it is',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const commands=[];
  const execFileImpl=async(file,args)=>{
    const script=args.at(-1);
    commands.push(script===WINDOWS_PATH_READ?'read':'write');
    if(script===WINDOWS_PATH_READ)return {stdout:'ExpandString\n%USERPROFILE%\\.local\\bin\n'};
    throw new Error('PATH_WRITTEN');
  };
  try{
    const enabled=await enableCli({home,platform:'win32',pathEnv:'',bundleDir:bundle,configDir:config,runtime,execFileImpl,symlinkImpl:async()=>{}});
    assert.equal(enabled.pathSnippet,false);
    assert.deepEqual(commands,['read']);
    commands.length=0;
    await disableCli({home,platform:'win32',configDir:config,removePath:false,execFileImpl});
    assert.deepEqual(commands,[]);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('a command the app did not install is left alone',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  try{
    await mkdir(join(home,'.local','bin'),{recursive:true});
    const command=join(home,'.local','bin','grok-bot');
    await writeFile(command,'#!/bin/sh\necho other\n');
    await assert.rejects(enableCli({home,platform:'darwin',pathEnv:`${join(home,'.local','bin')}:/usr/bin`,bundleDir:bundle,configDir:config,runtime}),/CLI_COMMAND_EXISTS/);
    assert.equal(await readFile(command,'utf8'),'#!/bin/sh\necho other\n');
    assert.equal(existsSync(join(home,'.agents','skills','grok-bot')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('a user-installed grok-bot skill is not replaced',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const dest=join(home,'.agents','skills','grok-bot');
  const script=join(dest,'scripts','grok-bot');
  const command=join(home,'.local','bin','grok-bot');
  try{
    await mkdir(join(dest,'scripts'),{recursive:true});
    await writeFile(join(dest,'SKILL.md'),'# mine\n');
    await writeFile(script,'#!/bin/sh\necho mine\n');
    await mkdir(join(home,'.local','bin'),{recursive:true});
    await symlink(script,command);
    await assert.rejects(enableCli({home,platform:'darwin',pathEnv:`${join(home,'.local','bin')}:/usr/bin`,bundleDir:bundle,configDir:config,runtime,credentials:{accessToken:'app-token'}}),/CLI_COMMAND_EXISTS/);
    assert.equal(await readFile(join(dest,'SKILL.md'),'utf8'),'# mine\n');
    assert.equal(await readlink(command),script);
    assert.equal(existsSync(join(home,'.claude','skills','grok-bot')),false);
    assert.equal(existsSync(join(config,'profiles','default.json')),false);
    assert.equal(existsSync(join(home,'.zprofile')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('a command that only shares the grok-bot script suffix is left alone',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const other=join(home,'other-skill','grok-bot','scripts','grok-bot');
  const command=join(home,'.local','bin','grok-bot');
  try{
    await mkdir(join(home,'other-skill','grok-bot','scripts'),{recursive:true});
    await writeFile(other,'#!/bin/sh\necho other\n');
    await mkdir(join(home,'.local','bin'),{recursive:true});
    await symlink(other,command);
    await assert.rejects(enableCli({home,platform:'darwin',pathEnv:`${join(home,'.local','bin')}:/usr/bin`,bundleDir:bundle,configDir:config,runtime}),/CLI_COMMAND_EXISTS/);
    assert.equal(await readFile(other,'utf8'),'#!/bin/sh\necho other\n');
    assert.equal(await readlink(command),other);
    assert.equal(existsSync(join(home,'.agents','skills','grok-bot')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('a foreign Claude skill directory is not deleted',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const claude=join(home,'.claude','skills','grok-bot');
  try{
    await mkdir(claude,{recursive:true});
    await writeFile(join(claude,'old.txt'),'old');
    await assert.rejects(enableCli({home,platform:'darwin',pathEnv:'/usr/bin',bundleDir:bundle,configDir:config,runtime}),/CLI_COMMAND_EXISTS/);
    assert.equal(await readFile(join(claude,'old.txt'),'utf8'),'old');
    assert.equal(existsSync(join(home,'.agents','skills','grok-bot')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

// POSIX-only by construction: the PATH list separates with ':' (a Windows home
// path contains a drive colon, which makes the entry unambiguous nowhere) and
// the failure path asserts ENOTDIR, which Windows reports as ENOENT.
test('a managed skill directory can be replaced and credentials are cleared before a later failure',{skip:process.platform==='win32'?'POSIX PATH list and ENOTDIR':false},async()=>{
  const {home,bundle,runtime,config}=await fixture();
  const dest=join(home,'.agents','skills','grok-bot');
  try{
    await mkdir(dest,{recursive:true});
    await writeFile(join(dest,'.anywhere-managed.json'),'{"app":"grok-bot-anywhere"}\n');
    await writeFile(join(dest,'old.txt'),'gone');
    const enabled=await enableCli({home,platform:'darwin',pathEnv:`${join(home,'.local','bin')}:/usr/bin`,bundleDir:bundle,configDir:config,runtime,credentials:{accessToken:'app-token'}});
    assert.equal(existsSync(join(dest,'old.txt')),false);
    assert.match(await readFile(join(dest,'SKILL.md'),'utf8'),/grok-bot/);
    assert.equal(enabled.pathSnippet,false);
    await rm(join(home,'.local'),{recursive:true,force:true});
    await writeFile(join(home,'.local'),'not-a-directory');
    await assert.rejects(disableCli({home,platform:'darwin',configDir:config,removePath:false}),error=>error?.code==='ENOTDIR');
    assert.equal(existsSync(join(config,'profiles','default.json')),false);
    assert.equal((await readdir(join(config,'profiles'))).some(name=>name.endsWith('.tmp')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('windows command keeps quotes out of the value for spaces, Chinese, and percent',()=>{
  const cases=[
    {configDir:'C:\\Users\\Ada Lovelace\\cli',runtime:'C:\\Program Files\\Grok Bot Anywhere\\Grok Bot Anywhere.exe',script:'C:\\skill\\bin\\grok-bot.mjs',value:'C:\\Users\\Ada Lovelace\\cli'},
    {configDir:'C:\\用户\\命令\\cli',runtime:'D:\\应用\\Grok.exe',script:'D:\\技能\\grok-bot.mjs',value:'C:\\用户\\命令\\cli'},
    {configDir:'C:\\Users\\a%b\\cli',runtime:'C:\\r%untime\\app.exe',script:'C:\\s%cript\\grok-bot.mjs',value:'C:\\Users\\a%%b\\cli'}
  ];
  for(const item of cases){
    const body=windowsCommand(item);
    assert.match(body,/set "GROK_BOT_CONFIG_DIR=/);
    assert.equal(body.includes('="'),false);
    assert.match(body,new RegExp(`set "GROK_BOT_CONFIG_DIR=${item.value.replace(/[\\]/g,'\\\\')}"`));
    assert.match(body,/setlocal DisableDelayedExpansion\r\n/);
    assert.match(body,/for \/f "tokens=2 delims=:\." %%a in \('chcp'\) do set "_cp=%%a"/);
    assert.match(body,/echo CLI_RUNTIME_MISSING: Grok Bot Anywhere is not available\. 1>&2/);
    assert.match(body,/echo \{"ok":false,"error":\{"code":"CLI_RUNTIME_MISSING","message":"Grok Bot Anywhere is not available\."\}\}/);
    assert.match(body,/if not exist ".*?" \( echo CLI_RUNTIME_MISSING: Grok Bot Anywhere is not available\. 1>&2 & echo \{"ok":false,"error":\{"code":"CLI_RUNTIME_MISSING","message":"Grok Bot Anywhere is not available\."\}\} & chcp %_cp% >nul & exit \/b 127 \)/);
    assert.match(body,/set "GROK_BOT_EXIT=%ERRORLEVEL%"/);
    assert.match(body,/chcp %_cp% >nul\r\nexit \/b %GROK_BOT_EXIT%/);
    assert.match(body,new RegExp(item.runtime.includes('%')?item.runtime.replaceAll('%','%%').replace(/[\\]/g,'\\\\'):item.runtime.replace(/[\\]/g,'\\\\')));
  }
});

// The shell rc file this covers only exists on POSIX: rcFile() returns '' for
// win32, and a darwin install assembled on a Windows host cannot resolve
// "C:\..." as an absolute symlink target under POSIX path rules.
test('enabling twice keeps the path marker and turning it off removes the snippet',{skip:process.platform==='win32'?'POSIX rc-file path only':false},async()=>{
  const {home,bundle,runtime,config}=await fixture();
  try{
    const first=await enableCli({home,platform:'darwin',pathEnv:'/usr/bin',bundleDir:bundle,configDir:config,runtime,savedPathSnippet:false});
    assert.equal(first.pathSnippet,true);
    assert.match(await readFile(join(home,'.zprofile'),'utf8'),/# grok-bot-anywhere/);
    const second=await enableCli({home,platform:'darwin',pathEnv:'/usr/bin',bundleDir:bundle,configDir:config,runtime,savedPathSnippet:first.pathSnippet});
    assert.equal(second.pathSnippet,true);
    assert.match(await readFile(join(home,'.zprofile'),'utf8'),/# grok-bot-anywhere/);
    await disableCli({home,platform:'darwin',configDir:config,removePath:second.pathSnippet});
    assert.equal((await readFile(join(home,'.zprofile'),'utf8')).includes('# grok-bot-anywhere'),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('windows path errors do not replace Path, and a missing value still appends',async()=>{
  const {home,bundle,runtime,config}=await fixture();
  let writes=0;
  const rejectWrite=async(file,args)=>{
    const script=args.at(-1);
    if(script===WINDOWS_PATH_READ)throw Object.assign(new Error('powershell failed'),{code:1,stdout:''});
    writes+=1;
    throw new Error(`wrote ${file}`);
  };
  try{
    await assert.rejects(enableCli({home,platform:'win32',pathEnv:'',bundleDir:bundle,configDir:config,runtime,execFileImpl:rejectWrite,symlinkImpl:async()=>{}}),/CLI_INSTALL_FAILED/);
    assert.equal(writes,0);
  }finally{await rm(home,{recursive:true,force:true});}
  const home2=await mkdtemp(join(tmpdir(),'gba-cli-'));
  const bundle2=join(home2,'bundle'),runtime2=join(home2,'runtime'),config2=join(home2,'cli-config');
  await mkdir(join(bundle2,'bin'),{recursive:true});
  await writeFile(join(bundle2,'SKILL.md'),'# grok-bot\n');
  await writeFile(join(bundle2,'bin','grok-bot.mjs'),'console.log("bundled")\n');
  await writeFile(runtime2,'#!/bin/sh\n');
  let wrote='',broadcasts=0;
  const acceptMissing=async(file,args,options)=>{
    const script=args.at(-1);
    if(script===WINDOWS_PATH_READ)return {stdout:`${WINDOWS_PATH_MISSING}\n`};
    if(script===WINDOWS_PATH_WRITE){
      wrote=options?.env?.[WINDOWS_PATH_ENV];
      assert.equal(args.some(part=>String(part).includes(wrote)),false);
      return {stdout:''};
    }
    if(script===WINDOWS_ENV_BROADCAST){assert.equal(options?.timeout,8000);broadcasts+=1;throw new Error('broadcast down');}
    throw new Error(`unexpected ${file}`);
  };
  try{
    const enabled=await enableCli({home:home2,platform:'win32',pathEnv:'',bundleDir:bundle2,configDir:config2,runtime:runtime2,execFileImpl:acceptMissing,symlinkImpl:async()=>{}});
    assert.equal(enabled.pathSnippet,true);
    assert.equal(enabled.warning,'ENV_BROADCAST_FAILED');
    assert.equal(wrote,join(home2,'.local','bin'));
    assert.equal(broadcasts,1);
    assert.equal(enabled.enabled,true);
  }finally{await rm(home2,{recursive:true,force:true});}
});

test('windows path keeps a chinese entry, skips an existing directory, and passes the write through the environment',async()=>{
  const chinese='C:\\Users\\张三\\bin;C:\\Windows';
  assert.deepEqual(parseWindowsPathOutput(`ExpandString\n${chinese}\n`),{type:'ExpandString',value:chinese});
  assert.deepEqual(parseWindowsPathOutput(`${WINDOWS_PATH_MISSING}\n`),{type:'ExpandString',value:''});
  assert.throws(()=>parseWindowsPathOutput(''),/CLI_INSTALL_FAILED/);
  assert.throws(()=>parseWindowsPathOutput('DWord\n1\n'),/CLI_INSTALL_FAILED/);
  assert.match(WINDOWS_PATH_READ,/\[Console\]::OutputEncoding=\[Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(WINDOWS_PATH_READ,/GetValue\('Path',\$null,'DoNotExpandEnvironmentNames'\)/);
  assert.match(WINDOWS_PATH_READ,/GetValueKind\('Path'\)/);
  assert.match(WINDOWS_PATH_READ,/__MISSING__/);
  assert.match(WINDOWS_PATH_WRITE,/SetValue\('Path',\[string\]\$env:GROK_BOT_WINDOWS_PATH,'ExpandString'\)/);
  assert.equal(WINDOWS_PATH_WRITE.includes('张三'),false);
  const {home,bundle,runtime,config}=await fixture();
  let wrote=null,writes=0;
  const execFileImpl=async(file,args,options)=>{
    assert.equal(options?.encoding,'utf8');
    const script=args.at(-1);
    if(script===WINDOWS_PATH_READ)return {stdout:`ExpandString\n${chinese}\n`};
    if(script===WINDOWS_PATH_WRITE){
      writes+=1;
      wrote=options?.env?.[WINDOWS_PATH_ENV];
      assert.equal(args.some(part=>String(part).includes('张三')),false);
      assert.equal(script.includes('张三'),false);
      assert.equal(script.includes(join(home,'.local','bin')),false);
      return {stdout:''};
    }
    if(script===WINDOWS_ENV_BROADCAST){assert.equal(options?.timeout,8000);return {stdout:''};}
    throw new Error(`unexpected ${file}`);
  };
  try{
    const enabled=await enableCli({home,platform:'win32',pathEnv:'',bundleDir:bundle,configDir:config,runtime,execFileImpl,symlinkImpl:async()=>{}});
    assert.equal(enabled.pathSnippet,true);
    assert.equal(writes,1);
    assert.equal(wrote,`${chinese};${join(home,'.local','bin')}`);
    writes=0;
    const again=await enableCli({home,platform:'win32',pathEnv:'',bundleDir:bundle,configDir:config,runtime,execFileImpl:async(file,args)=>{
      if(args.at(-1)===WINDOWS_PATH_READ)return {stdout:`ExpandString\n${wrote}\n`};
      writes+=1;
      throw new Error('PATH_WRITTEN');
    },symlinkImpl:async()=>{},savedPathSnippet:true});
    assert.equal(again.pathSnippet,true);
    assert.equal(writes,0);
  }finally{await rm(home,{recursive:true,force:true});}
  const home3=await mkdtemp(join(tmpdir(),'gba-cli-'));
  const bundle3=join(home3,'bundle'),runtime3=join(home3,'runtime'),config3=join(home3,'cli-config');
  await mkdir(join(bundle3,'bin'),{recursive:true});
  await writeFile(join(bundle3,'SKILL.md'),'# grok-bot\n');
  await writeFile(join(bundle3,'bin','grok-bot.mjs'),'console.log("bundled")\n');
  await writeFile(runtime3,'#!/bin/sh\n');
  let badWrites=0;
  try{
    await assert.rejects(enableCli({home:home3,platform:'win32',pathEnv:'',bundleDir:bundle3,configDir:config3,runtime:runtime3,symlinkImpl:async()=>{},execFileImpl:async(file,args)=>{
      if(args.at(-1)===WINDOWS_PATH_READ)return {stdout:'not a path\n'};
      badWrites+=1;
      throw new Error(`wrote ${file}`);
    }}),/CLI_INSTALL_FAILED/);
    assert.equal(badWrites,0);
  }finally{await rm(home3,{recursive:true,force:true});}
});

test('clearing a missing credential directory does not throw',async()=>{
  const home=await mkdtemp(join(tmpdir(),'gba-cli-'));
  try{
    const missing=join(home,'no-such','cli');
    assert.equal(await writeCliCredential(missing,null),false);
    assert.equal(existsSync(missing),false);
    assert.equal(existsSync(join(missing,'profiles','default.json')),false);
  }finally{await rm(home,{recursive:true,force:true});}
});

test('the shipped skill bundle is the grok-bot CLI',()=>{
  const root=new URL('../resources/grok-bot-skill/grok-bot/',import.meta.url);
  assert.equal(existsSync(new URL('SKILL.md',root)),true);
  assert.equal(existsSync(new URL('bin/grok-bot.mjs',root)),true);
  assert.match(posixLauncher({runtime:'/App/Electron',script:'/skill/bin/grok-bot.mjs',configDir:'/cfg'}),/GROK_BOT_CONFIG_DIR/);
});

test('Electron and the packaged app name can run grok-bot status',async()=>{
  const root=new URL('../resources/grok-bot-skill/grok-bot/',import.meta.url);
  const script=fileURLToPath(new URL('bin/grok-bot.mjs',root));
  const bytes=await readFile(script);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const sums=await readFile(new URL('bin/SHA256SUMS',root),'utf8');
  assert.match(sums,new RegExp(`^${hash}  grok-bot\\.mjs\\n?$`));
  const home=await mkdtemp(join(tmpdir(),'gba-cli-argv-'));
  const env={...process.env,GROK_BOT_CONFIG_DIR:join(home,'cfg'),GROK_BOT_NO_AUTO_INSTALL:'1'};
  try{
    for(const argv0 of ['Electron','Grok Bot Anywhere',undefined]){
      await assert.rejects(run(process.execPath,[script,'status','--json'],{argv0,env}),error=>{
        assert.equal(error.code,2);
        assert.match(error.stdout,/NOT_LOGGED_IN/);
        assert.equal(String(error.stdout).includes('Unexpected argument'),false);
        return true;
      });
    }
    const version=await run(process.execPath,[script,'--version'],{argv0:'Electron',env});
    assert.match(version.stdout,/grok-bot 0\.3\.0/);
  }finally{await rm(home,{recursive:true,force:true});}
});
