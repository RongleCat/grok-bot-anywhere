import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {EventEmitter} from 'node:events';
import {captureFrontmostSelection, createSelectionClient, listedPaths, prepareExplorerSelection, regularFiles, selectionScripts} from '../src/main/selection.mjs';

const execFileAsync = promisify(execFile);

test('selection text keeps every non-empty path', () => {
  assert.deepEqual(listedPaths('/tmp/a.txt\r\n\r\n/tmp/b.txt\n'), ['/tmp/a.txt', '/tmp/b.txt']);
});

test('regular files drop folders, empty files, and duplicates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gba-selection-'));
  const file = join(root, 'note.txt');
  const empty = join(root, 'empty.txt');
  const folder = join(root, 'folder');
  await writeFile(file, 'hello');
  await writeFile(empty, '');
  await mkdir(folder);
  const picked = await regularFiles([file, file, empty, folder, join(root, 'missing.txt'), '  ']);
  assert.deepEqual(picked, [file]);
  await rm(root, {recursive: true, force: true});
});

test('regular files drop folders, missing paths, and shell virtual items', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gba-selection-'));
  const file = join(root, 'note.txt');
  const folder = join(root, 'folder');
  await writeFile(file, 'kept');
  await mkdir(folder);
  const picked = await regularFiles([
    folder,
    join(root, 'missing.txt'),
    '::{20D04FE0-3AEA-1069-A2D8-08002B30309D}',
    '::{645FF040-5081-101B-9F08-00AA002F954E}\\folder',
    file
  ], {platform: 'win32'});
  assert.deepEqual(picked, [file]);
  await rm(root, {recursive: true, force: true});
});

test('frontmost capture returns script paths and treats a failed script as no selection', async () => {
  const calls = [];
  const ok = (file, args, options, callback) => {
    calls.push([file, args[0]]);
    if (file === '/usr/bin/lsappinfo') {
      if (args[0] === 'front') return callback(null, 'ASN:0x0-0x1:\n');
      return callback(null, '"CFBundleIdentifier"="com.apple.finder"\n');
    }
    callback(null, '/tmp/a.txt\n/tmp/b.txt\n');
  };
  assert.deepEqual(await captureFrontmostSelection({platform: 'darwin', run: ok}), ['/tmp/a.txt', '/tmp/b.txt']);
  assert.ok(calls.some(([file, arg]) => file === '/usr/bin/lsappinfo' && arg === 'front'));
  const failed = (file, args, options, callback) => callback(Object.assign(new Error('denied'), {code: 'ERR'}));
  assert.deepEqual(await captureFrontmostSelection({platform: 'darwin', run: failed}), []);
  assert.deepEqual(await captureFrontmostSelection({platform: 'linux', run: ok}), []);
});

test('frontmost capture skips Finder AppleScript when another app is frontmost', async () => {
  const calls = [];
  const run = (file, args, options, callback) => {
    calls.push(file);
    if (file === '/usr/bin/lsappinfo') return callback(null, args[0] === 'front' ? 'ASN:0x0-0x2:\n' : '"CFBundleIdentifier"="com.apple.Safari"\n');
    callback(null, '/tmp/from-finder.txt\n');
  };
  assert.deepEqual(await captureFrontmostSelection({platform: 'darwin', run}), []);
  assert.equal(calls.includes('osascript'), false);
});

