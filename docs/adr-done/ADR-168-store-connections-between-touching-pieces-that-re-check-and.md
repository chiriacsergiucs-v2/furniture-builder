# ADR-168: Store connections between touching pieces that re-check and move together

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-04
- Depends on: ADR-097, ADR-100, ADR-123, ADR-165
- Design: docs/ui-design.md (section 4, Project: the selected-items card and the plan)
- Backlog: N171
- Acceptance: browser
- Agreed: 2026-11-04 "Validate all High demand features, analyze compatibility with app state/direction, create
  adrs"; answers "Record, re-check and move together", "Automatically when snapped, plus a toggle"

## Context

The research page (ADR-043, ADR-149, ADR-152) still lists four High-demand features, all _in progress_. Three of them
name the same missing part, **connections**: _Transactional undo/redo_ ("undo of snap and unsnap"), _Versioned
save/reload_ ("connections") and _Reusable ensemble templates_ ("connections, generated-component recipes"). The
research model is a connection hierarchy: an assembly graph in which a snap connects two items, rules keep the
connection valid, and connected items stay independently selectable.

Today the app snaps while dragging (ADR-070) and checks compatibility rules (ADR-100) at the moment of placing and
in project checks for pieces that happen to touch; nothing remembers that two pieces were joined (G-091). Groups
(ADR-097) are a selection aid, "not connections" (`Project.groups`). A common top or bottom (ADR-165) already records
a relation between touching items with a check (`commonPanelCheck`) and a warning when it breaks; this ADR follows
that pattern. User (2026-11-04): record connections, re-check them and move connected pieces together; made
automatically when snapped, plus a toggle.

## Decision

- **`Project.connections?: { id: string; itemIds: [string, string] }[]`** (`PROJECT_SCHEMA` 17 → 18, ADR-011).
  Validation: two different ids of this project, a pair at most once; the field in a file older than 18 is invalid.
  A removed item removes its connections (`pruneConnections`, as `pruneCommon`). Not generated geometry: the pair is
  the user's intent, so it is saved.
- **Valid** when the two pieces touch side by side (`touchSideBySide`, ADR-100) and every `refuse` rule of ADR-100
  passes for the pair. Pure `connectionCheck(project, a, b)` → `null` or the reason (same shape as
  `commonPanelCheck`).
- **Made automatically** when a snap (ADR-070 `snapDrag`, drop of a new piece, Move to a neighbour ADR-147) lands
  the moved piece touching another piece side by side and the pair is valid: the connection is added in the same
  undo step as the move ("Move Base 600" stays one step). **Toggle:** the selected-items card (exactly 2 selected)
  shows **Connected** on/off next to Common top (ADR-165); disabled with the reason when the check fails. On = one
  undo step "connect"; off = "disconnect". A piece dragged apart from its connected neighbour (no longer touching
  at drop) is disconnected in that step.
- **Move together:** dragging a connected piece on the plan, arrow keys (ADR-065), Move to (ADR-147) and 3D Move
  mode (ADR-093) carry every piece reachable through connections (the connected set, unioned with groups,
  ADR-148), as one block through `moveItems`; holding **Alt** (the free-drag key of ADR-070) moves the piece alone
  and disconnects it at drop if it no longer touches. Turning, resizing and replacing a piece do not move its
  neighbours; the check then runs.
- **Broken:** when `connectionCheck` fails later (resized, turned, replaced, moved by typing, a rule now failing)
  the warning `connection-broken` names both pieces and the reason (ADR-008; never blocks export). The record stays
  until the user disconnects or the pieces are removed; a later move that makes them touch again clears the warning.
- **Card:** the selected-piece card shows **Connected to: <names>** under Position; the plan draws a short tick on
  the shared edge of connected pieces (one SVG line per connection, no new layout).
- **Templates, versions, sets:** connections travel with the project record, so version history (ADR-123) and
  project files keep them. Value sets (ADR-167) copy the connections of set-1 pieces to each set's duplicates
  (keyed by the duplicate ids). Project templates: ADR-170.
- Research record: `ensemble-2026-10-23.app.ts` statuses of _Transactional undo/redo_, _Versioned save/reload_ and
  _Connected items stay independently selectable_ become Verified with this ADR's evidence when it ships.

## Alternatives considered

- **Record only, no check, no move** — "undo of snap" would be a list entry with no behaviour; the user chose
  re-check and move together.
- **Derive connections from touching every build** — nothing to undo, nothing to store, and two pieces placed
  touching by chance would count as joined; the research treats the connection as intent.
- **A general assembly graph with connector types and rule status per edge** (research model) — the compatibility
  rules already live in `compat.ts` as data; typed connectors are G-091's second half, kept out (G-329).

## Scope

- In scope: the record, validation, schema 18, check, warning, automatic connect on snap, the toggle, move
  together, Alt to move alone, card text, plan tick, sets copy, undo names, tests, fuzz.
- Out of scope: connector types and an assembly graph (G-329); connections in the front view and 3D selection
  highlighting beyond the plan tick (G-330); connections across floor levels or between a wall unit and a base unit
  (only side-by-side touching, G-331).

## Consequences

- Positive: three High-demand research rows close; a run of pieces moves as one without making a group.
- Negative / risks: users who place pieces touching by snap get connections they did not ask for; the toggle and
  Alt undo that. More pieces move on one drag than before (as groups do today).
- Harder to change later: schema 18; a connection record read by every later version.

## Done when

- [x] `connectionCheck` accepts touching, rule-passing pairs and names the reason otherwise (tests)
- [x] A snap that lands two valid pieces touching adds the connection in the same undo step; dragging apart removes
      it (store tests)
- [x] Dragging, arrow keys, Move to and 3D Move carry the connected set; Alt moves the piece alone (store tests;
      the 3D drop by a store test only, G-346)
- [x] `connection-broken` warns after a resize, turn, replace or typed move breaks the pair; never an error (tests)
- [x] Projects of schemaVersion 1–17 load unchanged; 18 validates the pairs; sets copy connections (tests, fuzz)
- [x] Selected-items card shows **Connected** disabled with the reason when the pair is invalid (browser find-it,
      390 and 1280 px)
- [x] Russian entries for every new text; the feature tree gains its line (ADR-158)
