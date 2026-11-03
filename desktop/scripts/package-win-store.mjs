// Windows Store package: a full MSIX stamped with Partner Center's identity.
//
// Partner Center re-signs Store submissions, so this build is deliberately
// unsigned and needs no certificate. The identity values must be copied
// verbatim from Partner Center -> your app -> Product identity, otherwise the
// upload fails with a package identity mismatch.
//
//   STORE_PACKAGE_NAME             Package/Identity/Name
//   STORE_PUBLISHER                Package/Identity/Publisher   CN=<GUID>
//   STORE_PUBLISHER_DISPLAY_NAME   Package/Properties/PublisherDisplayName
//   STORE_DISPLAY_NAME             Package/Properties/DisplayName (optional)
//   MSIX_VERSION                   four-part version (optional, <app version>.0)
import {spawn, spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';

if (!windows) {
  console.error('package-win-store: the MSIX toolchain (makeappx, makepri) only runs on Windows.');
  console.error('Use the windows-store workflow in GitHub Actions, or run this on a Windows machine.');
  process.exit(1);
}

// GitHub Actions and current Windows ship pwsh; older or trimmed installs only
// have Windows PowerShell, which runs the packing script fine.
const powershell = spawnSync('where', ['pwsh'], {stdio: 'ignore'}).status === 0
  ? 'pwsh'
  : 'powershell.exe';

const identity = {
  STORE_PACKAGE_NAME: 'Package/Identity/Name',
  STORE_PUBLISHER: 'Package/Identity/Publisher',
  STORE_PUBLISHER_DISPLAY_NAME: 'Package/Properties/PublisherDisplayName'
};
const missing = Object.keys(identity).filter(key => !process.env[key]?.trim());
if (missing.length) {
  console.error('package-win-store: missing Partner Center identity.');
  for (const key of missing) console.error(`  ${key}  <- ${identity[key]}`);
  console.error('Copy these from Partner Center -> your app -> Product identity.');
  process.exit(1);
}

const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const msixVersion = process.env.MSIX_VERSION || `${version}.0`;
const displayName = process.env.STORE_DISPLAY_NAME || 'Grok Bot';
const packScript = fileURLToPath(new URL('./pack-full.ps1', import.meta.url));
const appDirectory = fileURLToPath(new URL('../release/win-unpacked', import.meta.url));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd: root, stdio: 'inherit', ...options});
    child.on('error', reject);
    child.on('exit', code => code === 0
      ? resolve()
      : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)));
  });
}

try {
  await run('npx.cmd', ['electron-builder', '--win', '--x64'], {
    shell: true,
    env: {...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false'}
  });
  await run(powershell, [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', packScript,
    '-AppDirectory', appDirectory,
    '-Sign', 'Unsigned',
    '-Version', msixVersion,
    '-PackageName', process.env.STORE_PACKAGE_NAME,
    '-Publisher', process.env.STORE_PUBLISHER,
    '-DisplayName', displayName,
    '-PublisherDisplayName', process.env.STORE_PUBLISHER_DISPLAY_NAME
  ]);
} catch (error) {
  console.error(`package-win-store: ${error.message}`);
  process.exit(1);
}

console.log(`Store MSIX ready: desktop/artifacts/full/GrokBot-${msixVersion}-x64.msix`);
console.log('Upload it in Partner Center. Do not sign it yourself.');
