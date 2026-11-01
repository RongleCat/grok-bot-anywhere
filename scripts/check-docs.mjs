#!/usr/bin/env node
// Validate the LLM wiki: catalog entries, current-page links, forbidden stale paths.
import {readFile,access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogPath = join(root, 'docs/catalog.json');
const problems = [];
const rel = (p) => relative(root, p) || '.';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog.pages)) problems.push('catalog: pages must be an array');

const ids = new Set();
for (const page of catalog.pages ?? []) {
  if (!page.id || ids.has(page.id)) problems.push(`catalog: duplicate or missing id ${page.id}`);
  ids.add(page.id);
  if (!page.title) problems.push(`catalog: ${page.id} missing title`);
  if (!page.summary) problems.push(`catalog: ${page.id} missing summary`);
  if (!page.path?.startsWith('docs/')) problems.push(`catalog: ${page.id} path must start with docs/`);
  if (!existsSync(join(root, page.path))) problems.push(`catalog: ${page.id} path missing: ${page.path}`);
  if (!['current', 'unverified', 'historical', 'proposed'].includes(page.status)) problems.push(`catalog: ${page.id} bad status`);
}

// Every current page must be catalogued; history and generated API dumps are exempt.
const currentDirs = ['docs/subsystems', 'docs/platforms', 'docs/runbooks', 'docs/standards', 'docs/decisions', 'docs/reference'];
const exempt = new Set(['docs/README.md', 'docs/subsystems/README.md']);
const catalogued = new Set((catalog.pages ?? []).map((p) => p.path));
const {readdir} = await import('node:fs/promises');
for (const dir of ['docs', ...currentDirs]) {
  let entries = [];
  try { entries = await readdir(join(root, dir), {withFileTypes: true}); } catch { continue; }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const relPath = `${dir}/${entry.name}`;
    if (exempt.has(relPath)) continue;
    if (!catalogued.has(relPath)) problems.push(`catalog: current page not listed: ${relPath}`);
  }
}

const linkPages = [
  'README.md', 'AGENTS.md', 'LESSONS.md',
  ...(catalog.pages ?? []).map((p) => p.path).filter((p) => p.startsWith('docs/')),
];
const forbidden = [
  ['client-mvp/', 'old client-mvp path (now packages/client-protocol)'],
  ['orchestration/', 'old orchestration path (now projects/)'],
  ['docs/api/', 'old docs/api path (now docs/reference/api)'],
  ['dist/TouchBarBot.app', 'old Swift app path (no longer built)'],
];
const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const page of [...new Set(linkPages)]) {
  const abs = join(root, page);
  if (!existsSync(abs)) continue;
  const text = await readFile(abs, 'utf8');
  if (page.startsWith('docs/') && !/^状态：/m.test(text)) {
    problems.push(`${page}: missing "状态：" line`);
  }
  if (page !== 'LESSONS.md') {
    for (const [needle, why] of forbidden) {
      if (text.includes(needle)) problems.push(`${page}: ${why}`);
    }
  }
  for (const match of text.matchAll(linkRe)) {
    let target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    target = decodeURI(target.split('#')[0]);
    if (!target || target.includes('{{')) continue;
    const resolved = target.startsWith('/') ? join(root, target) : resolve(dirname(abs), target);
    if (!existsSync(resolved)) problems.push(`${page}: link target missing: ${target}`);
  }
}

if (problems.length) {
  console.error(`docs check failed (${problems.length}):`);
  for (const problem of problems) console.error(' -', problem);
  process.exit(1);
}
console.log(`docs check ok: ${catalog.pages.length} catalogued pages, ${new Set(linkPages).size} pages scanned.`);
