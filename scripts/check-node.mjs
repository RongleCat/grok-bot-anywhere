const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`grok-bot-anywhere needs Node >=22.13; this is ${process.version}.`);
  console.error('Use nvm/fnm/version-fox to select Node 22, then rerun the command.');
  process.exit(1);
}
