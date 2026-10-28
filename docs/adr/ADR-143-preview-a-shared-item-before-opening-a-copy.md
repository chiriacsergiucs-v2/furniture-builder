# ADR-143: Preview a shared item before opening a copy

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-138
- Design: docs/ui-design.md (Dialog, front view drawing)
- Backlog: N144
- Acceptance: light
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. ADR-138 shows only a name before **Open a copy**. A viewer who is not sure what
they received would rather see it first, without adding it to their library.

## Decision

- Opening a share link shows a preview built from the shared body with `buildModel()` (ADR-004): name, kind, outer
  size, the front view drawing and the part count; then **Open a copy** or **Cancel**.
- Nothing is saved until **Open a copy**; an invalid body shows its diagnostics instead of a drawing (ADR-008).

## Alternatives considered

- **Name only** (ADR-138 as written) — less to build, less to trust.
- **A separate public web page per link** — needs server rendering; GitHub Pages is static.

## Scope

- In scope: the preview dialog, both layouts, tests.
- Covered elsewhere: link rules (ADR-132).

## Consequences

- Positive: the viewer decides with the drawing in front of them.
- Negative / risks: large designs take a moment to build on a phone.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [ ] Preview from a fake link shows name, size, front view and part count; nothing is stored (jsdom test).
- [ ] Browser find-it on the production build at 390 and 1280 px: preview, "Open a copy", no horizontal scroll (light — catch-up).

## Open questions

- Name, front view and part count; plus 3D; or plus the full cut list? Suggested: the first (G-264).
