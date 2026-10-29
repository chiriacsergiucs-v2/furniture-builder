#!/usr/bin/env python3
"""Collision-free ADR and gap numbers for parallel sessions.

A number is claimed by creating the branch `id/<KIND>-NNN` on GitHub (GitHub MCP tool
`create_branch`, from `main`). GitHub refuses a branch name that exists, so only one session
can claim a number. Claim before writing the number anywhere.

  pnpm ids next ADR             next candidate ADR number, e.g. ADR-NNN
  pnpm ids next G --after 300   next candidate above that number (after a refused claim)

The candidate is one more than the highest of: the local files, origin/main (run
`git fetch origin main` first) and every claimed `id/<KIND>-NNN` branch on origin.
Stops with an error when origin cannot be read; never guesses offline."""
import argparse, pathlib, re, subprocess, sys

REPO = pathlib.Path(__file__).resolve().parents[1]
ADR_FILE = re.compile(r"ADR-(\d{3})-[a-z0-9-]+\.md$")
GAP_HEAD = re.compile(r"^### G-(\d{3}):", re.M)


def git(*args):
    return subprocess.run(["git", "-C", str(REPO), *args], capture_output=True, text=True)


def local_max(kind):
    if kind == "ADR":
        names = [p.name for d in ("docs/adr", "docs/adr-done") for p in (REPO / d).glob("ADR-*.md")]
        r = git("ls-tree", "-r", "--name-only", "origin/main", "--", "docs/adr", "docs/adr-done")
        names += [n.rsplit("/", 1)[-1] for n in r.stdout.split()] if r.returncode == 0 else []
        nums = [int(m.group(1)) for n in names if (m := ADR_FILE.match(n))]
    else:
        texts = [(REPO / "docs/adr/GAPS.md").read_text()]
        r = git("show", "origin/main:docs/adr/GAPS.md")
        texts += [r.stdout] if r.returncode == 0 else []
        nums = [int(n) for t in texts for n in GAP_HEAD.findall(t)]
    return max(nums, default=0)


def claimed_max(kind):
    r = git("ls-remote", "--heads", "origin", f"refs/heads/id/{kind}-*")
    if r.returncode != 0:
        sys.exit(f"cannot read claimed ids from origin: {r.stderr.strip()}")
    nums = re.findall(rf"refs/heads/id/{kind}-(\d+)$", r.stdout, re.M)
    return max(map(int, nums), default=0)


def main(argv):
    ap = argparse.ArgumentParser(prog="pnpm ids")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("next")
    n.add_argument("kind", choices=("ADR", "G"))
    n.add_argument("--after", type=int, default=0, help="a number whose claim was refused")
    args = ap.parse_args(argv)
    num = max(local_max(args.kind), claimed_max(args.kind), args.after) + 1
    print(f"{args.kind}-{num:03d}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
