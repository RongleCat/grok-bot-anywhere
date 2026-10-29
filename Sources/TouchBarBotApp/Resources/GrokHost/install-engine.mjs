import {open, mkdir, writeFile, copyFile, stat} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const outDir = process.argv[2];
const asarPath = process.argv[3] ?? '/Applications/Grok Bot.app/Contents/Resources/app.asar';
if (!outDir) {
  console.error('usage: install-engine.mjs <out-dir> [asar]');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const file = await open(asarPath, 'r');
const prefix = Buffer.alloc(8);
await file.read(prefix, 0, 8, 0);
const headerLen = prefix.readUInt32LE(4);
const blob = Buffer.alloc(headerLen);
await file.read(blob, 0, headerLen, 8);
const strlen = blob.readUInt32LE(4);
const header = JSON.parse(blob.subarray(8, 8 + strlen).toString('utf8'));
const dataStart = 8 + headerLen;
const entries = [];

function walk(node, pathPrefix = '') {
  if (node?.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, `${pathPrefix}${name}/`);
  } else if (node && node.offset != null) {
    entries.push({path: pathPrefix.slice(0, -1), offset: Number(node.offset), size: Number(node.size)});
  }
}
walk(header);

function find(prefixName) {
  const hit = entries.find(entry => entry.path.split('/').pop().startsWith(prefixName));
  if (!hit) throw new Error(`MISSING_${prefixName}`);
  return hit;
}

async function extract(entry) {
  const bytes = Buffer.alloc(entry.size);
  await file.read(bytes, 0, entry.size, dataStart + entry.offset);
  return bytes.toString('utf8');
}

function retarget(source) {
  return source
    .replaceAll(/\.\/index\.eager-common-[^"]+\.js/g, './common.js')
    .replaceAll(/\.\/index\.eager-vendor-[^"]+\.js/g, './vendor.js')
    .replaceAll(/\.\/index\.eager-platform-[^"]+\.js/g, './platform.js');
}

const common = retarget(await extract(find('index.eager-common-')));
let vendor = retarget(await extract(find('index.eager-vendor-')));
const platform = retarget(await extract(find('index.eager-platform-')));
await file.close();

const exportAt = vendor.lastIndexOf('export{');
if (exportAt < 0 || !vendor.includes('createRoot')) throw new Error('VENDOR_EXPORT_MISSING');
vendor = `${vendor.slice(0, exportAt)}export{$t as __ReactDOM,${vendor.slice(exportAt + 'export{'.length)}`;

await mkdir(outDir, {recursive: true});
await writeFile(join(outDir, 'common.js'), common);
await writeFile(join(outDir, 'vendor.js'), vendor);
await writeFile(join(outDir, 'platform.js'), platform);
await copyFile(join(here, 'index.html'), join(outDir, 'index.html'));
await copyFile(join(here, 'bridge.js'), join(outDir, 'bridge.js'));
const info = await stat(asarPath);
await writeFile(join(outDir, 'engine.json'), JSON.stringify({
  asarSize: info.size,
  asarMtimeMs: info.mtimeMs
}));
console.log('ok');
