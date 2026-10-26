# ADR-095: Lock a piece so automatic moves and repairs leave it alone

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-065, ADR-069, ADR-070, ADR-071
- Design: docs/ui-design.md (Plan view)
- Backlog: N93
- Agreed: not yet

## Context

The user, 2026-10-26: "New adr 8". Item 8 of the fit review: _Lock/pin modules and preserve manual overrides_ (rank
18, value 4.4, P1, Not Started). The paper: "Locks/manual overrides should outrank soft rules … smart behaviour
becomes frustrating when the application repeatedly 'corrects' intentional placement" (line 431); auto-fit must
"respect locked modules" (line 499). Automatic moves exist today: snapping ([ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md)), repairs that move pieces
([ADR-071](../adr-done/ADR-071-select-the-problem-and-offer-previewed-repairs-for-diagnosti.md)), the gap tool moving the pieces on the right (ADR-022), mirror the run and turn ([ADR-069](../adr-done/ADR-069-duplicate-mirror-and-turn-a-piece-about-its-centre-in-a-proj.md)), and a
piece placed on another following it (ADR-031).

## Decision

- **Lock position:** a project piece can be locked (`ProjectItem.locked: true`; project `schemaVersion` raised to
  the next free version, older versions still load — ADR-011). **Lock** / **Unlock** on the selected-piece card;
  a lock badge on the Plan, the room front view and in 3D. Locking is one undo step.
- **A locked piece does not move or turn:** dragging it (Plan, 3D, arrow keys), Turn and Mirror are refused with the
  hint "Locked — unlock to move". Its size, boards and construction stay editable (the lock is about placement).
- **Nothing moves it for the user:**
  - repairs never propose moving a locked piece (they move the other piece, or offer nothing);
  - the gap tool and "Mirror the run" refuse when they would move a locked piece, and say which one;
  - a piece placed on a locked base moves only if it is not locked itself; moving a base that carries a locked
    piece is refused with the reason.
- **Others may still snap to it:** a locked piece stays a snap target.
- Pure checks in `src/core` (`isLocked`, and each move helper returns the reason instead of moving).

## Alternatives considered

- **Lock per axis** (x only, z only) — more control than the research asks; adds UI for little use.
- **Lock as a group property** — groups are [ADR-097](ADR-097-select-several-pieces-and-keep-them-as-groups.md); a group can lock its members through this flag later.

## Scope

- In scope: lock flag, card buttons, badges, refusals in drag, turn, mirror, gap tool, repairs and placement.
- Out of scope: locking sizes and other parameters (the research's "locked parameters") (G-081).

## Consequences

- Positive: intentional placement is never "corrected".
- Negative / risks: refusals must name the locked piece, or users will not know why a tool does nothing.

## Done when

- [ ] Drag, turn, mirror, gap tool and mirror-the-run leave a locked piece where it is and return a reason (unit tests)
- [ ] Repairs never move a locked piece (unit test with an overlap against a locked piece)
- [ ] A project with a locked piece saves and reloads; older project versions still load (storage test)
- [ ] Find-it at 1440 and 390 px: select a piece → **Lock** → dragging it does not move it and "Locked" shows →
      **Unlock** → it moves; no page errors

## Open questions

1. May a locked piece be deleted? Used until answered: yes, after the usual confirmation (G-082).
