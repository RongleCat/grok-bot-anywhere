import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {build} from '../bridge/node_modules/esbuild/lib/main.js';
const out='Sources/TouchBarBotApp/Resources/Avatar';
await mkdir(out,{recursive:true});
await build({entryPoints:['avatar/runtime.ts'],bundle:true,minify:true,format:'iife',target:'safari17',outfile:out+'/avatar.js',legalComments:'inline'});
await writeFile(out+'/index.html','<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><style>html,body{margin:0;background:transparent;width:100%;height:100%;overflow:hidden}#avatar,svg{width:100%;height:100%}</style></head><body><div id="avatar"></div><script src="avatar.js"></script></body></html>');
await copyFile('assets/bloub/LICENSE',out+'/LICENSE');
await copyFile('assets/bloub/PROVENANCE.md',out+'/PROVENANCE.md');
console.log('Built offline Bloub avatar resources');
