# ADR-110: Trim the research page to Features and Competitors

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-043, ADR-092
- Design: n/a
- Acceptance: browser
- Backlog: N108
- Agreed: 2026-10-26 "Remove tabs and underlying dead info : Overview, Compare, Findings, Contradictions, Sources, Coverage audit, Import & export"; answers "Move them to the Features tab", "Remove all, including spec export", "Ticks and bulk actions too", "Only code that nothing uses any more"

## Context

The Feature Research & Catalog page (ADR-043) grew nine tabs. The user uses Features and Competitors and asked
(2026-10-26): "Remove tabs and underlying dead info : Overview, Compare, Findings, Contradictions, Sources,
Coverage audit, Import & export". The Overview holds the useful parts too: "Built in this app" (ADR-092) and the
assessment dashboard (demand, value, complexity, confidence, appreciation, research priority).

## Decision

- The page keeps two tabs: **Features** (default) and **Competitors**.
- "Built in this app" and the assessment dashboard move to the top of Features, above the explorer. The totals
  tiles go.
- Import & export goes entirely: paper import, the decisions file (download and upload), the research file
  download and the specification export.
- Tick boxes, the bulk decision bar and Compare go.
- Dead code goes: only code nothing uses any more (`planImport`, `mergeMarks`, `specMarkdown`, the store's
  `importBundle`/`importMarks`, the removed views and their CSS). The research data stays: feature pages show
  their evidence, citations and contradictions from it. `coverage()` and `auditChecks()` stay because the
  coverage tests use them.
- Decisions and notes stay on the device (Dexie `researchMarks`, no storage change). A newer paper edition still
  reaches the app through the shipped bundle (`seedShipped`).

## Alternatives considered

- **Keep the Overview tab with only the dashboard** — the user chose to move it to Features.
- **Keep the specification export** — the user chose "Remove all, including spec export".
- **Delete the findings and sources data too** — feature evidence and citations need it; the user chose "Only
  code that nothing uses any more".

## Scope

- In scope: the tabs, the dashboard move, removing import and export, ticks, bulk actions and Compare, unused
  code and CSS, tests and the find-it script.
- The removed features are not kept as gaps: the user said "No need to keep them as gaps" (2026-10-26).

## Consequences

- Positive: one place to read the research; less code to keep.
- Negative / risks: no backup file for research decisions; they live only in this browser's storage.
- Harder to change later: nothing; the data and the coverage checks remain.

## Done when

- [x] The page shows only Features and Competitors; Features opens with "Built in this app" and the assessment
      dashboard above the list (tests and find-it)
- [x] No tick boxes, bulk bar, Compare, import or export remain (tests and find-it)
- [x] Decisions and notes still persist across a reload (find-it)
- [x] Coverage tests still pass on the shipped bundle
- [x] Find-it test passes from the bare app at phone and desktop widths
