---
name: architect-review
description: Audit the whole repository for architecture drift — layer boundaries (core, store, persist, ui, viewer, online), the model/storage/network rules, and agreement between docs/architecture.md, implemented ADRs and the code — and report findings by severity. Read-only unless asked to fix. Use when the user says "architect review", "architecture review", "architecture audit", "check for drift", "does the code still match the architecture", or before a large refactor or release. Do not use when checking one change against its ADR (use review), a screen against its design (use design-review) or security and privacy (use security-review).
---

# Architect review

Project: **Furniture Builder** — offline PWA, no backend in the offline core. This is a
**whole-repo** audit: it compares what the code does with what the architecture says it does.
Default mode is **read-only**: report, do not edit. Authority order when sources disagree: explicit
user decision › implemented ADR › code and tests › earlier discussion › proposal (CLAUDE.md).

## Workflow

1. **Load the intent.** Read `docs/architecture.md`, `CLAUDE.md` (Engineering conventions),
   `docs/adr/README.md`, and the implemented ADRs the checks below cite (`docs/adr-done/`).
   Note the proposed-not-built parts (the "Domains" section of `docs/architecture.md`); they are
   not drift.
2. **Run the mechanical checks first** and record the exit codes:
   `pnpm typecheck`, `pnpm docs:check`, `pnpm exec vitest run tests/core-boundary.test.ts tests/network-boundary.test.ts`.
   A red check is a finding, not something to fix inside this review. Evidence copied from a
   document is labelled "reported", not "executed".
3. **Check each boundary against the code** (`grep` the imports; cite `file:line`):
   - **Layers** (ADR-013, ADR-219): `src/core` imports nothing from React, three or Dexie; the
     dependency direction is `ui`/`viewer` → `store` → `core`, `persist` → `core`; `src/online`
     is imported only dynamically. `eslint.config.js` and `tests/core-boundary.test.ts` encode
     the same rules: report any place where the two differ from each other or from the docs.
   - **Single source of geometry** (ADR-004): every view and list is a projection of
     `buildModel()`; no geometry computed in `src/ui` or `src/viewer`.
   - **Checks independent of generators** (ADR-008): `build.ts` checks do not reuse generator
     results; user input never throws and is never clamped silently.
   - **Model and document** (ADR-011): `src/core/types.ts` and the design document changes are
     covered by an ADR; `schemaVersion` bumped with old readers kept; designs validated before
     load or import; generated geometry never persisted.
   - **Storage** (ADR-012): no shipped Dexie version edited; nothing deletes or rewrites rows
     the app cannot read.
   - **Viewer** (ADR-014): lazy, mounts only when visible, selects only; each edit path from the
     viewer is on the exception list in `CLAUDE.md`.
   - **Network** (ADR-002, ADR-126, ADR-239): no request in the offline core; online code only
     in `src/online`, only to `onlineOrigins()`; no telemetry, analytics, CDN or remote fonts;
     the assistant reaches a model only through `supabase/functions/assistant`.
   - **State** : Zustand selectors return stable references; the store holds design, selection and
     history, not derived geometry.
   - **Product families** (ADR-007): new families reuse `buildCabinet` where a carcass exists.
   - **Units** (ADR-003): integer millimetres, x width, y height from floor, z depth from back.
   - **i18n** (ADR-153, ADR-157): text goes through `t()`, `tr()` or `pt()`; no bare strings added
     in `src/ui`.
4. **Check the documents against the code.** Each claim in `docs/architecture.md` (files named,
   boundaries, store and online descriptions) must still be true: a file it names that no longer
   exists, or a module the code has that it never mentions, is drift. Do the same for the layout
   and commands sections of `CLAUDE.md`, and for implemented ADRs whose rule the code no longer
   follows (a changed decision needs a new ADR that links the old one; implemented ADRs are not
   edited).
5. **Structure health** (observations, not blockers): import cycles, modules with more than one
   reason to change, files far larger than their neighbours, duplicated helpers across layers,
   dead exports. Cite counts or `file:line`; do not propose refactors the repo has ruled out
   (ADR-015, ADR-016) unless the finding is a boundary violation.
6. **Skip what tools already enforce** (ESLint style, formatting).
7. **Report**, short and specific, with `file:line` references:
   - **Verdict:** aligned / drift found.
   - **Blocking** — a hard-rule or boundary violation, each with the rule (ADR id), the evidence
     and a suggested fix.
   - **Drift** — documents and code disagree: say which to change, using the authority order.
   - **Observations** — structure health, non-blocking.
   - **Boundary table:** rule → evidence (command output or `file:line`) → holds / violated /
     not checked (with the reason).

## Rules

- Separate facts (what the code does) from opinions, and label each.
- A claim about behaviour comes from a tool result in this session, or carries the word
  "unverified". If the repo does not show something, write "not found in the repo".
- Do not edit files unless the user asks you to apply fixes. Record unbuilt findings with
  `pnpm gaps add` when the user asks for them to be tracked (ADR-082).
- If intent is unclear (a rule and the code disagree and no ADR settles it), ask instead of
  assuming the code is wrong.
- A report written for others is in full prose; the `[long]` marker lets it pass the reply-length
  hook.
