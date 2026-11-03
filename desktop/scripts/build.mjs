import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {eyeInk} from '../src/renderer/avatar-ink.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const engine=root+'node_modules/grok-bot-avatar-engine/dist/index.js';
let engineSource=await readFile(engine,'utf8');
// The upstream engine paints the eyes with a fixed #fff after our earlier
// patch. Dark-mode black Bots have a white body, so that made the eyes vanish.
// Use a contrast ink variable instead: white eyes on dark bodies, dark eyes on
// light bodies. The same bundled engine feeds Electron, the share picker and
// the native WKWebView.
const eyeHelper=`const gbaEyeInk=${eyeInk.toString()};`;
if(!engineSource.includes('function gbaEyeInk('))engineSource=eyeHelper+engineSource;
engineSource=engineSource.replaceAll('gl("var(--grok-bot-ink)","#fff")','gl("var(--grok-bot-ink)","var(--grok-bot-eye)")');
engineSource=engineSource.replaceAll('gl("var(--grok-bot-ink)")','gl("var(--grok-bot-ink)","var(--grok-bot-eye)")');
engineSource=engineSource.replaceAll('gl(typeof n=="string"?n:oH)','gl(typeof n=="string"?n:oH,"#fff")');
engineSource=engineSource.replace('function h(){e.style.setProperty("--grok-bot-ink",Lh(o.color,o.theme))}','function h(){const c=Lh(o.color,o.theme);e.style.setProperty("--grok-bot-ink",c);e.style.setProperty("--grok-bot-eye",gbaEyeInk(c))}');
engineSource=engineSource.replace('"--grok-bot-ink":Lh(e.color,o)','"--grok-bot-ink":Lh(e.color,o),"--grok-bot-eye":gbaEyeInk(Lh(e.color,o))');
await writeFile(engine,engineSource);
await mkdir(root+'out',{recursive:true});
await build({entryPoints:[root+'src/renderer/app.mjs',root+'src/renderer/composer.mjs',root+'src/renderer/share-picker.mjs'],outdir:root+'out',bundle:true,format:'esm',platform:'browser',target:'chrome140',minify:false,logOverride:{'impossible-typeof':'silent'}});
await Promise.all(['index.html','styles.css','composer.html','composer.css','share-picker.html','share-picker.css'].map(file=>copyFile(root+'src/renderer/'+file,root+'out/'+file)));
// Native WKWebView consumes exactly the same bundled avatar engine, offline.
await build({entryPoints:[root+'src/renderer/native-avatar.mjs'],outfile:root+'out/native-avatar/bridge.js',bundle:true,format:'esm',platform:'browser',target:'safari17',logOverride:{'impossible-typeof':'silent'}});
await writeFile(root+'out/native-avatar/index.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: blob:;"><style>html,body{margin:0;background:transparent;overflow:hidden}#avatar,#live{position:absolute;inset:0}#live{width:128px;height:128px;display:none}body.strip #avatar,body.strip #live{display:none}#stage{display:none}body.strip #stage{display:block}</style></head><body><div id="avatar"></div><div id="live"></div><div id="stage"></div><script type="module" src="bridge.js"></script></body></html>`);
console.log('Built shared UI and offline native avatar resources.');
