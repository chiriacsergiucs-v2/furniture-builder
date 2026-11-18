#!/usr/bin/env python3
"""Claude Code Stop hook: remind the agent to record unbuilt items in docs/adr/GAPS.md (ADR-082).

Reads the hook input on stdin. Blocks the stop once, with a reason, when the last reply names skipped, deferred or
out-of-scope items and cites no G id. A change to the ledger earlier on the branch no longer counts as an answer (N312):
it silenced the hook for the rest of a long-lived branch, so a reply could list skips with no G id (the CLAUDE.md rule is
"record each with `pnpm gaps add` and cite the G id in the reply"). Never blocks twice in a row (stop_hook_active) and
stays silent on any error: CI (pnpm docs:check) is the hard check, this is the reminder."""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # -I leaves the script's folder off the path
from hooklib import last_reply  # noqa: E402

TRIGGER = re.compile(
    r"skipped this iteration|not implemented|not built|out of scope|left out|deferred|"
    r"open questions?|not done|follow-up|to be done|burst-skipped|\bskipped:|\bunblock:|\bblocker\b", re.I)
LEDGER = "docs/adr/GAPS.md"


def known_ids(cwd):
    """The G ids in the ledger and the archive under `cwd`; None when neither can be read (then any cited id counts)."""
    found, readable = set(), False
    for rel in (LEDGER, "docs/adr/GAPS-archive.md"):
        try:
            found |= set(re.findall(r"^### (G-\d{3,}):", (pathlib.Path(cwd) / rel).read_text(), re.M))
            readable = True
        except OSError:
            pass
    return found if readable else None


def decide(data, known=None):
    if data.get("stop_hook_active"):
        return None
    reply = last_reply(data)
    if not TRIGGER.search(reply):
        return None
    cited = set(re.findall(r"\bG-\d{3,}\b", reply))
    # A cited id must exist in the ledger or the archive: "G-999" or an old unrelated id is not a record (N318, G-514).
    if cited and known is not None:
        cited &= known
    if cited:
        return None
    return {"decision": "block", "reason": (
        "Your reply names items that are not built (skipped, out of scope, deferred or open questions), but "
        f"the reply cites no existing G id from {LEDGER} or the archive. Record each one with `pnpm gaps add` "
        "(origin, missing, the user's request in their words, questions, the suggested pick closest to the "
        "request with effort/value estimates), cite the G ids in the reply, then finish. If none of them is a "
        "furniture-builder gap, say so in one line and finish.")}


def main():
    try:
        data = json.load(sys.stdin)
        out = decide(data, known_ids(data.get("cwd") or "."))
    except Exception:  # never break a session over a reminder
        return 0
    if out:
        print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
