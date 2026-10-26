#!/usr/bin/env python3
"""Claude Code Stop hook: say when origin/main moved under a branch with its own work (retro 2026-10-26).

GitHub sends no event when a PR starts to conflict, and ids taken on main meanwhile collide on merge. When the
branch has commits of its own and origin/main has commits the branch lacks, block the stop once with a reason.
Silent on a branch reset to main, with no own commits, when the fetch fails, and on any error."""
import json, subprocess, sys


def count(cwd, rng):
    r = subprocess.run(["git", "rev-list", "--count", rng], cwd=cwd, capture_output=True, text=True)
    return int(r.stdout.strip()) if r.returncode == 0 else 0


def main():
    try:
        data = json.load(sys.stdin)
        if data.get("stop_hook_active"):
            return 0
        cwd = data.get("cwd") or "."
        subprocess.run(["git", "fetch", "-q", "origin", "main"], cwd=cwd, capture_output=True, timeout=10)
        ahead, behind = count(cwd, "origin/main..HEAD"), count(cwd, "HEAD..origin/main")
    except Exception:  # never break a session over a reminder
        return 0
    if ahead and behind:
        print(json.dumps({"decision": "block", "reason": (
            f"origin/main has {behind} commit(s) this branch lacks (the branch has {ahead} of its own). Merge "
            "origin/main, resolve conflicts, renumber any ADR/backlog/gap id main took meanwhile (pnpm docs:check "
            "names them), re-run the checks and push, before saying CI or the PR is waiting. If this branch is "
            "deliberately not up to date, say so in one line and finish.")}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
