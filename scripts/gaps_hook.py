#!/usr/bin/env python3
"""Claude Code Stop hook: remind the agent to record unbuilt items in docs/adr/GAPS.md (ADR-082).

Reads the hook input on stdin. Blocks the stop once, with a reason, when the last reply names skipped,
deferred or out-of-scope items, cites no G id, and the ledger has not changed on this branch.
Never blocks twice in a row (stop_hook_active) and stays silent on any error: CI (pnpm docs:check) is
the hard check, this is the reminder."""
import json, pathlib, re, subprocess, sys

TRIGGER = re.compile(
    r"skipped this iteration|not implemented|not built|out of scope|left out|deferred|"
    r"open questions?|not done|follow-up|to be done", re.I)
LEDGER = "docs/adr/GAPS.md"


def last_reply(data):
    if isinstance(data.get("last_assistant_message"), str):
        return data["last_assistant_message"]
    path = data.get("transcript_path")
    if not path:
        return ""
    texts = []
    for line in pathlib.Path(path).read_text().splitlines():
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        msg = entry.get("message") or {}
        content = msg.get("content")
        if entry.get("type") == "user":
            # A real user turn (not a tool result) starts a new reply.
            if isinstance(content, str) or any(c.get("type") == "text" for c in content or [] if isinstance(c, dict)):
                texts = []
        elif entry.get("type") == "assistant" and isinstance(content, list):
            texts += [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
    return "\n".join(texts)


def ledger_changed(cwd):
    def git(*args):
        return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if git("status", "--porcelain", "--", LEDGER).stdout.strip():
        return True
    base = git("merge-base", "HEAD", "origin/main")
    if base.returncode != 0:
        return False
    return git("diff", "--quiet", base.stdout.strip(), "HEAD", "--", LEDGER).returncode == 1


def decide(data, changed):
    if data.get("stop_hook_active"):
        return None
    reply = last_reply(data)
    if not TRIGGER.search(reply) or re.search(r"\bG-\d{3}\b", reply) or changed():
        return None
    return {"decision": "block", "reason": (
        "Your reply names items that are not built (skipped, out of scope, deferred or open questions), but "
        f"{LEDGER} has no change and the reply cites no G id. Record each one with `pnpm gaps add` "
        "(origin, missing, the user's request in their words, questions, the suggested pick closest to the "
        "request with effort/value estimates), cite the G ids in the reply, then finish. If none of them is a "
        "furniture-builder gap, say so in one line and finish.")}


def main():
    try:
        data = json.load(sys.stdin)
        cwd = data.get("cwd") or "."
        out = decide(data, lambda: ledger_changed(cwd))
    except Exception:  # never break a session over a reminder
        return 0
    if out:
        print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
