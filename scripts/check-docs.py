#!/usr/bin/env python3
"""Check the ADR set and its references (ADR-050).

- every ADR in docs/adr/ (Pending or Deferred) and docs/adr-done/ (Implemented) has a valid header;
- the docs/adr/README.md index lists each ADR once, with the right link and status;
- every ADR id, ADR link and backlog id used in the repository exists;
- an ADR with "- Acceptance: light" keeps the find-it marker on its backlog rows until they are Done (ADR-066).

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
           for m in re.finditer(r"^\| ([FND]\d{2}) \|[^|\n]*\|([^|\n]*)\|?(.*)$",
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
    for b in re.findall(r"\b[FND]\d{2}\b", bl.group(1) if bl else ""):
        if b not in backlog:
            errors.append(f"{rel}: unknown backlog id {b}")
    # Light acceptance (ADR-066): the backlog row keeps the marker until a find-it run makes it Done.
    acc = re.search(r"^- Acceptance: (.+)$", text, re.M)
    if acc and acc.group(1).strip() not in ("light", "full"):
        errors.append(f"{rel}: Acceptance must be light or full, is '{acc.group(1).strip()}'")
    if acc and acc.group(1).strip() == "light":
        for b in re.findall(r"\b[FND]\d{2}\b", bl.group(1) if bl else ""):
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

print(f"{len(adrs)} ADRs ({sum(s == 'Implemented' for _, s in adrs.values())} implemented), {len(backlog)} backlog ids")
for e in errors:
    print("ERROR", e)
print("OK" if not errors else f"FAILED ({len(errors)})")
sys.exit(1 if errors else 0)
