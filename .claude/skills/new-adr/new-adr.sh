#!/usr/bin/env bash
# Create a new ADR from docs/adr/_template.md and register it in docs/adr/README.md.
#
# Usage: ADR_ID=ADR-NNN new-adr.sh "<Title>" ["ADR-001, ADR-002"]
#   ADR_ID   the number claimed on GitHub first (branch id/ADR-NNN, see scripts/ids.py)
#   Title    short, imperative, English (e.g. "Set up the monorepo structure")
#   deps     optional dependencies; numbers or ADR-NNN ids, comma/space separated
#
# What it does:
#   - uses the claimed number; refuses it if docs/adr/, docs/adr-done/ or origin/main
#     already has that number
#   - writes docs/adr/ADR-NNN-slug.md from the template (title, date, deps filled in,
#     the guidance comment removed)
#   - appends a row after the last "| [ADR-" row of the Index table in docs/adr/README.md
#
# Does NOT commit, push or create a branch — the caller does that.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

adr_dir="docs/adr"
done_dir="docs/adr-done"
tpl="$adr_dir/_template.md"
readme="$adr_dir/README.md"

title="${1:?usage: new-adr.sh \"<Title>\" [\"ADR-001, ADR-002\"]}"
deps_raw="${2:-}"
today="$(date +%F)"

[ -f "$tpl" ] || { echo "Template not found: $tpl" >&2; exit 1; }

# --- slug: ascii kebab-case, max 60 chars -----------------------------------
slug="$(printf '%s' "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
  | cut -c1-60 \
  | sed -E 's/-+$//')"
if [ -z "$slug" ]; then
  echo "Could not derive a slug from the title (use plain English words)." >&2
  exit 1
fi

# --- claimed number ---------------------------------------------------------
claimed="${ADR_ID:?set ADR_ID to the number claimed with scripts/ids.py (branch id/ADR-NNN)}"
[[ "$claimed" =~ ^ADR-([0-9]{3})$ ]] || { echo "ADR_ID must look like ADR-NNN, is '$claimed'." >&2; exit 1; }
num="${BASH_REMATCH[1]}"
taken="$(ls "$adr_dir" "$done_dir" 2>/dev/null; git ls-tree -r --name-only origin/main -- "$adr_dir" "$done_dir" 2>/dev/null || true)"
if printf '%s\n' "$taken" | grep -q "ADR-$num-"; then
  echo "ADR-$num is already used; claim another number." >&2
  exit 1
fi
dst="$adr_dir/ADR-$num-$slug.md"
if [ -e "$dst" ]; then
  echo "$dst already exists." >&2
  exit 1
fi

# --- dependencies ------------------------------------------------------------
deps=""
for d in $(printf '%s' "$deps_raw" | grep -oE '[0-9]+' || true); do
  dn="$(printf '%03d' "$((10#$d))")"
  deps="${deps:+$deps, }ADR-$dn"
  if ! compgen -G "$adr_dir/ADR-$dn-*.md" >/dev/null && ! compgen -G "$done_dir/ADR-$dn-*.md" >/dev/null; then
    echo "WARN: ADR-$dn not found locally — check the dependency." >&2
  fi
done
if [ -z "$deps" ]; then
  deps="none"
  deps_cell="—"
else
  deps_cell="$deps"
fi

# --- create the file from the template --------------------------------------
TITLE="$title" NUM="$num" TODAY="$today" DEPS="$deps" perl -0777 -pe '
  s/<!--.*?-->\n*//s;
  s/^# ADR-NNN: .*$/# ADR-$ENV{NUM}: $ENV{TITLE}/m;
  s/^- Date: .*$/- Date: $ENV{TODAY}/m;
  s/^- Depends on: .*$/- Depends on: $ENV{DEPS}/m;
' "$tpl" > "$dst"

# --- register in the Index table (after its last ADR row) --------------------
# Only rows that start with "| [ADR-" belong to the Index; other tables in the README
# (e.g. "Planned numbers") must not receive the new row.
title_cell="${title//|/\\|}"
if [ -f "$readme" ]; then
  last="$(grep -n '^[[:space:]]*| \[ADR-' "$readme" | tail -1 | cut -d: -f1 || true)"
  if [ -n "$last" ]; then
    ROW="| [ADR-$num](ADR-$num-$slug.md) | $title_cell | $deps_cell | Pending |" LAST="$last" \
      perl -i -pe '$_ .= "\n" unless /\n\z/; $_ .= "$ENV{ROW}\n" if $. == $ENV{LAST};' "$readme"
  else
    echo "WARN: no Index row found in $readme — add the row by hand." >&2
  fi
else
  echo "WARN: $readme not found — index not updated." >&2
fi

echo "Created $dst"
echo "Branch suggestion: adr-$num-$slug"
echo
git status --short
