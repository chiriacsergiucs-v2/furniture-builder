#!/usr/bin/env python3
"""Claude Code PreToolUse hook (N315): block `git push` while an id this branch added is already taken on origin/main.

The ids are the backlog rows (F, N, D), the gaps (G-NNN, in the ledger and the archive) and the ADR numbers. An id the
branch added (not in the merge base) that origin/main also holds, from other work merged meanwhile, is a collision: it
cost a renumbering three times (N280-N286, G-510, N304). The hook fetches origin/main, lists the collisions with the next
free id of each kind, and exits 2 so the push does not run. `--next` prints the next free ids instead (`pnpm next-id`).
When the fetch fails (offline) the hook compares against the last fetched origin/main; it is silent only when git cannot
tell at all. `--ci` is the hard check (G-517): CI runs it on every pull request after fetching main, and it exits 1 on a
collision or when git cannot tell."""
import json, pathlib, re, subprocess, sys

PUSH = re.compile(r"\bgit\b[^;&|\n]*?\bpush\b")
BACKLOG = "docs/backlog.md"
GAPS = ("docs/adr/GAPS.md", "docs/adr/GAPS-archive.md")
ADR_DIRS = ("docs/adr", "docs/adr-done")


def backlog_ids(text):
    return set(re.findall(r"^\| ([FND]\d+) \|", text, re.M))


def gap_ids(text):
    return set(re.findall(r"^### (G-\d{3,}):", text, re.M))


def adr_ids(names):
    return {m.group(1) for n in names if (m := re.search(r"(?:^|/)(ADR-\d+)-", n))}


def collisions(base, head, main):
    """Ids in `head` but not in `base` that `main` holds. Each argument is a set of ids."""
    return sorted((head - base) & main)


def next_free(taken):
    """{kind: next free id}, from all the ids of one kind taken so far (kind = the letters before the number)."""
    top = {}
    for i in taken:
        m = re.match(r"([A-Za-z]+-?)(\d+)$", i)
        if m:
            top[m.group(1)] = max(top.get(m.group(1), 0), int(m.group(2)))
    width = {"ADR-": 3, "G-": 3}
    return {k: f"{k}{n + 1:0{width.get(k, 0)}d}" for k, n in top.items()}


def git(root, *args, check=False):
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, check=check)


def show(root, rev, path):
    r = git(root, "show", f"{rev}:{path}")
    return r.stdout if r.returncode == 0 else ""


def ids_at(root, rev):
    """All ids at a revision (`None` = the working files)."""
    def text(path):
        if rev is None:
            p = pathlib.Path(root) / path
            return p.read_text() if p.is_file() else ""
        return show(root, rev, path)

    if rev is None:
        names = [str(p.relative_to(root)) for d in ADR_DIRS for p in (pathlib.Path(root) / d).glob("ADR-*.md")]
    else:
        names = git(root, "ls-tree", "-r", "--name-only", rev, *ADR_DIRS).stdout.splitlines()
    return backlog_ids(text(BACKLOG)) | set().union(*(gap_ids(text(g)) for g in GAPS)) | adr_ids(names)


def find(root, fetch=True):
    """(collisions, next free ids) of the branch in `root` against origin/main; None when git cannot tell."""
    if fetch:  # offline, a failed fetch leaves the last fetched origin/main; merge-base fails when there is none
        git(root, "fetch", "-q", "origin", "main")
    base = git(root, "merge-base", "HEAD", "origin/main")
    if base.returncode != 0:
        return None
    base_ids, main_ids, head_ids = ids_at(root, base.stdout.strip()), ids_at(root, "origin/main"), ids_at(root, None)
    return collisions(base_ids, head_ids, main_ids), next_free(head_ids | main_ids)


def message(bad, free, verb):
    prefixes = {re.match(r"[A-Za-z]+-?", i).group(0) for i in bad}
    return (f"{verb}: this branch added ids that origin/main already holds: " + ", ".join(bad) + ". "
            "Merge origin/main, give each of your rows, gaps or ADRs the next free id (" +
            ", ".join(free[p] for p in sorted(prefixes) if p in free) + "), update every reference to it, then push. "
            "`pnpm next-id` lists the next free ids.")


def ci(root):
    """The CI check: no fetch (the workflow fetches main), exit 1 on a collision or when git cannot tell."""
    res = find(root, fetch=False)
    if res is None:
        print("id check: git could not compare this branch with origin/main (fetch main with history first)",
              file=sys.stderr)
        return 1
    if res[0]:
        print(message(*res, "id check failed"), file=sys.stderr)
        return 1
    print("id check: no id this branch added is already on origin/main")
    return 0


def main(argv):
    root = "."
    if "--ci" in argv:
        return ci(root)
    if "--next" in argv:
        res = find(root)
        print("\n".join(f"{k}: {v}" for k, v in sorted(res[1].items())) if res else "git could not tell")
        return 0
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    command = (event.get("tool_input") or {}).get("command") or ""
    if not PUSH.search(command):
        return 0
    try:
        res = find(event.get("cwd") or ".")
    except Exception:  # never break a session over a reminder
        return 0
    if not res or not res[0]:
        return 0
    print(message(*res, "git push blocked"), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
