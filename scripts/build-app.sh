#!/bin/zsh
set -euo pipefail

cd "${0:A:h:h}"
node scripts/build-avatar.mjs
swift build -c release
task_bin_path="$(swift build -c release --show-bin-path)"
task_app_path="$PWD/dist/TouchBarBot.app"
mkdir -p "$task_app_path/Contents/MacOS" "$task_app_path/Contents/Resources"
cp "$task_bin_path/TouchBarBot" "$task_app_path/Contents/MacOS/TouchBarBot"
cp scripts/Info.plist "$task_app_path/Contents/Info.plist"
cp -R "$task_bin_path/TouchBarBot_TouchBarBotApp.bundle" "$task_app_path/Contents/Resources/"
mkdir -p "$task_app_path/Contents/Resources/client-mvp" "$task_app_path/Contents/Resources/runtime"
cp client-mvp/*.mjs "$task_app_path/Contents/Resources/client-mvp/"
cp "$(command -v node)" "$task_app_path/Contents/Resources/runtime/node"
cp "$(dirname "$(command -v node)")/../LICENSE" "$task_app_path/Contents/Resources/runtime/NODE-LICENSE" 2>/dev/null || true
cp assets/bloub/LICENSE "$task_app_path/Contents/Resources/BLOUB-LICENSE"
codesign --force --sign - "$task_app_path/Contents/Resources/runtime/node"
codesign --force --sign - "$task_app_path"
print "Created: $task_app_path"
