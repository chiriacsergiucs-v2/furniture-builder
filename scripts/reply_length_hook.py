#!/usr/bin/env python3
"""Claude Code Stop hook: keep replies short (N315; the user's rule "Keep it short, concise", the caveman session style).

Reads the hook input on stdin. Blocks the stop once, with a reason, when the last reply is longer than MAX_WORDS words
(fenced code does not count). A reply that opens with `[long]` is a deliverable the user asked for (a report, an audit,
an explanation) and passes. Never blocks twice in a row (stop_hook_active) and stays silent on any error."""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))  # -I leaves the script's folder off the path
from hooklib import last_reply  # noqa: E402

MAX_WORDS = 150
FENCE = re.compile(r"```.*?```", re.S)


def words(text):
    return len(FENCE.sub(" ", text).split())


def decide(data):
    if data.get("stop_hook_active"):
        return None
    reply = last_reply(data).strip()
    if reply.startswith("[long]"):
        return None
    n = words(reply)
    if n <= MAX_WORDS:
        return None
    return {"decision": "block", "reason": (
        f"Your last reply is {n} words; the limit is {MAX_WORDS} (the user's rule: short, concise, outcome first). "
        "Rewrite it shorter: the outcome, what the user must decide, what was skipped with its G id. Cut recaps, "
        "tables and repeated results. If the user asked for a report, an audit or an explanation, start the reply "
        "with [long] and send it as it is.")}


def main():
    try:
        out = decide(json.load(sys.stdin))
    except Exception:  # never break a session over a reminder
        return 0
    if out:
        print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
