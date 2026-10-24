#!/usr/bin/env bash
# Pick the next ADR ready for implementation.
#
# "Ready" = a pending ADR in docs/adr/ that is
#   - not marked "deferred" in its Status line, and
#   - every ADR in its "Depends on:" line already exists in docs/adr-done/.
# The lowest-numbered ready ADR wins (files use 3-digit numbers, so lexical == numeric order).
#
# Expected file name: docs/adr/ADR-NNN-short-title.md
# Prints a short report and, on the last line, `NEXT=<path>` (empty if none).
set -euo pipefail
shopt -s nullglob

cd "$(git rev-parse --show-toplevel)"
ADR_DIR="docs/adr"
DONE_DIR="docs/adr-done"

# Size thresholds (heuristics, not laws).
LINE_MAX=110
BYTE_MAX=6500
DONE_MAX=8

if [ ! -d "$ADR_DIR" ]; then
  echo "Directory $ADR_DIR not found."
  echo "NEXT="
  exit 0
fi

# True if ADR number $1 (any zero-padding) exists in docs/adr-done/.
dep_done() {
  local n matches
  n="$(printf '%03d' "$((10#$1))")"
  matches=("$DONE_DIR"/ADR-"$n"-*.md)
  [ "${#matches[@]}" -gt 0 ]
}

next=""
skipped=""

for f in "$ADR_DIR"/ADR-*.md; do
  base="$(basename "$f")"
  self="${base#ADR-}"
  self="${self%%-*}"

  # Tolerates "Status:", "- Status:", "**Status:**" and "**Status**:".
  status="$(grep -m1 -iE '^[[:space:]>*-]*Status\*{0,2}:' "$f" || true)"

  # Already shipped (shouldn't be here).
  if printf '%s' "$status" | grep -qi 'implemented'; then
    continue
  fi

  if printf '%s' "$status" | grep -qi 'deferred'; then
    skipped+="  $base — deferred"$'\n'
    continue
  fi

  deps_line="$(grep -m1 -iE 'Depends on\*{0,2}:' "$f" || true)"
  missing=""
  for d in $(printf '%s' "$deps_line" | grep -oE 'ADR-[0-9]+' | grep -oE '[0-9]+' | sort -u || true); do
    if [ "$((10#$d))" -eq "$((10#$self))" ]; then
      continue
    fi
    dep_done "$d" || missing+=" ADR-$d"
  done

  if [ -z "$missing" ]; then
    next="$f"
    break
  fi
  skipped+="  $base — waiting on:$missing"$'\n'
done

if [ -n "$skipped" ]; then
  echo "Skipped / not yet ready:"
  printf '%s' "$skipped"
  echo
fi

if [ -z "$next" ]; then
  echo "No ADR is ready for implementation."
  echo "NEXT="
  exit 0
fi

echo "=== NEXT ADR ==="
head -6 "$next"
echo

# --- Size check --------------------------------------------------------------
# A single ADR is meant to be implementable without loading the rest of the plan.
# One that is too large blows up the implementation context and usually bundles
# several independent concerns that should each be their own ADR. Flag it so the
# skill can propose a split before building.
LINES="$(wc -l < "$next" | tr -d '[:space:]')"
BYTES="$(wc -c < "$next" | tr -d '[:space:]')"

# Count checklist items inside the "Done when" section only.
DONE="$(awk '
  tolower($0) ~ /done when/ { sect = 1; next }
  /^#/ { sect = 0 }
  sect && /^[[:space:]]*-[[:space:]]*\[[ xX]\]/ { c++ }
  END { print c + 0 }
' "$next")"

echo "Size: ${LINES} lines, ${BYTES} bytes, ${DONE} 'Done when' items."
oversized=0
[ "$LINES" -gt "$LINE_MAX" ] && oversized=1
[ "$BYTES" -gt "$BYTE_MAX" ] && oversized=1
[ "$DONE" -gt "$DONE_MAX" ] && oversized=1

if [ "$oversized" = 1 ]; then
  echo "WARN: this ADR is large (over ${LINE_MAX} lines / ${BYTE_MAX} bytes / ${DONE_MAX} done-items)."
  echo "      Consider splitting it into 2+ smaller ADRs before implementing (see SKILL.md)."
fi
echo "OVERSIZED=$oversized"

echo "Path: $next"
echo "NEXT=$next"