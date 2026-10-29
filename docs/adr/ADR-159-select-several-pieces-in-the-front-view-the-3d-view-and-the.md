# ADR-159: Select several pieces in the front view, the 3D view and the piece list

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-097
- Design: docs/ui-design.md (Plan view, 3D view)
- Backlog: N161
- Acceptance: browser
- Agreed: 2026-10-29 "Front view, 3D view, Pieces list"; "Shared Select toggle (Recommended)"; "Keep plan as is"

## Context

The user, 2026-10-29: "The select is broken, wall and floor items are overlapping, correct select impossible";
"Plan, because i cant select anywhere else multiple pieces to group them, this was working"; "Add the select to 3d,
so i can click on them to multiselect".

Reproduced on the production build: on the plan a wall cabinet is drawn over the base cabinet below it. A single tap
reaches the lower piece by tapping the same spot again ([ADR-097](../adr-done/ADR-097-select-several-pieces-and-keep-them-as-groups.md)), but Shift/Ctrl-click
and **Select** only add or remove the top piece, and the selection box takes every piece it touches, both layers.
The piece list ignores **Select** (only Shift/Ctrl-click adds a row, so a phone cannot). The front view and the 3D
view select one piece only. Nothing in the git history changed this; it has worked this way since ADR-097.

Answers: a plan layer filter was picked first, then the plan stays as it is ("Keep plan as is", G-307). The
**Select** toggle is shared and goes to the front view, the 3D view and the piece list.

## Decision

- **One Select state** (`multiSelect` in the store, already used by the plan): a **Select** checkbox in the room
  front view's toolbar, in the 3D view's toolbar (project mode) and above the **Pieces** list. Turning it on or off
  anywhere changes it everywhere. The plan's own checkbox stays.
- **Front view and 3D:** with Select on, or with Shift/Ctrl/Cmd held, a tap on a piece adds the whole piece to the
  selection or takes it out (`toggleItem`, ADR-097); it never opens the piece. Without it, taps work as today
  (ADR-083, ADR-088). Seen from the front, a base cabinet and the wall cabinet above it never overlap, so each can be
  reached.
- **Pieces list:** with Select on, a tap on a row adds or removes that piece (as Shift/Ctrl-click already does).
- **Marks:** every selected piece is marked: tinted in 3D, highlighted and `aria-pressed` in the front view, as the
  plan already does.
- Grouping, Delete, Duplicate and Turn then act on the selection as ADR-097 built them. No model, document or storage
  change.

## Alternatives considered

- **Plan layer filter (All / Floor / Wall)** — picked first, then dropped by the user ("Keep plan as is"); G-307.
- **Separate 3D toggle** — one more switch to track; the user chose the shared toggle.
- **Tap again cycles in Select mode** — a second tap could no longer remove a piece; not picked.

## Scope

- In scope: the shared Select checkbox in the front view, the 3D view and the piece list; toggling whole pieces by
  tap with Select on or Shift/Ctrl/Cmd in those three; marking every selected piece in the front view and 3D;
  English and Russian text.
- Out of scope: a plan layer filter (G-307); a selection box in the front view or 3D (G-308); any change to the plan.

## Consequences

- Positive: stacked wall and floor pieces can be picked exactly, on a phone too, and grouped.
- Negative / risks: with Select on, a tap in 3D or the front view no longer opens a piece; turning Select off
  restores it.

## Done when

- [ ] With Select on in the front view, tapping a base cabinet and the wall cabinet above it selects both
      (`aria-pressed` on both), and Group groups them (browser find-it, 390 and 1440 px).
- [ ] In 3D with Select on, tapping two pieces selects both; the panel says "Selected pieces" (browser find-it).
- [ ] Shift-click in 3D and in the front view adds a piece (desktop, browser find-it).
- [ ] With Select on, tapping two rows in the Pieces list selects both (browser find-it, 390 px).
- [ ] Turning Select on in one view shows it checked in the others (browser find-it).
- [ ] Every new text has its Russian entry (`pnpm typecheck`); the feature tree lists it (ADR-158).
- [ ] No horizontal scroll at 390 px; CI checks pass.
