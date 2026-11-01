#!/usr/bin/env node
// Cross-platform command launcher for root npm scripts.
// Strips ELECTRON_RUN_AS_NODE so npm start/smoke always boots the real Electron app.
import {spawn} from 'node:child_process';

const [cwd, command, ...args] = process.argv.slice(2);
if (!cwd || !command) {
  console.error('usage: node scripts/run.mjs <cwd> <command> [args...]');
  process.exit(2);
}

const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;

const windows = process.platform === 'win32';
const executable = windows && !command.endsWith('.cmd') && !command.endsWith('.exe')
  ? `${command}.cmd`
  : command;

const child = spawn(executable, args, {
  cwd,
  env,
  stdio: 'inherit',
  shell: windows,
});

child.on('error', (error) => {
  console.error(`run: ${command}: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
