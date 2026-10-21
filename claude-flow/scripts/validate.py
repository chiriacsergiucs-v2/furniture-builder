#!/usr/bin/env python3
"""Validate the claude-flow folder and (with --sync) regenerate its derived files.

Checks: every ADR-/FR-/NFR-/MOD-/FEAT-/TSK-/B-/STEP_ reference resolves; task dependencies exist; ADR index
matches files; delivery mirrors equal the repo ledgers; manifest matches the file list.
--sync writes: delivery/backlog.json, delivery/milestones.md, requirements/traceability.json,
validation/*.md, manifest.json.  Exit 1 on any failure (never on --sync alone).
Run from anywhere:  python3 -I claude-flow/scripts/validate.py [--sync]
"""
import json, re, sys, pathlib, subprocess, datetime
ROOT = pathlib.Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SYNC = "--sync" in sys.argv
errors, warnings = [], []
rd = lambda p: (ROOT / p).read_text()

# ---------- inventory ----------
adr_files = sorted((ROOT / "architecture/decisions").glob("ADR-*.md"))
adrs = {}
for f in adr_files:
    m = re.match(r"# (ADR-\d{4}): (.+)", f.read_text().splitlines()[0])
    st = re.search(r"\*\*Status\*\* \| (\w+)", f.read_text()).group(1)
    adrs[m.group(1)] = {"title": m.group(2), "status": st, "file": f.name}
req = {}
for fn in ("requirements/functional.md", "requirements/non-functional.md"):
    for m in re.finditer(r"^\| ((?:N?FR)-\d{3}) \| (.+?) \| `(.+?)`(?: \(.+?\))? \| (.+?) \|$", rd(fn), re.M):
        req[m.group(1)] = {"title": m.group(2), "evidence": m.group(3), "adrs": re.findall(r"ADR-\d{4}", m.group(4))}
mods = set(re.findall(r"\| (MOD-\d{3}) \|", rd("architecture/modules.md")))
feats = set(re.findall(r"\| (FEAT-\d{3}) \|", rd("product/features.md")))
tasks = json.loads(rd("tasks/tasks.json"))["tasks"]
tids = {t["id"] for t in tasks}

# ---------- repo ledgers ----------
progress = json.loads((REPO / "docs/progress.json").read_text())
steps = {m["id"]: m for m in progress["milestones"]}
ledger_rows = []
for line in (REPO / "docs/modular-engine-backlog.md").read_text().splitlines():
    m = re.match(r"\| (B\d{2}) \| (\d+) \| (.+?) \| (Done|Partially done|Not done|Dropped) \| (.+) \|$", line)
    if m:
        ledger_rows.append({"id": m.group(1), "order": int(m.group(2)), "initiative": m.group(3), "status": m.group(4), "evidence": m.group(5).strip()})
bids = {r["id"] for r in ledger_rows}
if not ledger_rows: errors.append("No B-ledger rows parsed from docs/modular-engine-backlog.md")

# ---------- reference resolution across all markdown/json here ----------
scan = [p for p in ROOT.rglob("*") if p.suffix in (".md", ".json") and "scripts" not in p.parts and p.name != "manifest.json"]
for p in scan:
    txt = p.read_text()
    rel = p.relative_to(ROOT)
    for ref in set(re.findall(r"\bADR-\d{4}\b", txt)):
        if ref not in adrs: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\b(?:FR|NFR)-\d{3}\b", txt)):
        if ref not in req: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\bMOD-\d{3}\b", txt)):
        if ref not in mods: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\bFEAT-\d{3}\b", txt)):
        if ref not in feats: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\bTSK-\d{3}\b", txt)):
        if ref not in tids: errors.append(f"{rel}: unknown {ref}")
    for ref in set(re.findall(r"\bB\d{2}\b", txt)):
        if ref not in bids and ref != "B00": errors.append(f"{rel}: unknown ledger id {ref}")
    for ref in set(re.findall(r"\bSTEP_\d{2}\b", txt)):
        if ref not in steps: errors.append(f"{rel}: unknown {ref}")

