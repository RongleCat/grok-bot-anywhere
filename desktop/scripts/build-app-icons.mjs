#!/usr/bin/env node
// Generate the application icon only. Tray/menu-bar and share-menu icons are
// separate assets and intentionally not touched here.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {coalBallAppPng} from '../src/shell/coal-ball.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const root=join(here,'..');
const build=join(root,'build');
mkdirSync(build,{recursive:true});

// macOS: 1024px canvas with the ball inside Apple's 824px safe area.
const master=coalBallAppPng(1024,{platform:'darwin'});
writeFileSync(join(build,'icon.png'),master);

const macVariants=[
 ['icon_16x16.png',16],['icon_16x16@2x.png',32],
 ['icon_32x32.png',32],['icon_32x32@2x.png',64],
 ['icon_128x128.png',128],['icon_128x128@2x.png',256],
 ['icon_256x256.png',256],['icon_256x256@2x.png',512],
 ['icon_512x512.png',512],['icon_512x512@2x.png',1024]
];
const iconset=join(build,'icon.iconset');
rmSync(iconset,{recursive:true,force:true});mkdirSync(iconset,{recursive:true});
for(const [name,size] of macVariants)writeFileSync(join(iconset,name),coalBallAppPng(size,{platform:'darwin'}));
if(process.platform==='darwin')execFileSync('iconutil',['-c','icns',iconset,'-o',join(build,'icon.icns')]);
else console.warn('build:icons: iconutil is macOS-only; icon.icns was not regenerated');
rmSync(iconset,{recursive:true,force:true});

// Windows: multi-resolution PNG-compressed ICO. A small transparent edge keeps
// the coal ball from looking cramped at 16/24px.
const icoSizes=[16,24,32,48,64,128,256];
const images=icoSizes.map(size=>coalBallAppPng(size,{platform:'win32'}));
const header=Buffer.alloc(6);
header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
const entries=[];
let offset=6+images.length*16;
for(let i=0;i<images.length;i++){
  const size=icoSizes[i],png=images[i],entry=Buffer.alloc(16);
  entry[0]=size>=256?0:size;entry[1]=size>=256?0:size;entry[2]=0;entry[3]=0;
  entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);
  entry.writeUInt32LE(png.length,8);entry.writeUInt32LE(offset,12);
  entries.push(entry);offset+=png.length;
}
writeFileSync(join(build,'icon.ico'),Buffer.concat([header,...entries,...images]));

const read=readFileSync(join(build,'icon.icns'),{throws:false});
console.log(JSON.stringify({
  mac:process.platform==='darwin'?'build/icon.icns':'unchanged',
  windows:'build/icon.ico',
  master:'build/icon.png',
  macBytes:read?read.length:null,
  windowsSizes:icoSizes
}));
