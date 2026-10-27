# ADR-113: Apply one control height and never wrap button labels

- Status: Pending
- Date: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (section 2, tokens; section 3, buttons)
- Backlog: N112
- Acceptance: browser
- Agreed: 2026-10-27 "App-wide rule (Recommended)"

## Context

The user, 2026-10-27: "Review the design to find a better solution for buttons size and multi-line wrapping
(undesired)." Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). Desktop uses seven control heights (28–47 px); `--touch: 40px` is unused and contradicts the 44 px
rule (N82); labels wrap: "Build & Preview", "Merge with Base cabinet, 1 door on the right", the fifth result tab, lone
full-width Lock and Print buttons, ragged Arrange rows. Asked, the user chose "App-wide rule (Recommended)".

## Decision

- Tokens: `--control-h` 38 px with a mouse and 44 px under `pointer: coarse`; `--control-h-sm` 30 px (44 under
  touch) only in toolbars and tables. Buttons, fields, segmented controls, steppers and tabs use them. `--touch` goes.
- Button labels never wrap: `white-space: nowrap`, `text-overflow: ellipsis`, full text in `title` when cut.
- Button rows are a 2-column equal grid; a single action fills its row. Icon buttons are square with `aria-label`.
- Shorter labels: "Merge with right piece" / "Merge with left piece" (the piece's name as a sub-line), "Suggest run
  parts", result tab "Shopping". `.modes .segmented` gets 2 columns for its 2 buttons.

## Alternatives considered

- **Spot fixes only** — not chosen.

## Scope

- In scope: tokens, button/field/segmented/tab CSS, the label changes above, the browser find-it script.

## Consequences

- Positive: one rhythm; nothing wraps.
- Negative / risks: long labels end in an ellipsis on a phone; the full text stays in `title` and the accessible name.
- Harder to change later: nothing.

## Done when

- [ ] At 390 (touch) and 1280 px no button, tab or segmented label in the editor, Build & Preview, Projects, Catalog
      or Settings is taller than one line (find-it measures each against its line height).
- [ ] Every control is 38 px tall with a mouse (30 in toolbars and tables) and at least 44 × 44 px with touch.
- [ ] "Build & Preview", "Merge with right piece", "Suggest run parts" and the five result tabs each fit one row at 390.
- [ ] Find-it passes from the bare app at phone and desktop widths (`tools/control-rule/find-it.mjs`, production build).