# ---------- structural checks ----------
idx = rd("architecture/decisions/README.md")
for a, info in adrs.items():
    if f"[{a}]({info['file']})" not in idx: errors.append(f"ADR index missing {a}")
    if f"| {info['status']} |" not in idx.split(f"[{a}]")[1].split("\n")[0]: errors.append(f"ADR index status for {a} != file ({info['status']})")
    body = rd(f"architecture/decisions/{info['file']}")
    for sec in ("## Context", "## Decision", "## Alternatives considered", "## Consequences", "## Evidence", "## Compliance check"):
        if sec not in body: errors.append(f"{a}: missing section {sec}")
    for path in re.findall(r"^- `([^`]+?)`", body.split("## Evidence")[1].split("## Compliance")[0], re.M):
        path = path.split(" ")[0].split("§")[0].rstrip(":")
        if "*" in path or path.startswith(("http", "<")): continue
        if not (REPO / path).exists(): warnings.append(f"{a}: evidence path not found: {path}")
for r, info in req.items():
    for path in re.split(r",\s*", info["evidence"]):
        path = path.split(" ")[0]
        if not (REPO / path).exists(): warnings.append(f"{r}: evidence path not found: {path}")
for t in tasks:
    for d in t["depends_on"]:
        if d not in tids: errors.append(f"{t['id']}: unknown dependency {d}")
    if t["status"] == "DONE" and not t["evidence"]: errors.append(f"{t['id']}: DONE without evidence")
    for a in t["governing_adrs"]:
        if adrs.get(a, {}).get("status") == "Proposed" and t["status"].startswith("READY"):
            warnings.append(f"{t['id']}: READY but governed by Proposed {a}")
for a, info in adrs.items():
    if info["status"] == "Proposed":
        for g in json.loads(rd("memory/decision-guardrails.json"))["hard_guards"]:
            if g["adr"] == a: warnings.append(f"{a} is Proposed but listed as a hard guard")

# ---------- template count vs docs (ADR-0020 compliance) ----------
tpl = (REPO / "src/furniture/templates.ts").read_text()
ready, planned = tpl.count("status:'ready'"), tpl.count("status:'planned'")
b24 = next((r for r in ledger_rows if r["id"] == "B24"), None)
if b24 and str(ready) not in b24["evidence"]:
    warnings.append(f"B24 ledger evidence does not mention current ready count {ready} (planned {planned}) — TSK-012")

# ---------- generated outputs ----------
def gen_backlog():
    return {"schema_version": 2, "generated_from": "docs/modular-engine-backlog.md", "generated_at": "2026-10-21",
            "note": "GENERATED mirror; edit the repo ledger, then run scripts/validate.py --sync",
            "template_counts_in_code": {"ready": ready, "planned": planned}, "rows": ledger_rows}
def gen_milestones():
    lines = ["# Milestones (GENERATED from docs/progress.json)", "", f"Current step: `{progress['currentStep']}` · status `{progress['status']}` · next action: {progress['nextAction']}", "",
             "| STEP | Title | Status | Notes |", "|---|---|---|---|"]
    lines += [f"| {m['id']} | {m['title']} | `{m['status']}` | {m.get('notes','')} |" for m in progress["milestones"]]
    lines += ["", "## Gates", "", "| Gate | Value |", "|---|---|"] + [f"| {k} | `{v}` |" for k, v in progress["gates"].items()]
    lines += ["", f"Last evidence recorded in progress.json: {progress.get('lastEvidence','')}", "", "All CI/Pages run IDs here are **reported** by the repo docs, not re-executed by this folder (ADR-0029)."]
    return "\n".join(lines) + "\n"
def gen_trace():
    tests = sorted(str(p.relative_to(REPO)) for p in list((REPO / "src/tests").rglob("*.ts")) + list((REPO / "tests").glob("*.mjs")))
    return {"schema_version": 2, "generated_at": "2026-10-21",
            "adrs": [{"id": a, "title": i["title"], "status": i["status"], "requirements": sorted(r for r, q in req.items() if a in q["adrs"]),
                      "tasks": sorted(t["id"] for t in tasks if a in t["governing_adrs"])} for a, i in sorted(adrs.items())],
            "requirements": [{"id": r, "title": q["title"], "adrs": q["adrs"], "evidence": q["evidence"],
                              "tasks": sorted(t["id"] for t in tasks if r in t["requirement_ids"])} for r, q in sorted(req.items())],
            "tasks": [{"id": t["id"], "status": t["status"], "adrs": t["governing_adrs"], "requirements": t["requirement_ids"], "depends_on": t["depends_on"]} for t in tasks],
            "ledger": {"B": {r["id"]: r["status"] for r in ledger_rows}, "STEP": {k: v["status"] for k, v in steps.items()}},
            "tests_in_repo": tests}
