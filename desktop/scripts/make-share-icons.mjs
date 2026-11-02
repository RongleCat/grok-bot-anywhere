import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';

// Package assets come from the app's own coal ball so the share entry and the
// tray icon never drift apart.
const {coalBallPng} = await import(new URL('../src/shell/coal-ball.mjs', import.meta.url).href);

const target = process.argv[2];
if (!target) {
  console.error('usage: node make-share-icons.mjs <assets-dir>');
  process.exit(2);
}
mkdirSync(target, {recursive: true});

const files = [
  ['Square44x44Logo.png', 44],
  ['Square44x44Logo.scale-100.png', 44],
  ['Square44x44Logo.scale-125.png', 55],
  ['Square44x44Logo.scale-150.png', 66],
  ['Square44x44Logo.scale-200.png', 88],
  ['Square44x44Logo.scale-400.png', 176],
  ['Square44x44Logo.targetsize-16.png', 16],
  ['Square44x44Logo.targetsize-24.png', 24],
  ['Square44x44Logo.targetsize-32.png', 32],
  ['Square44x44Logo.targetsize-48.png', 48],
  ['Square44x44Logo.targetsize-256.png', 256],
  ['Square150x150Logo.png', 150],
  ['Square150x150Logo.scale-100.png', 150],
  ['Square150x150Logo.scale-125.png', 188],
  ['Square150x150Logo.scale-150.png', 225],
  ['Square150x150Logo.scale-200.png', 300],
  ['Square150x150Logo.scale-400.png', 600],
  ['StoreLogo.png', 50],
];

for (const [name, size] of files) writeFileSync(join(target, name), coalBallPng(size));
console.log(`wrote ${files.length} share icons -> ${target}`);
