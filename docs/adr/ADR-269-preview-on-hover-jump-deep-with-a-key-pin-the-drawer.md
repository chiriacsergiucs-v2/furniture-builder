# ADR-269: Preview on hover, jump deep with a key, pin the drawer

- Status: Pending
- Date: 2026-11-16
- Depends on: ADR-267, ADR-268
- Design: docs/ui-design.md (section 4, editor screen)
- Backlog: N283

## Context

User, 2026-11-15: "drawer too dynamic in real life working, keeps changing since we select inner containers on click,
and hard to keep track what and where." The research (report `wf-19a02fae-9db1-8ebd-843b-31f3c76542e5`) ranked four
gesture ideas: hover previews and only a click changes the drawer (Onshape), a modifier click to the deepest item
(Figma, PRO100), a pin that locks the drawer to one item (Blender), and a click on empty canvas that never clears the
drawer (PolyBoard). This is the third of four ADRs the user asked for (267, 268, 269, 270).

Today a tap outside the piece clears the selection and the drawer becomes the start card: `drill` returns `undefined`
outside the piece bounds ([ADR-083](../adr-done/ADR-083-select-from-the-whole-piece-inwards-one-level-per-tap.md)).
This ADR replaces that one rule; Esc at the whole piece still clears (ADR-203). Enter already goes one level in
(ADR-083) and Esc one level up (ADR-203); they stay.

No change to `src/core/types.ts`, the design document or the Dexie schema (ADR-011, ADR-012).

## Decision

1. **Hover previews, click commits.** `useUi.hoverId` (memory only). With a fine pointer that can hover
   (`(hover: hover) and (pointer: fine)`), moving over the drawing sets `hoverId` to the space the next tap would
   select (`drill(model, x, y, selectedId)`); a row of the ADR-268 tree sets it too. The drawing shows a dashed
   outline round that space and a chip with its ADR-267 name. Hover never changes the selection or the drawer, and
   clears on leave. Touch has no hover, so phones are unchanged.
2. **Jump deep.** Ctrl-click or Cmd-click on the drawing selects the innermost space at the point (`pathAt` last);
   Shift+Enter on a focused space selects its parent as Esc does. An info tip `t('About selecting')` in the drawer
   head says: tap goes one level in, Ctrl or Cmd-tap jumps to the innermost space, Shift+Enter or Esc goes up. The 3D
   view keeps its one-level taps (out of scope).
3. **Pin.** A button in the drawer head (`aria-pressed`, name `t('Pin the drawer')`) sets `useUi.pinnedId` to the
   space shown. While pinned the compose drawer shows that space whatever the selection is; the head reads
   `t('Pinned: {name}')` and the pinned space keeps a dashed outline in a distinct colour on the drawing. It unpins
   by itself when its space no longer exists or another piece opens. Memory only.
4. **Empty click keeps the selection.** A tap on the drawing outside the piece bounds no longer clears the
   selection (store `tapPiece`); everything else about `drill` is as in ADR-083.
5. Texts have Russian entries in `src/core/i18n/ru/inspector.ts` (ADR-153).

## Alternatives considered

- **Hover changes the drawer** — the opposite of the goal; touch has no hover, so it would differ per device.
- **Preview-then-commit selection (single tap previews, double tap keeps)** — a second hidden state, as VS Code's
  italic preview tab shows.
- **Pin by default for project pieces** — unrequested; pin stays an explicit choice.

## Scope

- In scope: hover state and outline, Ctrl/Cmd-click, Shift+Enter, pin, the empty-tap rule, `selectPath.ts` additions
  with tests, find-it test.
- Out of scope: hover and modifier click in 3D (a WebGL browser test is needed, cost S, would reuse the pure
  functions), a pin for several spaces, touch long-press deep select.

## Consequences

- Positive: users can look around without changing the drawer, jump to a deep space in one click and lock a space
  while they work elsewhere.
- Negative / risks: a pinned drawer can edit a space the user is no longer looking at; the head and the outline say
  so. Modifier keys are hard to discover; the info tip is the answer.
- Harder to change later: tapping outside no longer deselects, so people who used that to clear must press Esc.

## Done when

- [ ] `deepestAt(model, x, y)` returns the innermost space at a point and nothing outside the piece (unit test).
- [ ] Hover over a space outlines the space a tap would select and does not change the drawer (find-it).
- [ ] Ctrl-click and Cmd-click select the innermost space; Shift+Enter selects the parent (find-it).
- [ ] Pinned, selecting another space leaves the drawer on the pinned one; deleting that space unpins (test).
- [ ] A tap outside the piece keeps the selection; Esc at the whole piece clears it (store test).
- [ ] Every new text has a Russian entry (`pnpm typecheck`); `pnpm docs:check` passes.
