#!/usr/bin/env python3
"""Claude Code PreToolUse hook (user decision 2026-11-10): block `git commit` and `git push` while any tracked or
new file names the retired third-party agent tool, in its path or its text.

Covers the paths CI checks only after the fact: `ff` pushes straight to main and ship pull requests. Reads the hook
event as JSON on stdin; exit 2 blocks the command and shows the reason to Claude. The pattern is built from parts so
this file never matches itself, and scripts/test_retired_name_hook.py checks it equals the one in check-docs.py.
"""
import json, pathlib, re, subprocess, sys

RETIRED = re.compile("claude" + r"[\s_-]?" + "flow" + "|" + "ru" + "flo", re.I)
GIT_WRITE = re.compile(r"\bgit\b[^;&|\n]*?\b(commit|push)\b")


def problems(root):
    files = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                           cwd=root, capture_output=True, text=True, check=True).stdout.splitlines()
    out = []
    for rel in files:
        if RETIRED.search(rel):
            out.append(f"{rel}: file name names the retired agent tool")
        p = root / rel
        if not p.is_file():
            continue
        try:
            text = p.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if RETIRED.search(line):
                out.append(f"{rel}:{i}: names the retired agent tool")
    return out


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    command = (event.get("tool_input") or {}).get("command") or ""
    if not GIT_WRITE.search(command):
        return 0
    root = pathlib.Path(event.get("cwd") or ".")
    top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=root, capture_output=True, text=True)
    if top.returncode != 0:
        return 0
    found = problems(pathlib.Path(top.stdout.strip()))
    if not found:
        return 0
    print("Blocked: the retired agent tool's name is back (user decision 2026-11-10). Remove it, then retry:",
          *found[:20], sep="\n", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
