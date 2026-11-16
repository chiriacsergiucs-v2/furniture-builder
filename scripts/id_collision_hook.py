#!/usr/bin/env python3
"""Claude Code PreToolUse hook (N315): block `git push` while an id this branch added is already taken on origin/main.

The ids are the backlog rows (F, N, D), the gaps (G-NNN, in the ledger and the archive) and the ADR numbers. An id the
branch added (not in the merge base) that origin/main also holds, from other work merged meanwhile, is a collision: it
cost a renumbering three times (N280-N286, G-510, N304). The hook fetches origin/main, lists the collisions with the next
free id of each kind, and exits 2 so the push does not run. `--next` prints the next free ids instead (`pnpm next-id`).
Silent when git or the fetch fails: CI and the merge conflict are the hard checks, this is the early warning."""
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
    if fetch and git(root, "fetch", "-q", "origin", "main").returncode != 0:
        return None
    base = git(root, "merge-base", "HEAD", "origin/main")
    if base.returncode != 0:
        return None
    base_ids, main_ids, head_ids = ids_at(root, base.stdout.strip()), ids_at(root, "origin/main"), ids_at(root, None)
    return collisions(base_ids, head_ids, main_ids), next_free(head_ids | main_ids)


def main(argv):
    root = "."
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
    bad, free = res
    prefixes = {re.match(r"[A-Za-z]+-?", i).group(0) for i in bad}
    print("git push blocked: this branch added ids that origin/main already holds: " + ", ".join(bad) + ". "
          "Merge origin/main, give each of your rows, gaps or ADRs the next free id (" +
          ", ".join(free[p] for p in sorted(prefixes) if p in free) + "), update every reference to it, then push. "
          "`pnpm next-id` lists the next free ids.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