def gen_validation():
    s = f"# Validation report (GENERATED {datetime.date.today().isoformat()})\n\n"
    s += f"- ADRs: {len(adrs)} ({sum(1 for a in adrs.values() if a['status']=='Accepted')} Accepted, {sum(1 for a in adrs.values() if a['status']=='Proposed')} Proposed)\n"
    s += f"- Requirements: {sum(1 for r in req if r.startswith('FR'))} FR, {sum(1 for r in req if r.startswith('NFR'))} NFR; modules {len(mods)}; features {len(feats)}; tasks {len(tasks)}\n"
    s += f"- Ledger rows mirrored: {len(ledger_rows)} B-IDs, {len(steps)} STEPs\n- Templates in code: {ready} ready, {planned} planned\n"
    s += f"- Errors: {len(errors)}\n- Warnings: {len(warnings)}\n\n"
    if errors: s += "## Errors\n" + "".join(f"- {e}\n" for e in errors) + "\n"
    if warnings: s += "## Warnings (open items, not failures)\n" + "".join(f"- {w}\n" for w in warnings) + "\n"
    s += "## Not verified by this script\nTests were not executed; CI/Pages results are reported from docs (ADR-0029). Physical, Fusion and Android checks are external (evidence/unknowns.md).\n"
    return s
def gen_manifest():
    files = sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and not p.name.startswith("_"))
    head = subprocess.run(["git", "-C", str(REPO), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    return {"package": "mobila-claude-flow", "snapshot_date": "2026-10-21", "repository": "chiriacsergiucs-v2/furniture-builder", "repo_commit": head,
            "sources": "repository only (evidence/source-index.json)", "runtime": {"name": None, "version": None, "status": "VERSION_UNVERIFIED", "adr": "ADR-0030"},
            "counts": {"adrs": len(adrs), "requirements": len(req), "modules": len(mods), "features": len(feats), "tasks": len(tasks), "agents": len(list((ROOT/'agents').glob('*.md'))), "ledger_rows": len(ledger_rows)},
            "generated_files": ["delivery/backlog.json", "delivery/milestones.md", "requirements/traceability.json", "validation/report.md", "manifest.json"],
            "files": files, "file_count": len(files)}

if SYNC:
    (ROOT / "delivery").mkdir(exist_ok=True); (ROOT / "validation").mkdir(exist_ok=True)
    (ROOT / "delivery/backlog.json").write_text(json.dumps(gen_backlog(), indent=2, ensure_ascii=False) + "\n")
    (ROOT / "delivery/milestones.md").write_text(gen_milestones())
    (ROOT / "requirements/traceability.json").write_text(json.dumps(gen_trace(), indent=2) + "\n")
    (ROOT / "validation/report.md").write_text(gen_validation())
    (ROOT / "manifest.json").write_text(json.dumps(gen_manifest(), indent=2) + "\n")
else:
    # drift checks on existing mirrors
    try:
        if json.loads(rd("delivery/backlog.json"))["rows"] != ledger_rows: errors.append("delivery/backlog.json drifted from repo ledger — run --sync")
        if rd("delivery/milestones.md") != gen_milestones(): errors.append("delivery/milestones.md drifted — run --sync")
        if json.loads(rd("manifest.json"))["files"] != gen_manifest()["files"]: errors.append("manifest.json file list drifted — run --sync")
    except FileNotFoundError as e:
        errors.append(f"missing generated file: {e.filename} — run --sync")

print(f"ADRs {len(adrs)} | reqs {len(req)} | tasks {len(tasks)} | ledger {len(ledger_rows)} B / {len(steps)} STEP | templates ready {ready} planned {planned}")
for w in warnings: print("WARN", w)
for e in errors: print("ERROR", e)
print("OK" if not errors else f"FAILED ({len(errors)} errors)")
sys.exit(1 if errors else 0)
