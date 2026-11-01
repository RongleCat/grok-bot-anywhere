#!/usr/bin/env bash
# 用本机 Developer ID 签名嵌套 native，再打公证 DMG
# 2026-11-01 arch: arm64|x64；依赖 ~/.gba-signing/env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCH="${1:-arm64}"
ENV_FILE="${GBA_SIGNING_ENV:-$HOME/.gba-signing/env}"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${CSC_NAME:?}" "${APPLE_API_ISSUER:?}" "${APPLE_TEAM_ID:?}"
# ~/.gba-signing/env 用 APPLE_API_KEY=KeyID + APPLE_API_KEY_PATH；electron-builder 要 KEY=路径、KEY_ID=ID
if [[ -n "${APPLE_API_KEY_PATH:-}" ]]; then
  export APPLE_API_KEY_ID="${APPLE_API_KEY_ID:-$APPLE_API_KEY}"
  export APPLE_API_KEY="$APPLE_API_KEY_PATH"
fi
: "${APPLE_API_KEY:?}" "${APPLE_API_KEY_ID:?}"
[[ -f "$APPLE_API_KEY" ]] || { echo "missing API key file: $APPLE_API_KEY" >&2; exit 1; }

# codesign 要完整 identity；electron-builder 的 CSC_NAME 不能带 Developer ID Application: 前缀
ID="$CSC_NAME"
export CSC_NAME="${CSC_NAME#Developer ID Application: }"
COMPANION="$ROOT/native/GrokBotCompanion.app"
MENU="$ROOT/native/GrokBotMenuHost.app"
SHARE_ENT="$MENU/Contents/Resources/share.entitlements"
MAIN_ENT="$ROOT/build/entitlements.mac.plist"

codesign --force --options runtime --timestamp --entitlements "$MAIN_ENT" --sign "$ID" "$COMPANION"
for appex in "$MENU"/Contents/PlugIns/*.appex; do
  codesign --force --options runtime --timestamp --entitlements "$SHARE_ENT" --sign "$ID" "$appex"
done
codesign --force --options runtime --timestamp --sign "$ID" "$MENU"
codesign --verify --deep --strict "$COMPANION"
codesign --verify --deep --strict "$MENU"

cd "$ROOT"
npm run build
unset CSC_IDENTITY_AUTO_DISCOVERY || true
export CSC_IDENTITY_AUTO_DISCOVERY=true
npx electron-builder --mac dmg --"$ARCH"
