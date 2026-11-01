#!/bin/zsh
# usage: run_cursor.sh <project-dir> <task-id> <prompt-file>
# Fallback runner when the Grok budget is exhausted. Logs go to <project-dir>/logs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="${1:?project dir, e.g. projects/windows-share}"
ID="${2:?task id}"
PROMPT="${3:?prompt file, relative to project}"
DIR="$ROOT/$PROJECT"
mkdir -p "$DIR/logs"
[ -e "$DIR/logs/$ID.log" ] && { echo "task $ID already started"; exit 0; }
nohup /Users/ronglecat/.local/bin/cursor-agent -p --force --trust --model grok-4.7-medium --workspace "$ROOT" --output-format text "$(cat "$DIR/$PROMPT")" > "$DIR/logs/$ID.log" 2>&1 && touch "$DIR/logs/$ID.done" || touch "$DIR/logs/$ID.fail" &
