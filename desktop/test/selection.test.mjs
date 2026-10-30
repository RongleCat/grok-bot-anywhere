import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {captureFrontmostSelection, listedPaths, regularFiles, selectionScripts} from '../src/main/selection.mjs';

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
});

test('frontmost capture returns script paths and treats a failed script as no selection', async () => {
  const ok = (file, args, options, callback) => callback(null, '/tmp/a.txt\n/tmp/b.txt\n');
  assert.deepEqual(await captureFrontmostSelection({platform: 'darwin', run: ok}), ['/tmp/a.txt', '/tmp/b.txt']);
  const failed = (file, args, options, callback) => callback(Object.assign(new Error('denied'), {code: 'ERR'}));
  assert.deepEqual(await captureFrontmostSelection({platform: 'darwin', run: failed}), []);
  assert.deepEqual(await captureFrontmostSelection({platform: 'linux', run: ok}), []);
});

test('finder and explorer scripts stay limited to the foreground file window', () => {
  assert.match(selectionScripts.finderScript, /com\.apple\.finder/);
  assert.match(selectionScripts.finderScript, /selection as alias list/);
  assert.match(selectionScripts.explorerScript, /GetForegroundWindow/);
  assert.match(selectionScripts.explorerScript, /explorer/);
  assert.match(selectionScripts.explorerScript, /SelectedItems/);
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
