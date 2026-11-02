// Cross-platform wrapper for the Windows package build.
// package.json cannot prefix env vars portably ("VAR=value command" is POSIX
// only), so the variable is set here and electron-builder is spawned with it.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = {...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false'};
const windows = process.platform === 'win32';
const command = windows ? 'npx.cmd' : 'npx';
const child = spawn(command, ['electron-builder', '--win', '--x64'], {cwd: root, env, stdio: 'inherit', shell: windows});
child.on('error', error => {
  console.error(`package-win: ${error.message}`);
  process.exit(1);
});
child.on('exit', code => process.exit(code ?? 0));
