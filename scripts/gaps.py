#!/usr/bin/env python3
"""The gaps ledger, docs/adr/GAPS.md (ADR-082).

  pnpm gaps list                       open gaps and gaps moved into an ADR
  pnpm gaps add --origin O --missing M --request R --questions Q --pick P "Title"
  pnpm gaps sync                       gaps of Implemented ADRs become Done (ADR-NNN)

scripts/check-docs.py imports problems() so CI fails on a malformed or stale ledger."""
import argparse, pathlib, re, sys

REPO = pathlib.Path(__file__).resolve().parents[1]
LEDGER = REPO / "docs/adr/GAPS.md"
FIELDS = ("Status", "Origin", "Missing", "Request", "Questions", "Suggested pick")
STATUS = re.compile(r"Open|Acknowledged \(\d{4}-\d{2}-\d{2}\)|ADR-\d{3}|Done \(.+\)")
HEAD = re.compile(r"^### (G-\d{3}): (.+)$", re.M)


def parse(text):
    heads = list(HEAD.finditer(text))
    gaps = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        fields = dict(re.findall(r"^- ([A-Z][a-z]+(?: [a-z]+)?): (.*)$", text[h.end():end], re.M))
        gaps.append({"id": h.group(1), "title": h.group(2).strip(), "fields": fields})
    return gaps


def adr_statuses(repo=REPO):
    """{"012": "Implemented" | "Pending" | ...} from the ADR folders."""
    out = {}
    for folder in ("docs/adr", "docs/adr-done"):
        for f in (repo / folder).glob("ADR-[0-9][0-9][0-9]-*.md"):
            st = re.search(r"^- Status: (.+)$", f.read_text(), re.M)
            out[f.name[4:7]] = st.group(1).strip() if st else ""
    return out


def problems(text, adrs):
    errors, seen = [], set()
    for g in parse(text):
        gid, fields = g["id"], g["fields"]
        if gid in seen:
            errors.append(f"{gid} is listed twice")
        seen.add(gid)
        for key in FIELDS:
            if not fields.get(key, "").strip():
                errors.append(f"{gid}: missing '- {key}:'")
        status = fields.get("Status", "").strip()
        if status and not STATUS.fullmatch(status):
            errors.append(f"{gid}: Status must be Open, Acknowledged (YYYY-MM-DD), ADR-NNN or Done (...), is '{status}'")
        m = re.fullmatch(r"ADR-(\d{3})", status)
        if m and m.group(1) not in adrs:
            errors.append(f"{gid}: moved into unknown ADR-{m.group(1)}")
        elif m and adrs[m.group(1)] == "Implemented":
            errors.append(f"{gid}: ADR-{m.group(1)} is Implemented; mark the gap Done (pnpm gaps sync)")
    return errors


def ids(text):
    return {g["id"] for g in parse(text)}


def add(text, title, origin, missing, request, questions, pick):
    nums = [int(i[2:]) for i in ids(text)]
    gid = f"G-{max(nums, default=0) + 1:03d}"
    entry = (f"### {gid}: {title}\n\n- Status: Open\n- Origin: {origin}\n- Missing: {missing}\n"
             f"- Request: {request}\n- Questions: {questions}\n- Suggested pick: {pick}\n")
    return gid, text.rstrip("\n") + "\n\n" + entry


def sync(text, adrs):
    changed, gid, lines = [], None, text.split("\n")
    for i, line in enumerate(lines):
        h = HEAD.match(line)
        if h:
            gid = h.group(1)
        m = re.fullmatch(r"- Status: ADR-(\d{3})", line)
        if gid and m and adrs.get(m.group(1)) == "Implemented":
            lines[i] = f"- Status: Done (ADR-{m.group(1)})"
            changed.append(gid)
    return "\n".join(lines), changed


def main(argv):
    ap = argparse.ArgumentParser(prog="pnpm gaps")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    sub.add_parser("sync")
    a = sub.add_parser("add")
    a.add_argument("title")
    for key in ("origin", "missing", "request", "questions", "pick"):
        a.add_argument(f"--{key}", required=True)
    args = ap.parse_args(argv)
    text = LEDGER.read_text()
    if args.cmd == "list":
        for g in parse(text):
            st = g["fields"].get("Status", "")
            if st == "Open" or st.startswith("ADR-"):
                print(f"{g['id']}  {st:<8}  {g['title']}")
    elif args.cmd == "add":
        gid, text = add(text, args.title, args.origin, args.missing, args.request, args.questions, args.pick)
        LEDGER.write_text(text)
        print(gid)
    else:
        text, changed = sync(text, adr_statuses())
        LEDGER.write_text(text)
        print("Done: " + (", ".join(changed) if changed else "none"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
