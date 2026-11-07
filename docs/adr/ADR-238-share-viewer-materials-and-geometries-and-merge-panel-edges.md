# ADR-238: Share viewer materials and geometries and merge panel edges

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-230
- Design: n/a
- Backlog: N243
- Acceptance: browser

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-20** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Verified by the review: `Panels` in `src/viewer/Viewer3D.tsx` creates one `<boxGeometry>`, one
`<meshStandardMaterial>` and one drei `<Edges>` per panel, so 40 panels make ≈ 80 geometries and ≈ 80 materials; the
saving is reasoned, not profiled. ADR-014 (lazy preview, mounts only when visible) is unchanged; this is the 3D view,
so acceptance is the browser script. Depends on
[ADR-230](ADR-230-keep-the-3d-viewer-free-of-ui-imports-and-dom-side-channels.md), which settles the viewer's imports
first.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- Materials are shared per key `(color, map, faded, side, role)` from a `useMemo` map, disposed when no panel uses
  them.
- One `BoxGeometry` per `(w, h, d)` (scaled by the mesh, or one per size in the existing `geoCache`).
- One merged `EdgesGeometry` per model drawn as a single `LineSegments`, rebuilt and disposed on model change,
  instead of a drei `<Edges>` per panel.
- Selection, hover, faded and seam looks stay as today (selection uses its own material).

## Alternatives considered

- **`InstancedMesh`** — fewer draw calls, but per-instance materials and selection need custom shaders.
- **Profile first, change later** — kept as G-502; the object counts are certain, the frame-time gain is not.
- **Leave it** — fine for a cabinet, heavy for a 20-piece room on a phone.

## Scope

- In scope: shared materials and geometries, merged edges, an instance-count test.
- Out of scope: a browser frame-time profile before and after (G-502).

## Consequences

- Positive: ≈ 80 + 80 objects → ≈ 10 + 10 on 40 panels (estimate); less GPU memory on phones.
- Negative / risks: a shared material mutated for one panel changes all (selection must keep its own).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) browser find-it `tools/move-3d/find-it.mjs` and `tools/drill-select/find-it.mjs` pass on the
      production build at 390 and 1280 px before; the same after. Evidence (run 2026-11-07, `vite preview`): move-3d
      32/32 before and after; drill-select 25/26 before and after (the one failure, "390px project: a tap on the
      selected piece …", is outside the 3D view and fails before the change too); assembly 30, connections 65,
      connections-typed 44 unchanged. 3D screenshots at 390 and 1280 px (Simple, Realistic, selected piece, selected
      space) match apart from a few anti-aliased edge pixels where coplanar edges overlap.
- [x] (test first) a count test (React Three test renderer or a pure helper over the panel list): distinct materials
      ≤ distinct keys and geometries ≤ distinct sizes for a 40-panel model. (`tests/viewer-resources.test.ts`, "a
      40-panel model: materials ≤ distinct looks, geometries ≤ distinct sizes"; one merged line for the 40 panels'
      480 edges in "one line per edge style for the whole model".)
- [x] Selecting one panel highlights only that panel (browser script assertion). (`tools/drill-select/find-it.mjs`,
      "3D: selecting one space highlights only its panels": selection-colour pixels 4872 / 4291 / 5990 for bay, space
      and whole piece, the same counts before and after the change.)
- [x] Changing the model disposes the old merged edges (a dispose spy in the count test). (`tests/viewer-resources.test.ts`,
      "one line per edge style for the whole model; a new model disposes the old lines".)
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Locally: lint, format:check,
      typecheck, build, docs:check and `vitest related` over the changed files (64 files, 265 tests); the full suite
      runs in CI. No test was removed.
