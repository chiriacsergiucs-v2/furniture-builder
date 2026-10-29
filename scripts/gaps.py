#!/usr/bin/env python3
"""The gaps ledger, docs/adr/GAPS.md (ADR-082, ADR-151).

Each gap is a `### Name` heading, then `- Id: <uuid>` (the key), `- Number: G-NNN HH:MM` (cited as G-NNN; the time
is UTC when it was added) and the fields below. Its title is "G-NNN HH:MM Name".

  pnpm gaps list                       open gaps and gaps moved into an ADR
  pnpm gaps add --origin O --missing M --request R --questions Q --pick P "Title"
  pnpm gaps sync                       gaps of Implemented ADRs become Done (ADR-NNN)

scripts/check-docs.py imports problems() so CI fails on a malformed or stale ledger."""
import argparse, datetime, pathlib, re, sys, uuid

REPO = pathlib.Path(__file__).resolve().parents[1]
LEDGER = REPO / "docs/adr/GAPS.md"
FIELDS = ("Id", "Number", "Status", "Origin", "Missing", "Request", "Questions", "Suggested pick")
STATUS = re.compile(r"Open|Acknowledged \(\d{4}-\d{2}-\d{2}\)|ADR-\d{3}|Done \(.+\)")
HEAD = re.compile(r"^### (.+)$", re.M)
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
NUMBER = re.compile(r"(G-\d{3}) (\d{2}:\d{2})")


def parse(text):
    heads = list(HEAD.finditer(text))
    gaps = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        fields = dict(re.findall(r"^- ([A-Z][a-z]+(?: [a-z]+)?): (.*)$", text[h.end():end], re.M))
        name = h.group(1).strip()
        title = f"{fields.get('Number', '').strip()} {name}".strip()
        num = NUMBER.fullmatch(fields.get("Number", "").strip())
        gaps.append({"id": fields.get("Id", "").strip(), "number": num.group(1) if num else "", "name": name,
                     "title": title, "fields": fields})
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
        gid, fields = g["title"], g["fields"]
        if g["id"] in seen:
            errors.append(f"{gid}: Id {g['id']} is listed twice")
        seen.add(g["id"])
        for key in FIELDS:
            if not fields.get(key, "").strip():
                errors.append(f"{gid}: missing '- {key}:'")
        if fields.get("Id", "").strip() and not UUID.fullmatch(g["id"]):
            errors.append(f"{gid}: Id must be a lowercase UUID, is '{g['id']}'")
        if fields.get("Number", "").strip() and not g["number"]:
            errors.append(f"{gid}: Number must be 'G-NNN HH:MM', is '{fields['Number'].strip()}'")
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


def numbers(text):
    """The G-NNN numbers that ADRs, the backlog and replies cite. Two branches may add the same number."""
    return {g["number"] for g in parse(text) if g["number"]}


def add(text, name, origin, missing, request, questions, pick, now=None):
    nums = [int(n[2:]) for n in numbers(text)]
    hhmm = (now or datetime.datetime.now(datetime.timezone.utc)).strftime("%H:%M")
    number = f"G-{max(nums, default=0) + 1:03d} {hhmm}"
    entry = (f"### {name}\n\n- Id: {uuid.uuid4()}\n- Number: {number}\n- Status: Open\n- Origin: {origin}\n"
             f"- Missing: {missing}\n- Request: {request}\n- Questions: {questions}\n- Suggested pick: {pick}\n")
    return f"{number} {name}", text.rstrip("\n") + "\n\n" + entry


def sync(text, adrs):
    changed, gid, name, lines = [], None, None, text.split("\n")
    for i, line in enumerate(lines):
        h = HEAD.match(line)
        if h:
            name, gid = h.group(1).strip(), None
        n = re.fullmatch(r"- Number: (.+)", line)
        if n and name:
            gid = f"{n.group(1).strip()} {name}"
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
                print(f"{st:<8}  {g['title']}")
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
