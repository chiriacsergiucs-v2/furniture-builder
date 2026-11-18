#!/usr/bin/env bash
# Find which test file leaves a file or directory behind (test pollution), by running each test file alone.
# Adapted from the systematic-debugging skill of the MIT-licensed maslennikov-ig/claude-code-orchestrator-kit.
# Usage:   .claude/skills/debug/find-polluter.sh <path that should not appear> [test glob]
# Example: .claude/skills/debug/find-polluter.sh dist-online 'tests/**/*.test.ts*'
# Exit 0: no test created it. Exit 1: polluter found (named on stdout). Exit 2: bad usage or the path already exists.

set -u

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  echo "Usage: $0 <path that should not appear> [test glob, default 'tests/**/*.test.ts*']"
  exit 2
fi

TARGET="$1"
GLOB="${2:-tests/**/*.test.ts*}"

if [ -e "$TARGET" ]; then
  echo "'$TARGET' already exists. Remove it first (look at it before deleting), then rerun."
  exit 2
fi

mapfile -t FILES < <(git ls-files -- "$GLOB" | sort)
TOTAL=${#FILES[@]}
if [ "$TOTAL" -eq 0 ]; then
  echo "No tracked test file matches '$GLOB'."
  exit 2
fi
echo "Checking $TOTAL test files for '$TARGET'"

i=0
for f in "${FILES[@]}"; do
  i=$((i + 1))
  echo "[$i/$TOTAL] $f"
  pnpm exec vitest run "$f" > /dev/null 2>&1 || true
  if [ -e "$TARGET" ]; then
    echo
    echo "Polluter: $f created '$TARGET'"
    ls -la "$TARGET"
    echo "Investigate: pnpm exec vitest run $f"
    exit 1
  fi
done

echo "No test file created '$TARGET'."
exit 0
