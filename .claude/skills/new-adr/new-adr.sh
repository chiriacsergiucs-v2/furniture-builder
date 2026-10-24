#!/usr/bin/env bash
# Create a new ADR from docs/adr/_template.md and register it in docs/adr/README.md.
#
# Usage: new-adr.sh "<Title>" ["ADR-001, ADR-002"]
#   Title    short, imperative, English (e.g. "Set up the monorepo structure")
#   deps     optional dependencies; numbers or ADR-NNN ids, comma/space separated
#
# What it does:
#   - picks the next free number, looking at docs/adr/, docs/adr-done/ and (if present)
#     origin/main or origin/master, so parallel branches are less likely to collide
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

# --- next free number --------------------------------------------------------
max=0
consider() {
  local b n
  b="$(basename "$1")"
  case "$b" in
    ADR-[0-9]*-*.md)
      n="${b#ADR-}"
      n=$((10#${n%%-*}))
      if [ "$n" -gt "$max" ]; then max=$n; fi
      ;;
  esac
}

shopt -s nullglob
for p in "$adr_dir"/ADR-*.md "$done_dir"/ADR-*.md; do
  consider "$p"
done

# Numbers already used on the remote default branch (best effort; run `git fetch` first).
for ref in origin/main origin/master; do
  if git rev-parse --verify -q "$ref" >/dev/null; then
    while IFS= read -r p; do
      consider "$p"
    done < <(git ls-tree -r --name-only "$ref" -- "$adr_dir" "$done_dir")
  fi
done

num="$(printf '%03d' "$((max + 1))")"
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
