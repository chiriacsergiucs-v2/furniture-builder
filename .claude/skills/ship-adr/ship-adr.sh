#!/usr/bin/env bash
# Mark an ADR as implemented and move it to docs/adr-done/, fixing all links.
#
# Usage: ship-adr.sh <ADR-NUMBER> ["implemented note"]
#   ADR-NUMBER        e.g. 003 or 3 or ADR-003
#   implemented note  optional parenthetical, e.g. "Node 22 LTS, PostgreSQL 16"
#
# Expected layout:
#   docs/adr/ADR-NNN-slug.md        pending ADRs (flat folder)
#   docs/adr-done/ADR-NNN-slug.md   implemented ADRs
#   docs/adr/README.md              index table; the LAST column of each row is the status
#
# Does NOT commit or push — the caller does that.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

adr_dir="docs/adr"
done_dir="docs/adr-done"

# --- normalise the number to a zero-padded 3-digit id -----------------------
raw="${1:?usage: ship-adr.sh <ADR-NUMBER> [note]}"
num="${raw#ADR-}"; num="${num#adr-}"; num="${num%%-*}"
case "$num" in
  ''|*[!0-9]*) echo "Invalid ADR number: $raw" >&2; exit 1 ;;
esac
num="$(printf '%03d' "$((10#$num))")"

note="${2:-}"
today="$(date +%F)"

# --- locate the source file --------------------------------------------------
shopt -s nullglob
matches=("$adr_dir"/ADR-"$num"-*.md)
if [ ${#matches[@]} -eq 0 ]; then
  if compgen -G "$done_dir/ADR-$num-*.md" >/dev/null; then
    echo "ADR-$num is already in $done_dir — nothing to do." >&2; exit 3
  fi
  echo "No ADR-$num-*.md found in $adr_dir." >&2; exit 1
fi
if [ ${#matches[@]} -gt 1 ]; then
  echo "Ambiguous: multiple files match ADR-$num-*: ${matches[*]}" >&2; exit 1
fi

src="${matches[0]}"
slug="$(basename "$src" .md)"        # e.g. ADR-003-availability-slots
dst="$done_dir/$slug.md"

# Fail early, before touching anything.
if ! grep -q '^- Status:' "$src"; then
  echo "ERROR: $src has no '- Status:' line (expected e.g. '- Status: Pending')." >&2
  exit 1
fi

echo "Shipping $slug"

# Hint only: unchecked items in the "Done when" section.
unchecked="$(awk '
  tolower($0) ~ /done when/ { sect = 1; next }
  /^#/ { sect = 0 }
  sect && /^[[:space:]]*-[[:space:]]*\[ \]/ { c++ }
  END { print c + 0 }
' "$src")"
if [ "$unchecked" -gt 0 ]; then
  echo "WARN: $unchecked unchecked item(s) in 'Done when' — verify before committing."
fi

# In-place edits go through perl, not sed: BSD sed (macOS) reads `-i -E` as "-E is the backup
# suffix" and its `a` command needs a backslash-newline, so the GNU forms of both break there.
# perl -i behaves identically on both platforms.

# --- 1. front matter: Status + Implemented line ------------------------------
perl -i -pe 's/^- Status:.*/- Status: Implemented/' "$src"

if ! grep -q '^- Implemented:' "$src"; then
  impl_line="- Implemented: $today"
  if [ -n "$note" ]; then
    impl_line="$impl_line ($note)"
  fi
  # Insert after the Date line, or after the Status line if there is no Date line.
  # The text passes through the environment, so it needs no escaping.
  if grep -q '^- Date:' "$src"; then
    IMPL_LINE="$impl_line" perl -i -pe 's/^(- Date:.*)$/$1\n$ENV{IMPL_LINE}/' "$src"
  else
    IMPL_LINE="$impl_line" perl -i -pe 's/^(- Status:.*)$/$1\n$ENV{IMPL_LINE}/' "$src"
  fi
fi

# --- 2. move the file (staged) ----------------------------------------------
mkdir -p "$done_dir"
if ! git mv "$src" "$dst" 2>/dev/null; then
  # Untracked file: plain move, then stage the new location.
  mv "$src" "$dst"
  git add "$dst"
fi

# --- 3. rewrite every link to this ADR --------------------------------------
# A link to this ADR appears in three spellings: bare "](ADR-<slug>.md)" (how pending ADRs and
# the README link siblings), "](./ADR-<slug>.md)", and "](../adr/ADR-<slug>.md)" (how ADRs
# already in adr-done/ link a then-pending ADR). All become "](../adr-done/ADR-<slug>.md)".
# Links that already point at adr-done/ don't match, so re-running is a no-op. \Q..\E quotes the
# literal slug, so no hand-escaping is needed.
export OLD_SLUG="$slug"
for f in "$adr_dir"/*.md "$done_dir"/*.md; do
  perl -i -pe 's{\]\((?:\.\./adr/|\./)?\Q$ENV{OLD_SLUG}\E\.md\)}{](../adr-done/$ENV{OLD_SLUG}.md)}g' "$f"
done

# --- 3c. repoint the moved file's own sibling links --------------------------
# Inside docs/adr/ this ADR linked still-pending ADRs as plain siblings, "](ADR-XXX-slug.md)".
# From docs/adr-done/ that path is broken, so each one is repointed at where the target still
# lives: "../adr/ADR-XXX-slug.md". Links to ADRs already in adr-done/ are spelled
# "../adr-done/..." and don't match the bare-sibling pattern, so they are left alone (and
# re-running changes nothing).
for target in $(perl -ne 'print "$1\n" while /\]\((?:\.\/)?(ADR-\d+-[A-Za-z0-9._-]+)\.md\)/g' "$dst" | sort -u); do
  if [ -e "$adr_dir/$target.md" ]; then
    TARGET="$target" perl -i -pe 's{\]\((?:\./)?\Q$ENV{TARGET}\E\.md\)}{](../adr/$ENV{TARGET}.md)}g' "$dst"
  fi
done

# --- 4. mark the README table row Implemented -------------------------------
# Find the row by its (now rewritten) ../adr-done/ link and replace its last cell (the status)
# with "✅ Implemented". Replacing, not appending, makes this idempotent.
readme="$adr_dir/README.md"
if [ -f "$readme" ]; then
  export DONE_PATH="../adr-done/${slug}.md"
  perl -i -pe '
    if (index($_, $ENV{DONE_PATH}) >= 0 && /^\s*\|/) {
      s/\|[^|\n]*\|\s*$/| ✅ Implemented |\n/;
    }' "$readme"
else
  echo "WARN: $readme not found — index not updated."
fi

# --- 5. report references to the old path outside docs/adr*/ -----------------
# Links elsewhere (CLAUDE.md, other docs, code comments) are not rewritten automatically.
stale="$(git grep -nF "adr/${slug}.md" || true)"
if [ -n "$stale" ]; then
  echo
  echo "WARN: these places still reference the old path docs/adr/${slug}.md — fix by hand:"
  echo "$stale"
fi

echo
echo "Done. Moved to $dst and updated links."
echo
git status --short
