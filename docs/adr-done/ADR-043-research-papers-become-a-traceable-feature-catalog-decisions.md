# ADR-043: Research papers become a traceable feature catalog; decisions are stored apart from the research

- Status: Implemented
- Date: 2026-10-23
- Implemented: 2026-10-23
- Decided by: user answers below
- Depends on: none
- Design: n/a
- Related: ADR-002, ADR-004, ADR-008, ADR-010, ADR-012, ADR-016
- Backlog: N33

## Context

The user supplied the research paper "Furniture Ensemble Builder — Deep Research & Product Strategy" (snapshot
2026-10-23) and asked for every fact, feature, sub-feature, finding and source in it to become structured, traceable
data on a new page, "Feature Research & Catalog". There they can explore, compare and select features for later work.
Future papers must be importable without losing decisions. No feature may be implemented because of this work.

## Decision

- **Source in the repository.** The paper is committed verbatim (`docs/research/2026-10-23-furniture-ensemble-builder.md`,
  sha256 in the bundle). Every record points to an inclusive line range of that file, and the app quotes excerpts
  from the text itself, so normalised wording and original evidence sit side by side.
- **Research bundle** (`src/core/research/types.ts`, format `furniture-builder-research`, schema 1). It holds the
  document (id, title, version, date, text), categories, sections, findings, citations, bibliography, competitors,
  features, contradictions and UNEXTRACTED ranges. Traceability runs document → section → finding (lines) →
  feature or supporting record. A finding may support many features and a feature many findings.
  `origin: 'inferred'` features must name the findings they are inferred from and are labelled "not a research
  conclusion". Ratings are copied word for word; `not evaluated` / `unknown` when the paper gives none. Repository
  observations (`appNotes`) and research-vs-app conflicts are kept apart from the research.
- **Decisions are separate records** (`ResearchMark`). Each holds selection (Unreviewed / Interested / Shortlisted /
  Approved / Deferred / Rejected), implementation (Not Started / Planned / In Progress / Implemented / Verified),
  the user's priority, notes, finding reviewed, merge target and user links. Keyed by record id; written only by the
  user's actions, never by an import. Selection and implementation are independent.
- **Storage:** Dexie v4 adds `researchDocs` (one row per paper edition, key `<doc id>@<version>`) and `researchMarks`.
  Earlier tables are untouched; unreadable rows are skipped and kept (ADR-012). Shipped papers are seeded on first
  use. A shipped edition whose content changed replaces its stored copy, because research records are not
  user-editable.
- **Import and re-import** (`planImport`) are shown to the user before anything is stored:
  - The same edition with the same content is "unchanged".
  - The same edition with different content is refused ("raise the version").
  - A newer edition is stored beside the old one and becomes the one in use. Features it drops stay, marked retired.
  - A feature id shared with another paper gains that paper's evidence; the first paper keeps the fields.
  - Same name with a different id is reported as a possible duplicate. The user merges it on the feature page;
    a merge hides the feature from the list and shows its evidence on the target, deleting nothing.
  - Finding or section ids that belong to another paper are refused.
- **Coverage audit** (`coverage`, `auditChecks`). Every content line of the paper must be held by a finding,
  competitor, source, citation or heading record (or an UNEXTRACTED entry with a reason), section by section.
  A second pass checks citations, URLs, ranked rows, recommendations, requirements, requests and complaints,
  competitors, inferred features and evidence. An independent reviewer also read the paper against the records;
  their findings were fixed (14 extra findings, two new contradiction records, corrected details).
- **Page** (`src/ui/Research.tsx`). It has a third top-bar tab, "Feature Research", and the `#research` link. It
  holds Overview, Features (search, filters, sort, group by category / parent / research priority / decision, tick
  rows or groups, bulk decision), feature detail, Compare, Findings, Competitors, Contradictions, Sources, Coverage
  audit and Import & export. Exports: a Markdown specification of ticked or shortlisted + approved features, the
  decisions file and the research file (also the import format). The top bar now wraps onto a second row when three
  page tabs and the actions do not fit.

## Alternatives considered

- **Hard-coded cards in the page** — would lose traceability and could not be re-imported. **Decisions stored inside
  the research records** — a re-import would overwrite them. **Automatic ingestion of free text or PDF** — needs
  remote AI (ADR-002) or an unreliable local parser. A structured import format is used instead; turning a new
  paper into it is a separate step.

## Consequences

- About 0.3 MB of research data and source text in the main bundle; the page works offline.
- Importing a new paper needs a research file in this format. Reading PDFs or prose automatically is not supported.
- Line-level traceability needs the document text in the bundle. Without it, coverage shows "Text not stored".

## Evidence (repository files)

