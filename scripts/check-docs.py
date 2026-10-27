#!/usr/bin/env python3
"""Check the ADR set and its references (ADR-050).

- every ADR in docs/adr/ (Pending or Deferred) and docs/adr-done/ (Implemented) has a valid header;
- the docs/adr/README.md index lists each ADR once, with the right link and status;
- every ADR id, ADR link and backlog id used in the repository exists;
- "- Acceptance:" is light, full or browser (ADR-066, ADR-108); a light ADR keeps the find-it marker on its backlog
  rows until they are Done (ADR-066);
- docs/adr/GAPS.md is well formed, every G id used exists, and an ADR from ADR-082 on cites a gap for each
  out-of-scope line and open question (ADR-082).

Run: npm run docs:check  (python3 -I scripts/check-docs.py)"""
import pathlib, re, subprocess, sys

REPO = pathlib.Path(__file__).resolve().parents[1]
ADR, DONE = REPO / "docs/adr", REPO / "docs/adr-done"
errors = []

adrs = {}  # "012" -> (path, status)
for folder in (ADR, DONE):
    for f in sorted(folder.glob("ADR-*.md")):
        rel = f.relative_to(REPO)
        m = re.match(r"ADR-(\d{3})-[a-z0-9-]+\.md$", f.name)
        if not m:
            errors.append(f"{rel}: file name is not ADR-NNN-short-kebab-title.md")
            continue
        num, text = m.group(1), f.read_text()
        if num in adrs:
            errors.append(f"{rel}: ADR-{num} also at {adrs[num][0].relative_to(REPO)}")
        if not text.startswith(f"# ADR-{num}: "):
            errors.append(f"{rel}: first line is not '# ADR-{num}: <title>'")
        st = re.search(r"^- Status: (.+)$", text, re.M)
        status = st.group(1).strip() if st else ""
        if folder == DONE and status != "Implemented":
            errors.append(f"{rel}: in adr-done/ but Status is '{status}'")
        if folder == ADR and not (status == "Pending" or re.fullmatch(r"Deferred \(.+\)", status)):
            errors.append(f"{rel}: Status must be Pending or Deferred (<reason>), is '{status}'")
        for key in ("Date", "Depends on", "Design"):
            if not re.search(rf"^- {key}: .+$", text, re.M):
                errors.append(f"{rel}: missing '- {key}:' line")
        adrs[num] = (f, status)

MARKER = "find-it pending (light, ADR-066)"
# "N60" -> (status, evidence)
backlog = {m.group(1): (m.group(2).strip(), m.group(3))
           for m in re.finditer(r"^\| ([FND]\d{2,}) +\|[^|\n]*\|([^|\n]*)\|?(.*)$",
                                (REPO / "docs/backlog.md").read_text(), re.M)}

# Index rows: | [ADR-NNN](link) | title | depends | status |
index = (ADR / "README.md").read_text()
rows = re.findall(r"^\| \[ADR-(\d{3})\]\(([^)]+)\)\s*\|.*\| ([^|]+) \|$", index, re.M)
seen = {}
for num, link, cell in rows:
    seen[num] = seen.get(num, 0) + 1
    if num not in adrs:
        errors.append(f"docs/adr/README.md: row for unknown ADR-{num}")
        continue
    path, status = adrs[num]
    if (ADR / link).resolve() != path.resolve():
        errors.append(f"docs/adr/README.md: ADR-{num} links {link}")
    want = "✅ Implemented" if status == "Implemented" else status
    if cell.strip() != want:
        errors.append(f"docs/adr/README.md: ADR-{num} status '{cell.strip()}', file says '{status}'")
for num in adrs:
    if seen.get(num) != 1:
        errors.append(f"docs/adr/README.md: ADR-{num} listed {seen.get(num, 0)} times")

# Header references inside each ADR.
for num, (path, status) in adrs.items():
    text, rel = path.read_text(), path.relative_to(REPO)
    deps = re.search(r"^- Depends on: (.+)$", text, re.M)
    for d in re.findall(r"ADR-(\d{3})", deps.group(1) if deps else ""):
        if d not in adrs:
            errors.append(f"{rel}: depends on unknown ADR-{d}")
    bl = re.search(r"^- Backlog: (.+)$", text, re.M)
    for b in re.findall(r"\b[FND]\d{2,}\b", bl.group(1) if bl else ""):
        if b not in backlog:
            errors.append(f"{rel}: unknown backlog id {b}")
    # Light acceptance (ADR-066): the backlog row keeps the marker until a find-it run makes it Done.
    acc = re.search(r"^- Acceptance: (.+)$", text, re.M)
    if acc and acc.group(1).strip() not in ("light", "full", "browser"):
        errors.append(f"{rel}: Acceptance must be light, full or browser, is '{acc.group(1).strip()}'")
    if acc and acc.group(1).strip() == "light":
        for b in re.findall(r"\b[FND]\d{2,}\b", bl.group(1) if bl else ""):
            if b not in backlog:
                continue
            row_status, evidence = backlog[b]
            if row_status == "Done":
                if MARKER in evidence or "find-it" not in evidence:
                    errors.append(f"{rel}: {b} is Done but has no find-it evidence from the catch-up")
            elif MARKER not in evidence:
                errors.append(f"{rel}: {b} lacks the gap '{MARKER}'")

