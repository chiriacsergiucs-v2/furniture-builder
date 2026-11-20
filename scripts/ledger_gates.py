"""Evidence gates for the ledgers (retro 2026-11-20, patterns P4 and P10). Imported by scripts/check-docs.py.

- A backlog row marked Done must not say in its own evidence that the work is unmerged, unshipped or still owes burst
  debt (P4).
- An implemented ADR has no unchecked "- [ ]" Done-when item unless that line names the G id that holds it (P4).
- A `burst-skipped:` marker states its blocker and its cost: `burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what
  blocks it>; cost: S|M|L)` (P10).

Rows and ADRs written before these gates are legacy: they are exempt, and the work to clear them is in G-573."""
import re

# The next free ids on 2026-11-20, when the gates were added; anything below is legacy (G-573).
LEGACY_BELOW = {"N": 361, "F": 19, "D": 4}
LEGACY_ADR_BELOW = 281

NOT_DONE_WORDS = re.compile(r"not merged|PR open|not shipped|not pushed|burst-skipped:", re.I)
MARKER = re.compile(r"burst-skipped:[^()]*\(([^)]*)\)")
MARKER_BODY = re.compile(r"^burst, \d{4}-\d{2}-\d{2}; blocker: [^;]+; cost: [SML]$")


def is_legacy_row(row_id):
    """True for a backlog id allocated before the gates (N360 and earlier, F18, D03)."""
    return int(row_id[1:]) < LEGACY_BELOW[row_id[0]]


def backlog_problems(rows):
    """rows: (id, status, evidence) tuples from docs/backlog.md. Returns error strings."""
    out = []
    for row_id, status, evidence in rows:
        if is_legacy_row(row_id):
            continue
        if status == "Done" and NOT_DONE_WORDS.search(evidence):
            word = NOT_DONE_WORDS.search(evidence).group(0)
            out.append(f"docs/backlog.md: {row_id} is Done but its evidence says '{word}' (make it Partially done)")
        if "burst-skipped:" in evidence:
            bodies = MARKER.findall(evidence)
            if len(bodies) < evidence.count("burst-skipped:") or not all(MARKER_BODY.match(b.strip()) for b in bodies):
                out.append(
                    f"docs/backlog.md: {row_id} has a burst-skipped marker without "
                    "'(burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)'"
                )
    return out


def adr_problems(rel, num, status, text):
    """Unchecked Done-when items in an implemented ADR that name no G id."""
    if status != "Implemented" or int(num) < LEGACY_ADR_BELOW:
        return []
    return [
        f"{rel}:{i}: unchecked Done-when item in an implemented ADR names no G id"
        for i, line in enumerate(text.splitlines(), 1)
        if re.match(r"\s*- \[ \]", line) and not re.search(r"\bG-\d{3}\b", line)
    ]
