#!/bin/zsh
set -euo pipefail

cd "${0:A:h:h}"
sw_vers
uname -m
sysctl -n hw.model
xcode-select -p
xcrun --sdk macosx --show-sdk-path
swift --version
git --version
if command -v node >/dev/null; then node --version; fi
if ioreg -l | rg 'TouchBarUserDevice' >/dev/null; then
  print 'Touch Bar device: found (IORegistry)'
else
  print 'Touch Bar device: not detected; use desktop picker'
fi
