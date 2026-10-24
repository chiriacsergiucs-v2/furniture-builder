#!/usr/bin/env bash
# Run the project's verification commands, exactly as listed in the "Commands" table
# of CLAUDE.md, and print a short pass/fail report.
#
# Usage: verify.sh [quick] [--install]
#   quick      only the Lint and Type-check rows
#   --install  run the Install row even if node_modules already exists
#
# Table format (in CLAUDE.md, under "## Commands"): two columns, name and command.
#   | Check      | Command           |
#   |---|---|
#   | Install    | `npm ci`         |
#   | Lint       | `npm run lint`   |
#   Rows run top to bottom, so put setup rows (Install, Start database, Migrate) first.
#   Commands must not contain the "|" character.
#
# Exit codes: 0 all passed, 1 at least one check failed, 2 table missing or incomplete.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

claude_md="CLAUDE.md"
quick=0
force_install=0
for arg in "$@"; do
  case "$arg" in
    quick) quick=1 ;;
    --install) force_install=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -f "$claude_md" ]; then
  echo "$claude_md not found." >&2
  exit 2
fi

# --- read the Commands table -------------------------------------------------
rows="$(awk '
  /^## Commands/ { sect = 1; next }
  /^## /         { sect = 0 }
  sect && /^\|/ {
    n = split($0, c, "|")
    name = c[2]; cmd = c[3]
    gsub(/^[ \t]+|[ \t]+$/, "", name)
    gsub(/^[ \t]+|[ \t]+$/, "", cmd)
    if (name == "" || name == "Check" || name ~ /^-+$/) next
    gsub(/^`|`$/, "", cmd)
    print name "\t" cmd
  }' "$claude_md")"

if [ -z "$rows" ]; then
  echo "No Commands table found in $claude_md (expected a '## Commands' section with a table)." >&2
  exit 2
fi

todo="$(printf '%s\n' "$rows" | awk -F'\t' '$2 == "" || toupper($2) == "TODO" { print "  - " $1 }')"
if [ -n "$todo" ]; then
  echo "These rows in the $claude_md Commands table are still empty or TODO:" >&2
  echo "$todo" >&2
  exit 2
fi

# --- run ---------------------------------------------------------------------
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

failed=0
report=""

run_step() {
  local start end secs
  start="$(date +%s)"
  bash -c "$cmd" >"$log" 2>&1 </dev/null
  status=$?
  end="$(date +%s)"
  secs=$((end - start))
  if [ "$status" -eq 0 ]; then
    echo "✅ $name (${secs}s)"
    report+="PASS  $name"$'\n'
  else
    echo "❌ $name (${secs}s) — exit $status — $cmd"
    tail -n 40 "$log" | sed 's/^/    /'
    report+="FAIL  $name"$'\n'
    failed=$((failed + 1))
  fi
}

while IFS=$'\t' read -r name cmd; do
  lname="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')"

  case "$lname" in
    install)
      if [ "$force_install" = 1 ] || [ ! -d node_modules ]; then
        run_step
        if [ "$status" -ne 0 ]; then break; fi
      else
        echo "⏭  $name (skipped: node_modules present; use --install to force)"
      fi
      continue
      ;;
  esac

  if [ "$quick" = 1 ]; then
    case "$lname" in
      lint|type-check|typecheck) ;;
      *) continue ;;
    esac
  fi

  run_step

  # A failed setup step makes the checks after it meaningless.
  case "$lname" in
    "start database"|migrate)
      if [ "$status" -ne 0 ]; then break; fi
      ;;
  esac
done <<EOF
$rows
EOF

echo
echo "=== Summary ==="
printf '%s' "$report"
if [ "$failed" -eq 0 ]; then
  echo "All checks passed."
  exit 0
fi
echo "$failed check(s) failed."
exit 1
