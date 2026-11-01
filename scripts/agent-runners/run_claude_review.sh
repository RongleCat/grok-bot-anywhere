#!/bin/zsh
# usage: run_claude_review.sh <project-dir> <task-id> <prompt-file> <result-file>
# Read-only review pass. Result and log stay inside the project directory.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="${1:?project dir, e.g. projects/windows-share}"
ID="${2:?task id}"
PROMPT="${3:?prompt file, relative to project}"
RESULT="${4:?result file, relative to project}"
DIR="$ROOT/$PROJECT"
mkdir -p "$DIR/logs"
[ -e "$DIR/logs/$ID.log" ] && { echo "task $ID already started"; exit 0; }
nohup /Users/ronglecat/.local/bin/claude -p "$(cat "$DIR/$PROMPT")" --allowedTools "Read" "Grep" "Glob" "Bash(npm test:*)" "Bash(node --test:*)" "Bash(git diff:*)" "Bash(git status:*)" "Bash(ls:*)" "Bash(wc:*)" > "$DIR/$RESULT" 2> "$DIR/logs/$ID.log" && touch "$DIR/logs/$ID.done" || touch "$DIR/logs/$ID.fail" &
