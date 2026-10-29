import {execFileSync} from 'node:child_process';
import {mkdir,cp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {plist,extensionInfo,shareEntitlements} from '../src/share/plist.mjs';
if(process.platform!=='darwin')throw new Error('Mac share extensions must be built on macOS.');
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const product of ['GrokBotShare','GrokBotMenuHost'])execFileSync('swift',['build','--product',product],{cwd:root,stdio:'inherit'});
const binaryRoot=execFileSync('swift',['build','--show-bin-path'],{cwd:root,encoding:'utf8'}).trim();
const host=join(root,'desktop/native/GrokBotMenuHost.app'),contents=join(host,'Contents');
await mkdir(join(contents,'MacOS'),{recursive:true});await mkdir(join(contents,'Resources'),{recursive:true});
await cp(join(binaryRoot,'GrokBotMenuHost'),join(contents,'MacOS/GrokBotMenuHost'));
await writeFile(join(contents,'Info.plist'),plist({CFBundleName:'Grok Bot Anywhere Menu',CFBundleIdentifier:'dev.ronglecat.grokbotanywhere.menu',CFBundleExecutable:'GrokBotMenuHost',CFBundlePackageType:'APPL',CFBundleShortVersionString:'0.2.0',CFBundleVersion:'2',LSUIElement:true,LSMinimumSystemVersion:'14.0',GBAApplicationPath:''}));
const entitlements=join(contents,'Resources/share.entitlements');await writeFile(entitlements,plist(shareEntitlements));
for(let slot=1;slot<=12;slot++){
 const extension=join(contents,`PlugIns/GrokBotShare${slot}.appex`),inside=join(extension,'Contents');
 await mkdir(join(inside,'MacOS'),{recursive:true});await mkdir(join(inside,'Resources'),{recursive:true});
 await cp(join(binaryRoot,'GrokBotShare'),join(inside,'MacOS/GrokBotShare'));
 await writeFile(join(inside,'Info.plist'),plist(extensionInfo(slot)));
 await writeFile(join(inside,'Resources/binding.json'),JSON.stringify({version:1,slot}));
 execFileSync('codesign',['--force','--sign','-','--entitlements',entitlements,extension],{stdio:'inherit'});
}
execFileSync('codesign',['--force','--sign','-',host],{stdio:'inherit'});
execFileSync('codesign',['--verify','--deep','--strict',host],{stdio:'inherit'});
console.log('Built 12 offline share extension slots. No registration performed.');