test('finder and explorer scripts stay limited to the foreground file window', () => {
  assert.match(selectionScripts.finderScript, /com\.apple\.finder/);
  assert.match(selectionScripts.finderScript, /selection as alias list/);
  assert.match(selectionScripts.explorerScript, /GetForegroundWindow/);
  assert.match(selectionScripts.explorerScript, /explorer/);
  assert.match(selectionScripts.explorerScript, /SelectedItems/);
  const script = selectionScripts.selectionHostScript;
  const ready = script.indexOf("WriteLine('READY')");
  const snap = script.indexOf("if ($line -eq 'SNAP')");
  const files = script.indexOf("if ($line.StartsWith('FILES '))");
  const foreground = script.indexOf('::GetForegroundWindow()');
  assert.ok(script.indexOf('Add-Type') >= 0 && script.indexOf('Add-Type') < ready);
  assert.ok(ready < snap && snap < foreground && foreground < files);
  assert.equal(script.slice(files).includes('GetForegroundWindow'), false);
  assert.match(script.slice(snap, files), /ProcessName/);
  assert.match(script.slice(snap, files), /0xFFFFFFFFL/);
  assert.match(script.slice(snap, files), /try \{/);
  assert.match(script.slice(snap, files), /HWND 0 none/);
  assert.equal(script.slice(snap, files).includes('0xFFFFFFFF)'), false);
  assert.match(script.slice(files), /SelectedItems/);
  assert.match(script.slice(files), /0xFFFFFFFFL/);
  assert.match(createSelectionClient.toString(), /if \(child !== current\) return/);
  assert.match(createSelectionClient.toString(), /StringDecoder/);
  assert.match(createSelectionClient.toString(), /takeLine\(20000\)/);
});

function fakePowerShell(writes) {
  const stdout = new EventEmitter();
  const stdin = {write(text) {
    const line = String(text).trim();
    writes.push(line);
    if (line === 'SNAP') stdout.emit('data', Buffer.from('HWND 42 explorer\n'));
    if (line.startsWith('FILES ')) stdout.emit('data', Buffer.from('C:\\Temp\\笔记.txt\nEND\n'));
  }, on() {}};
  const child = new EventEmitter();
  child.stdout = stdout;
  child.stdin = stdin;
  child.kill = () => {};
  queueMicrotask(() => stdout.emit('data', Buffer.from('READY\n')));
  return child;
}

test('windows selection reads the hwnd before it reads files', async () => {
  const writes = [];
  const client = createSelectionClient({spawnImpl: () => fakePowerShell(writes)});
  const prepared = prepareExplorerSelection({client, platform: 'win32'});
  const info = await prepared.hwndReady;
  assert.deepEqual(info, {hwnd: '42', name: 'explorer'});
  assert.deepEqual(writes, ['SNAP']);
  assert.deepEqual(await prepared.files(), ['C:\\Temp\\笔记.txt']);
  assert.deepEqual(writes, ['SNAP', 'FILES 42']);
  client.stop();
  const idle = prepareExplorerSelection({client: {snap: async () => ({hwnd: '7', name: 'notepad'}), files() { throw new Error('FILES'); }}, platform: 'win32'});
  await idle.hwndReady;
  assert.deepEqual(await idle.files(), []);
});

test('selection host reassembles split utf-8 and ignores a stopped child', async () => {
  const children = [];
  const client = createSelectionClient({spawnImpl: () => {
    const stdout = new EventEmitter();
    const child = new EventEmitter();
    child.stdout = stdout;
    child.stdin = {write() {}, on() {}};
    child.kill = () => {};
    children.push(child);
    return child;
  }});
  const starting = client.start();
  const ready = Buffer.from('READY\n', 'utf8');
  children[0].stdout.emit('data', ready.subarray(0, 3));
  children[0].stdout.emit('data', ready.subarray(3));
  await starting;
  client.stop();
  children[0].stdout.emit('data', Buffer.from('HWND 99 explorer\n'));
  const again = client.start();
  children[1].stdout.emit('data', Buffer.from('READY\n'));
  await again;
  const snap = client.snap();
  children[1].stdout.emit('data', Buffer.from('HWND 42 explorer\n'));
  assert.deepEqual(await snap, {hwnd: '42', name: 'explorer'});
  const path = 'C:\\Temp\\笔记.txt';
  const payload = Buffer.from(`${path}\nEND\n`, 'utf8');
  const mark = payload.indexOf(Buffer.from('笔', 'utf8'));
  const reading = client.files('42');
  children[1].stdout.emit('data', payload.subarray(0, mark + 1));
  children[1].stdout.emit('data', payload.subarray(mark + 1));
  assert.deepEqual(await reading, [path]);
  client.stop();
});

test('finder selection script compiles', async () => {
  if (process.platform !== 'darwin') return;
  const root = await mkdtemp(join(tmpdir(), 'gba-finder-script-'));
  try {
    await execFileAsync('osacompile', ['-o', join(root, 'finder.scpt'), '-e', selectionScripts.finderScript], {timeout: 2500});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
