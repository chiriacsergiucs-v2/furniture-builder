---
name: security-review
description: Review a change or an area of the codebase for security and privacy problems in this static offline PWA — untrusted files (designs, projects, pictures, CSV), injection into the page or into exported files, network requests, the service worker, dependencies, secrets and the user's data on the device — and report findings by severity. Read-only unless asked to fix. Use when the user says "security review", "is this secure", "review for vulnerabilities", or before shipping anything that imports files, renders user text, adds a dependency or touches the network boundary.
---

# Security review

Project: **Furniture Builder** — a static offline PWA on GitHub Pages. There is no backend, no
accounts and no server-side data (ADR-002): everything the user makes stays in this browser
(IndexedDB) or in files they export. The attack surface is therefore **files and text that come
from someone else**, **what the app puts into the page and into exported files**, and **what the
app loads or sends over the network**. This review is engineering guidance, not legal advice.

## Workflow

1. **Scope it.** A diff (`git diff origin/main...HEAD`), a feature or the whole repo. State what is
   in and out of scope.
2. **Map the trust boundaries:** files a user opens (design and project JSON from another person,
   pictures, decor CSV), shipped catalog entries (ADR-052 feed output), the bundle and its
   dependencies, the service worker, and what leaves the device (downloads, print).
3. **Go through the checklist** for what is in scope:
   - **Untrusted files:** every imported design or project passes `validateDesign` before it
     reaches the store or storage (ADR-011); it gets a new id; sizes and counts are bounded so a
     crafted file cannot hang the tab (huge numbers, deep space trees, thousands of pieces); a
     file that fails is refused with a message, never half-loaded. Pictures: type checked (PNG,
     JPEG, WebP only — no SVG, which can carry script), size capped, re-encoded through a
     canvas before storage (`src/persist/images.ts`). CSV: parsed as data, never evaluated.
   - **Injection into the page:** no `dangerouslySetInnerHTML`, `innerHTML` with user or file
     text, `eval` or `new Function`. Names and labels from files render as text. Generated SVG
     (`snapshotSvg`, the front view) escapes every text node and attribute that can contain a
     user's name.
   - **Injection into exported files:** the parts CSV must neutralise cells starting with `=`,
     `+`, `-` or `@` (spreadsheet formula injection) for names that come from the user; the
     Fusion 360 Python script must quote every user string so a piece name cannot end the
     string and run code inside Fusion; exported JSON is `JSON.stringify`, never hand-built.
   - **Network boundary (ADR-002):** no `fetch`, XHR, WebSocket, beacon, remote font, CDN,
     analytics or error reporter; `dist/` has no third-party origin
     (`grep -rEo "https?://[^\"' )]+" dist | sort -u` lists only the app's own origin and
     standard namespaces); links to manufacturers' sites open only on the user's click.
   - **Service worker and updates:** precache list limited to the app's own files; the update
     prompt never runs code from outside the bundle; scope stays `/furniture-builder/`.
   - **Storage and privacy:** nothing leaves the device unless the user downloads it; never
     delete or overwrite rows the app cannot read (ADR-012); exported files carry only what
     the user made (pictures are embedded only when they choose to export, ADR-048).
   - **Dependencies:** `pnpm audit --omit=dev`; new packages justified, maintained, licence
     known, no telemetry, not typosquats; lockfile committed.
   - **Secrets:** none needed at runtime. `git ls-files | grep -iE "\.env|key|secret|token"`
     shows nothing sensitive; the workflow files use no secrets beyond GitHub's own token.
   - **Supply chain of the catalog feed (ADR-029, ADR-052):** entries arrive only through a
     reviewed PR; `tools/` is not imported by `src/`; no PDFs or page images are committed.
4. **Verify findings with evidence** where safe: a failing Vitest test with a crafted file or
   name, or a local run of the production build. Never test against other people's data.
5. **Report by severity**, each finding with: where (`file:line`), what is wrong, how it could be
   exploited in plain terms, and a concrete fix.
   - **Critical / High:** script runs from an opened file or name, data sent off the device,
     saved designs lost or overwritten by a crafted file, code execution through an export.
   - **Medium:** a crafted file hangs or crashes the tab, formula injection in the CSV.
   - **Low / hardening:** missing Content-Security-Policy meta tag, defense in depth.
     Finish with what you checked, what you did not, and what needs the user's decision.

## Rules

- Read-only: do not change code unless the user asks you to apply fixes.
- Distinguish confirmed issues from suspicions, and say which is which.
- A control that does not exist yet is a finding for the plan: report it and suggest an ADR
  (`new-adr`).

## Repo-specific notes

- `src/main.tsx` builds the update bar with `innerHTML` from a constant string; flag it only if
  anything variable is ever added to it.
- Imports: design/project files in `src/ui/shell/importFile.ts` (⋯ More › Files) and `src/ui/Catalog.tsx`;
  pictures in `src/persist/images.ts`; decor CSV in `src/ui/Dialogs.tsx`.
- Exports: `cutlistCsvRo` (`src/core/ro.ts`), `exportFusionPython` (`src/core/fusion.ts`), SVG in
  `src/ui/shell/files.ts`, project and design files with pictures (`withPictures`).