# Every ADR id and ADR link in tracked text files.
files = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                       cwd=REPO, capture_output=True, text=True, check=True).stdout.splitlines()
for rel in files:
    p = REPO / rel
    if p.suffix not in (".md", ".ts", ".tsx", ".css", ".py", ".mjs", ".js", ".json", ".yml", ".html") or not p.is_file():
        continue
    if rel == "package-lock.json":
        continue
    text = p.read_text()
    for ref in sorted(set(re.findall(r"\bADR-(\d{3,4})\b", text))):
        if ref not in adrs:
            errors.append(f"{rel}: unknown ADR-{ref}")
    if p.suffix == ".md":
        for link in re.findall(r"\]\(([^)#\s]*ADR-\d{3}-[^)#\s]*\.md)\)", text):
            if not (p.parent / link).exists():
                errors.append(f"{rel}: broken link {link}")

# Agreement (retro 2026-10-26): from number 091 on, an ADR records whether the user agreed to it, and only an
# agreed ADR can be Implemented.
AGREED = re.compile(r'\d{4}-\d{2}-\d{2} ["\u201c].+["\u201d]')
for num, (path, status) in adrs.items():
    if int(num) < 91:
        continue
    rel = path.relative_to(REPO)
    ag = re.search(r"^- Agreed: (.+)$", path.read_text(), re.M)
    value = ag.group(1).strip() if ag else ""
    if value != "not yet" and not AGREED.fullmatch(value):
        errors.append(f"{rel}: '- Agreed:' must be 'not yet' or 'YYYY-MM-DD \"<user's words>\"', is '{value}'")
    elif status == "Implemented" and value == "not yet":
        errors.append(f"{rel}: Implemented but the user never agreed to it ('- Agreed: not yet')")

# Gaps ledger (ADR-082).
sys.path.insert(0, str(REPO / "scripts"))
import gaps  # noqa: E402

ledger = (REPO / "docs/adr/GAPS.md").read_text()
errors += [f"docs/adr/GAPS.md: {e}" for e in gaps.problems(ledger, {n: s for n, (_, s) in adrs.items()})]
gap_ids = gaps.ids(ledger)
for num, (path, _) in adrs.items():
    if int(num) < 82:
        continue
    text, rel = path.read_text(), path.relative_to(REPO)
    out = re.search(r"^- Out of scope: (.+(?:\n  .+)*)", text, re.M)
    if out and not re.search(r"\bG-\d{3}\b", out.group(1)):
        errors.append(f"{rel}: the Out of scope line cites no gap (G-NNN in docs/adr/GAPS.md)")
    oq = re.search(r"^## Open questions\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    for q in re.findall(r"^- (.+(?:\n  .+)*)", oq.group(1) if oq else "", re.M):
        if not re.search(r"\bG-\d{3}\b", q):
            errors.append(f"{rel}: open question cites no gap: {q.splitlines()[0][:60]}")
for rel in files:
    p = REPO / rel
    if p.suffix != ".md" or not p.is_file():
        continue
    for ref in sorted(set(re.findall(r"\bG-(\d{3})\b", p.read_text())) - {i[2:] for i in gap_ids}):
        errors.append(f"{rel}: unknown gap G-{ref}")

# Ids taken on main meanwhile (retro 2026-10-26): an ADR, backlog or gap id this branch added that origin/main
# now also has is a collision, to renumber before merging. Skipped when origin/main is not fetched (CI checkout).
def _ids(text, path):
    if path.endswith("GAPS.md"):
        return dict(re.findall(r"^### (G-\d{3}): (.+)$", text, re.M))
    if path.endswith("backlog.md"):
        return {i: t.strip() for i, t in re.findall(r"^\| ([FND]\d+) +\| ([^|]+)\|", text, re.M)}
    return {i: t.strip() for i, t in re.findall(r"^\| \[(ADR-\d{3})\]\([^)]*\) +\| ([^|]+)\|", text, re.M)}


def _git(*args):
    r = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


base = _git("merge-base", "HEAD", "origin/main")
if base:
    for path in ("docs/adr/GAPS.md", "docs/backlog.md", "docs/adr/README.md"):
        before, main_text = _git("show", f"{base.strip()}:{path}"), _git("show", f"origin/main:{path}")
        if before is None or main_text is None:
            continue
        here, old, main_ids = _ids((REPO / path).read_text(), path), _ids(before, path), _ids(main_text, path)
        for i in sorted(set(here) - set(old)):
            if i in main_ids and main_ids[i] != here[i]:
                errors.append(f"{path}: {i} is \"{main_ids[i][:50]}\" on origin/main but \"{here[i][:50]}\" here: "
                              "merge origin/main and renumber this branch's id")

print(f"{len(adrs)} ADRs ({sum(s == 'Implemented' for _, s in adrs.values())} implemented), {len(backlog)} backlog ids, {len(gap_ids)} gaps")
for e in errors:
    print("ERROR", e)
print("OK" if not errors else f"FAILED ({len(errors)})")
sys.exit(1 if errors else 0)