- `docs/research/2026-10-23-furniture-ensemble-builder.md`, `src/core/research/*`, `src/persist/db.ts` (v4),
  `src/store/researchStore.ts`, `src/ui/Research.tsx`, `src/ui/App.tsx` (tab, `#research`), `src/styles.css`.
- `tests/research.test.ts` (24 tests), `tools/research/find-it.mjs` (browser acceptance, not part of `npm test`).

## Compliance check

`npx vitest run tests/research.test.ts` passes only when every line of the paper is accounted for, every ranked row,
recommendation, MVP row, competitor, footnote and source has its record with the paper's own wording, and
re-imports leave decisions unchanged.

## Open questions

1. Should approving a feature create a backlog entry automatically? Default: no — implementation is a separate,
   explicitly approved step.
2. Tab label "Feature Research" (page title "Feature Research & Catalog"). Is a shorter label wanted on phones?

## Answers (2026-10-23, from the user)

1. **No** automatic backlog entry on approval (default confirmed).
2. **Keep the tab label "Feature Research"** on every width (default confirmed).
The decision is built as recorded (backlog N33), so the ADR is Accepted.

## Addendum 2026-10-23 — assessment of unrated features (backlog N37)

The user: "without the assessment of demand, value, complexity and confidence, it is not research". The paper rates
only its 39 ranked features. The other 118 now carry an `assessment`
(`src/core/research/ensemble-2026-10-23.assessment.ts`):

- **Method:** the paper's own (line 71). Six 1–5 scores — core ensemble relevance 30 %, demand 20 %, UX 20 %,
  competitor adoption 15 %, differentiation 10 %, downstream leverage 5 %. **Value** is their weighted sum,
  computed, never typed.
- **Demand:** from the demand score; "Indirect" for internal plumbing, as the paper does.
- **Complexity and confidence:** on the paper's scales. Confidence rates how strongly the paper's evidence
  supports the scores. Complexity is for the product the paper describes, not this repository.
- **Rationale:** one per feature, from the linked findings.
- **Precedence:** the paper's ratings always win; ranked features carry no assessment. Every assessed value is
  marked "A" / "(assessed)" with its scores and rationale, and labelled "Assessment, not research".
- **Dashboard:** the Overview opens with the assessment — a value × complexity matrix, demand / value /
  complexity / confidence distributions, highest value, quick wins (value ≥ 4.0, complexity Medium or lower)
  and high value with weak evidence. The explorer filters and sorts by every rating and by source.
- `validateAssessment` rejects scores off 1–5, words off the scales, or a missing rationale or author.

## Addendum 2026-10-24 — research priority of assessed features (backlog N39)

The user asked for a research priority on the 118 assessed features. Each `assessment` now carries `priority`
(P0 foundational, P1 next stage, P2 advanced/professional, P3 experimental/later, as in the paper, line 71) and
`priorityBasis`. Bases, in order of preference:

1. the MVP table (P0);
2. the roadmap phase the paper places it in (phase 1 → P0, 2 → P1, 3 → P2, 4 → P3);
3. the nearest parent's priority;
4. a judgement with its reason.

Count: MVP 24, phase 22, parent 35, judgement 37. Internal features get the paper's "internal" suffix. Mechanical
inheritance alone was rejected: it gave P0 to items with no evidence, such as the chair-clearance envelope and
support diagnostics.

The effective priority (paper first, assessment marked "A") drives the chip, filter, grouping, sort, detail page,
Compare and the specification export. The dashboard adds a priority distribution. `validateAssessment` requires a
P0–P3 value and a basis. Tests check that every MVP-, phase- or parent-based priority agrees with what it cites.

## Addendum 2026-10-24 — appreciation of assessed features (backlog N40)

Each `assessment` also carries `appreciation` and `appreciationBasis`. Appreciation is the paper's column for
evidence that users value a capability, as opposed to asking for it. Bases, in this order:

1. internal plumbing reads "Indirect", as the paper rates its internal rows;
2. a praise finding in the paper (lines 40–47, 65);
3. the nearest parent's own paper rating, quoted with its rank;
4. a judgement with its reason.

Requests and complaints are demand, not appreciation; with nothing else, a feature reads "Unproven" (the paper's
word, rank 38). Parent ratings are not copied to children with no evidence of their own (chair and service
clearance envelopes, support diagnostics, automated fixes, saved design codes, layout optimisation).

Result for the 118: High 55, High professional 3, High when invisible 1, Indirect 28, Medium-high 2, Medium 5,
Mixed 2, Unproven 22. The dashboard adds an Appreciation distribution; the explorer filters by it; the detail
page, Compare and the specification export show it with "A" / "(assessed)" and its basis.
