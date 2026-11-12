#!/bin/sh
# rig-enforcement base 5. Do not edit; project rules go into
# .claude/hooks/project/post-edit/.
#
# Claude Code PostToolUse hook for Edit, MultiEdit and Write. Formats an edited
# PHP file with Pint and an edited JS, TS, CSS, JSON or Markdown file with
# Prettier, each only when installed in the project. Then runs every
# executable in .claude/hooks/project/post-edit/ with the same input. Exit 2
# shows the error to Claude.
set -u
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 1

input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import json, sys; print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))')

case "$file" in
  *.php)
    if [ -x vendor/bin/pint ] && [ -f "$file" ]; then
      if ! out=$(vendor/bin/pint --quiet "$file" 2>&1); then
        printf 'Pint failed on %s:\n%s\n' "$file" "$out" >&2
        exit 2
      fi
    fi
    ;;
  *.js|*.jsx|*.mjs|*.cjs|*.ts|*.tsx|*.mts|*.cts|*.css|*.json|*.md)
    if [ -x node_modules/.bin/prettier ] && [ -f "$file" ]; then
      if ! out=$(node_modules/.bin/prettier --write "$file" 2>&1 >/dev/null); then
        printf 'Prettier failed on %s:\n%s\n' "$file" "$out" >&2
        exit 2
      fi
    fi
    ;;
esac

if [ -d .claude/hooks/project/post-edit ]; then
  for hook in .claude/hooks/project/post-edit/*; do
    [ -f "$hook" ] && [ -x "$hook" ] || continue
    printf '%s' "$input" | "$hook"
    status=$?
    [ "$status" -eq 2 ] && exit 2
  done
fi
exit 0
