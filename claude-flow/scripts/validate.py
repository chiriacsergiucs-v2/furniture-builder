#!/usr/bin/env python3
"""Check that every ADR-, TSK- and backlog id referenced in claude-flow/, docs/, AGENTS.md and README.md exists.
Run: python3 -I claude-flow/scripts/validate.py"""
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parent
adrs = {}
for f in sorted((ROOT / "architecture/decisions").glob("ADR-*.md")):
    t = f.read_text()
    m = re.match(r"# (ADR-\d{4}): ", t)
    adrs[m.group(1)] = re.search(r"\*\*Status\*\* \| (\w+)", t).group(1)
tasks = {t["id"]: t for t in json.loads((ROOT / "tasks/tasks.json").read_text())["tasks"]}
backlog = set(re.findall(r"^\| ([FND]\d{2}) \|", (REPO / "docs/backlog.md").read_text(), re.M))
errors = []
idx = (ROOT / "architecture/decisions/README.md").read_text()
for a, st in adrs.items():
    if f"[{a}]({a}.md) " not in idx and f"[{a}]({a}.md)" not in idx: errors.append(f"ADR index missing {a}")
files = [p for p in ROOT.rglob("*") if p.suffix in (".md", ".json") and "scripts" not in p.parts]
files += [REPO / "docs/backlog.md", REPO / "AGENTS.md", REPO / "README.md"]
for p in files:
    t = p.read_text(); rel = p.relative_to(REPO)
    for ref in set(re.findall(r"\bADR-\d{4}\b", t)):
        if ref not in adrs: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\bTSK-[A-Z]\d{2}\b", t)):
        if ref not in tasks: errors.append(f"{rel}: unknown {ref}")
for t in tasks.values():
    for b in t["backlog"]:
        if b not in backlog: errors.append(f"{t['id']}: unknown backlog id {b}")
    for d in t["depends_on"]:
        if d not in tasks: errors.append(f"{t['id']}: unknown dependency {d}")
    if t["status"] == "DONE" and not t["evidence"]: errors.append(f"{t['id']}: DONE without evidence")
print(f"{len(adrs)} ADRs, {len(tasks)} tasks, {len(backlog)} backlog ids")
for e in errors: print("ERROR", e)
print("OK" if not errors else f"FAILED ({len(errors)})")
sys.exit(1 if errors else 0)
