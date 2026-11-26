# ADR-297: Move the desktop mode switch into the top bar

- Status: Implemented
- Date: 2026-11-26
- Implemented: 2026-11-26 (build tested in CI run 45826881521)
- Depends on: ADR-079
- Design: docs/ui-design.md (§4 Screens: editor)
- Backlog: N397

## Context

The user, 2026-11-06 (G-452, from ADR-211): "Help with the sticky bars top and bottom, they occupy too much".
[ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md) says: "The Editor gets
three modes, set by a segmented control under the app bar (ADR-078)." On desktop that control is still its own row
under the app bar (`div.modes` in `src/ui/App.tsx`), one more band above the drawing. On a phone the row is already
hidden (ADR-241); the Editor and Cut list places replace it.

This ADR replaces only that ADR-079 sentence, and only for desktop widths. The rest of ADR-079 (the modes, what each
shows, `fb:mode` remembered per device) stands. Implemented ADRs are not edited.

## Decision

Decided by Claude from the gap's suggested pick (user approval 2026-11-23: "build every Low-work gap with its
recorded Suggested pick").

1. At desktop widths (above the app's phone breakpoint, 760 px) the Editor mode switch (the `Editor mode` radio
   group: Compose, Cut List, with the checks badge) is rendered inside the top app bar (`header.bar`), after the
   piece path and before the estimate chip and tools. There is no separate row under the bar.
2. Phones are unchanged: the `modes` row stays in the markup and stays hidden by ADR-241's rule.
3. The switch is the same component and state (`mode`, `setMode`, roving arrow keys). Focus ring stays visible; options
   are 44 px tall under `pointer: coarse` (the `--control-h` token); the bar does not scroll the page sideways at 390 px.
4. The sticky offsets that read `--modes-h` become 0 on desktop, since no row exists.

## Alternatives considered

- **Keep the row, make it thinner** - still a band of its own; does not answer "occupy too much".
- **Fold the modes into the Places nav** - mixes navigation between places with a mode inside one place.
- **Move the switch into the drawing's own toolbar** - the toolbar changes with the view; the mode must stay put.

## Scope

- In scope: the desktop placement of the mode switch; a jsdom find-it test; the ADR-079 sentence replaced here.
- Out of scope: the phone layout (ADR-241, ADR-295); the Configure mode.

## Consequences

- Positive: one less sticky row on desktop; more room for the drawing.
- Negative / risks: the bar is busier between 761 and 1180 px; the path may truncate sooner.
- Harder to change later: nothing; the control is the same component, only its parent changes.

## Done when

- [x] At 1280 px the `Editor mode` radios (Compose, Cut List) are inside the banner landmark (find-it, jsdom).
- [x] At 390 px the radios are not inside the banner and the Places row is unchanged (find-it, jsdom).
- [x] Choosing Cut List from the bar switches the mode (`aria-checked`) with arrow keys too (find-it, jsdom).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm docs:check` pass.
