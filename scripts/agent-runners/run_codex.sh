#!/bin/zsh
# usage: run_codex.sh <project-dir> <task-id> <prompt-file>
# Runs one Codex task in the repo. Logs and markers go to <project-dir>/logs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="${1:?project dir, e.g. projects/windows-share}"
ID="${2:?task id}"
PROMPT="${3:?prompt file, relative to project}"
DIR="$ROOT/$PROJECT"
mkdir -p "$DIR/logs"
[ -e "$DIR/logs/$ID.log" ] && { echo "task $ID already started"; exit 0; }
nohup /Users/ronglecat/.local/bin/codex exec -s workspace-write --skip-git-repo-check -C "$ROOT" "$(cat "$DIR/$PROMPT")" > "$DIR/logs/$ID.log" 2>&1 && touch "$DIR/logs/$ID.done" || touch "$DIR/logs/$ID.fail" &
