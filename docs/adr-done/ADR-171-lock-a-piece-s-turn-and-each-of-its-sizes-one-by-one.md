# ADR-171: Lock a piece's turn and each of its sizes one by one

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-05
- Depends on: ADR-095, ADR-122, ADR-148, ADR-166
- Design: docs/ui-design.md (section 4, Project: the selected-piece card)
- Backlog: N174
- Agreed: 2026-11-04 "Now do the high appreciation features, similar way. Stop at adrs created and defined";
  answer "Separate locks per parameter"

## Context

The research feature _Lock/pin modules and preserve manual overrides_ (rank 18, appreciation High, P1, "trust") is
_in progress_: "locks on single named parameters (rotation only, a width only); Lock size locks all three sizes
together" (G-180). Built so far: **Lock** (placement, ADR-095: nothing moves or turns the piece) and **Lock size**
(ADR-122: width, height and depth together; any change that would resize it is refused with the reason). The
research asks for `locked.position`, `locked.rotation` and `locked.parameters` on the instance, with locks outranking
soft rules so the app never keeps "correcting" an intentional choice. User (2026-11-04): separate locks per parameter.

## Decision

- **Lock turn:** `ProjectItem.turnLocked?: true` (`PROJECT_SCHEMA` 18 → 19, ADR-011; 18 is ADR-168's). A
  turn-locked piece keeps its `rotationY` and `angle`: Turn ↺ / ↻, R, Mirror (which turns), the typed angle, the
  turn handle (ADR-169) and group turns (ADR-148, `turnSelection`) refuse with "Turn locked — unlock to turn" naming
  the piece; it still moves, snaps and resizes. Lock (ADR-095) keeps covering both place and turn as today.
- **Lock width, height or depth one by one:** `ProjectItem.sizeLocks?: ('width' | 'height' | 'depth')[]` (same
  schema 19). `sizeLocked: true` (ADR-122) stays and means all three. `sizeLockBlocked` (`src/core/sizeLock.ts`)
  compares only the locked axes of the built outside size, so a width-locked piece can still change height and
  depth. Everything ADR-122 refuses for a size-locked piece is refused per axis: the editor, the size fields on the
  card (the locked field is disabled with the hint), a linked copy's change (ADR-111), Replace (ADR-098), group
  size (ADR-148: a locked axis is skipped and named), project-wide settings (ADR-124), Fill-a-wall never touches
  existing pieces. **Locks outrank variables:** a binding on a locked axis (ADR-166) is held with the diagnostic
  `binding-held` naming the lock, as `heldByBinding` reports today; the value does not move.
- **Card:** the Lock button's menu (More actions, ADR-160) lists **Lock place**, **Lock turn**, **Lock width**, **Lock
  height**, **Lock depth** and **Lock size** (all three) as toggles; the "Locked" chip names what is locked ("Locked:
  turn, width"). The plan's lock badge (ADR-095) shows for any lock. One undo step per toggle, named "Lock turn:
  Base 600" and so on.
- **Validation:** `turnLocked` only `true`; `sizeLocks` a non-empty list of distinct axes; both refused below
  schema 19. Copies (Duplicate, Mirror a selection, linked copies, templates, value sets) keep the locks as they keep
  `locked` and `sizeLocked` today.
- Research record: _Lock/pin modules and preserve manual overrides_ becomes Verified when this ships.

## Alternatives considered

- **Turn lock only** — leaves G-180 open; the user chose per-parameter locks.
- **Change `sizeLocked` to a list** — a shipped field's type would change, which older readers cannot take
  (ADR-011); a second field keeps `sizeLocked: true` readable.
- **Lock boards, construction and insides too** — the rest of G-180's question; not asked for now (G-337).

## Scope

- In scope: the two fields, schema 19, refusals per axis and for turns, the lock menu and chip, undo names,
  bindings held by a lock, tests.
- Out of scope: locks on boards, construction or insides (G-337); snap ranking that prefers locked neighbours
  (the research's "snap ranking considers user locks", G-338).

## Consequences

- Positive: a piece can keep its width while the project's heights follow a variable; the research row closes.
- Negative / risks: six lock toggles on one card; the chip must say which apply.
- Harder to change later: schema 19.

## Done when

- [x] A turn-locked piece refuses Turn, R, Mirror, the typed angle, the turn handle and a group turn, with the hint;
      it still moves and resizes (tests)
- [x] A width-locked piece refuses a width change from the editor, a linked copy, Replace, group size and project
      settings, and accepts height and depth changes (tests)
- [x] A binding on a locked axis is held and named; `sizeLocked: true` still locks all three (tests)
- [x] Projects of schemaVersion 1–18 load unchanged; 19 validates the fields (tests)
- [x] The lock menu shows the five toggles and the chip names the locks (jsdom find-it, 390 and 1280 px)
- [x] Russian entries for every new text; the feature tree line "Lock a piece in place" is extended
