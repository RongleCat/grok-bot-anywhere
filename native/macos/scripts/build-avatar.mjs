import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {build} from '../../../desktop/node_modules/esbuild/lib/main.js';

const macos = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const out = join(macos, 'Sources/TouchBarBotApp/Resources/Avatar');

await mkdir(out, {recursive: true});
await build({
  entryPoints: [join(macos, 'avatar/runtime.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'safari17',
  outfile: join(out, 'avatar.js'),
  legalComments: 'inline',
});
await writeFile(join(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><style>html,body{margin:0;background:transparent;width:100%;height:100%;overflow:hidden}#avatar,svg{width:100%;height:100%}</style></head><body><div id="avatar"></div><script src="avatar.js"></script></body></html>');
await copyFile(join(repo, 'assets/bloub/LICENSE'), join(out, 'LICENSE'));
await copyFile(join(repo, 'assets/bloub/PROVENANCE.md'), join(out, 'PROVENANCE.md'));
console.log('Built offline Bloub avatar resources');
