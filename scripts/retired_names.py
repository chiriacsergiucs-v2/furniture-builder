"""Names of a retired third-party agent tool that must not appear in the repository (user decision 2026-11-10).

`pnpm docs:check` (scripts/check-docs.py) calls `problems()` on every tracked file, so a branch that brings a
mention back fails CI. The pattern is built from parts so this file and its test never match themselves.
"""
import re

PATTERN = re.compile("claude" + r"[\s_-]?" + "flow" + "|" + "ru" + "flo", re.IGNORECASE)


def problems(rel, text):
    """Errors for one tracked file: its path, then each matching line of its text (None for binary files)."""
    out = []
    if PATTERN.search(rel):
        out.append(f"{rel}: file name names the retired agent tool")
    for n, line in enumerate((text or "").splitlines(), 1):
        if PATTERN.search(line):
            out.append(f"{rel}:{n}: names the retired agent tool")
    return out
