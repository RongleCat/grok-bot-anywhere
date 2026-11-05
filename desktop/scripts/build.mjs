import {build} from 'esbuild';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(root+'out',{recursive:true});
await build({entryPoints:[root+'src/renderer/app.mjs',root+'src/renderer/composer.mjs',root+'src/renderer/share-picker.mjs'],outdir:root+'out',bundle:true,format:'esm',platform:'browser',target:'chrome140',minify:false,logOverride:{'impossible-typeof':'silent'}});
await Promise.all(['index.html','styles.css','composer.html','composer.css','share-picker.html','share-picker.css'].map(file=>copyFile(root+'src/renderer/'+file,root+'out/'+file)));
// Native WKWebView consumes exactly the same bundled avatar engine, offline.
await build({entryPoints:[root+'src/renderer/native-avatar.mjs'],outfile:root+'out/native-avatar/bridge.js',bundle:true,format:'esm',platform:'browser',target:'safari17',logOverride:{'impossible-typeof':'silent'}});
await writeFile(root+'out/native-avatar/index.html',`<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data: blob:;"><style>html,body{margin:0;background:transparent;overflow:hidden}#avatar,#live{position:absolute;inset:0}#live{width:128px;height:128px;display:none}body.strip #avatar,body.strip #live{display:none}#stage{display:none}body.strip #stage{display:block}</style></head><body><div id="avatar"></div><div id="live"></div><div id="stage"></div><script type="module" src="bridge.js"></script></body></html>`);
console.log('Built shared UI and offline native avatar resources.');
