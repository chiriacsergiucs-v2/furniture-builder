# ADR-270: Enter a container to edit inside it; stronger focus on the rest

- Status: Pending
- Date: 2026-11-16
- Depends on: ADR-267, ADR-269
- Design: docs/ui-design.md (section 4, editor screen; 3D view)
- Backlog: N284
- Acceptance: browser

## Context

User, 2026-11-15: "drawer too dynamic in real life working, keeps changing since we select inner containers on click,
and hard to keep track what and where." The research (report `wf-19a02fae-9db1-8ebd-843b-31f3c76542e5`) ranked two
last ideas: an enter-container editing context (SketchUp component edit, Figma, PolyBoard Cabinet mode) and a
stronger focus on the selection (SketchUp "Fade rest of model" and "Hide rest"). This is the last of four ADRs the
user asked for (267, 268, 269, 270).

Inside a divided space every tap still cycles through the whole piece, so the drawer jumps between far-apart
spaces. NN/g warns that a mode needs a clearly shown active state, so this ADR shows one. A double tap was rejected
for phones in [ADR-083](../adr-done/ADR-083-select-from-the-whole-piece-inwards-one-level-per-tap.md) (it zooms), so
entering is an explicit button, with a double click as a mouse shortcut. Fade today is fixed: panels outside the
selection draw at 28 % in 3D and 30 % in the drawing ([ADR-087](../adr-done/ADR-087-make-the-selected-space-obvious-in-3d-and-in-the-drawing.md)).

No change to `src/core/types.ts`, the design document or the Dexie schema (ADR-011, ADR-012).

## Decision

1. **Entered context.** `useUi.enteredId` (memory only). A divided space shows a button
   `t('Edit inside this space')` in the drawer head; a double click with a mouse on a divided space does the same.
   While entered, `drillIn(model, x, y, current, enteredId)` (new, `src/core/selectPath.ts`) selects only inside the
   entered space: taps cycle its children, then return to the entered space itself, never to the whole piece; a tap
   outside its box changes nothing.
2. **Shown state.** The drawer head carries a `role="status"` line `t('Editing inside: {name}')` with a button
   `t('Exit')`. Esc exits first (selection stays), then goes up a level as before (ADR-203). The context also ends
   when the space no longer exists, another piece opens, or the whole piece is picked in the ADR-268 tree.
3. **Focus strength.** `useUi.focusLook`: `fade` (default), `strong` or `hide`. A button in the drawer head
   (`t('Focus: {mode}')`, cycling) sets it. `FOCUS_OPACITY = { fade: 0.28, strong: 0.1, hide: 0 }` in
   `selectPath.ts` replaces the fixed 28 % in `Viewer3D.tsx` and 30 % in `Elevation.tsx`. Under `hide` the faded
   panels are not drawn and 3D still shows them in the exploded view as today. With a space entered the faded rest is
   everything outside the entered space.
4. 3D opacity is not visible in a headless run, so the proof is the mapping test plus the same constant feeding the
   materials (decided by Claude, user can override).
5. Texts have Russian entries in `src/core/i18n/ru/inspector.ts` (ADR-153).

## Alternatives considered

- **Always scope taps to the last divided space** — an invisible mode, the exact confusion this ADR avoids.
- **Hide the rest as the default** — SketchUp users report needing the rest for reference; fade stays the default.
- **Persist the focus setting** — a stored setting is a Dexie change; not asked.

## Scope

- In scope: entered context and its status line, `drillIn` with tests, focus strength in the drawing and 3D,
  browser find-it script.
- Out of scope: entering a space inside a project piece's neighbours, a stored focus setting, per-space focus.

## Consequences

- Positive: the user can stay inside one bay while dividing and filling it; the active mode is on screen.
- Negative / risks: a mode can be forgotten; the status line, Exit and Esc are the guard. `hide` removes context.
- Harder to change later: Esc now has three jobs in order (exit context, up a level, clear).

## Done when

- [ ] `drillIn` cycles the children of the entered space, returns to the entered space, ignores taps outside it
      (unit tests).
- [ ] `Edit inside this space` and a double click enter; `Editing inside: …` shows with Exit; Esc exits first, then
      goes up (browser find-it).
- [ ] The context ends when its space is deleted or another piece opens (store test).
- [ ] `FOCUS_OPACITY` feeds both views; `hide` removes the faded panels in the drawing (browser find-it and unit
      test of the mapping; the 3D materials get the same value, checked in code, not drawn headlessly).
- [ ] Every new text has a Russian entry (`pnpm typecheck`); `pnpm docs:check` passes.
