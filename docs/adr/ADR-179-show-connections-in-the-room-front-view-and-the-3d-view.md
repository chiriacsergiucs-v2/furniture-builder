# ADR-179: Show connections in the room front view and the 3D view

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-168
- Design: docs/ui-design.md (section 4, project plan and front view)
- Backlog: N182
- Acceptance: browser
- Agreed: 2026-11-05 "Fix, then sort by priority to implement, start 5 adrs"; answer "Front view + 3D"

## Context

Gap G-330 (ADR-168): connections show on the plan only, as a tick across the shared seam (`ConnectionTicks`,
`src/ui/Project.tsx:690`, which works out the seam in UI code), and on the piece card. The room front view and the
3D view do not show them.

User, 2026-11-05: **"Front view + 3D"** — a matching tick in the room front view and a thin line in the 3D view.

## Decision

1. `connectionSeams(project, pieces)` in `src/core/connections.ts` returns, for every connection that still holds
   (`connectionCheck` without a reason), the shared seam as a segment in room coordinates: x/z of the seam on the
   plan and its bottom and top y. The plan's ticks use it, so seam geometry leaves UI code (ADR-004).
2. Room front view: a short tick across the seam at mid height of the shorter piece, in the plan tick's colour,
   `aria-hidden` like the plan's.
3. 3D view: a thin vertical line along the seam at the front face, drawn by the lazy viewer only; it never edits
   (ADR-014). Hidden while exploded.
4. A broken connection shows nothing, as on the plan.

## Alternatives considered

- **Front view only** — less work, but 3D stays without them. Not chosen.

## Scope

- In scope: seams in core; front-view ticks; 3D lines.
- Out of scope: stacked and cross-level connections (G-331).

## Consequences

- Positive: connections are visible in every view.
- Negative / risks: one more overlay in 3D; kept thin and off when exploded.

## Done when

- [ ] `connectionSeams` gives one segment per holding connection and none for a broken one; the plan's ticks are
      unchanged (tests)
- [ ] Room front view of two connected pieces shows one tick at the seam (jsdom)
- [ ] Browser find-it (`tools/connections/find-it.mjs`, production build, 390 and 1440 px): front view tick, 3D
      seam line present, gone after Disconnect, no page errors
