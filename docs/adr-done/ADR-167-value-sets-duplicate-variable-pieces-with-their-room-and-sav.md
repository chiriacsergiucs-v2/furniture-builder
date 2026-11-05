# ADR-167: Value sets duplicate variable pieces with their room and save a set as a separate project

- Status: Implemented
- Date: 2026-10-30
- Implemented: 2026-10-30
- Depends on: ADR-111, ADR-166
- Design: docs/ui-design.md (Configure, plan, 3D view)
- Backlog: N169
- Acceptance: browser
- Agreed: 2026-10-30 (every question answered in the interactive questions; the answers are quoted below)

## Context

The user (2026-10-30): "add the possibility to add a new rendering of all the items that use that variable with the
new value. So it would duplicate the existing pieces that use that variable, but with the new values. The
[separation] part should happen when all of the values of that project have been set. So I have the first set of
variables and the first set of pieces rendered. I can duplicate that within the same project with the second set of
variables and have the possibility to save that as a separate project. So once I save that as a separate project, I
will be asked whether I want to keep the renderings of the second one within the first, or I want to remove them
upon duplication." Then: "if the project has a room, the room should also be duplicated and furniture have same
position as in original."

Answers (2026-10-30): **any number** of sets; duplicates are **real pieces beside the originals**, both in the room
and in the cut list; a duplicate **follows its original one way** (critique answer: set 1 → sets; design edits
follow, only bound values and position differ; the duplicate's card says to edit the set-1 piece); a
new set starts **empty and is drawn only when complete**; with a room the set gets a **room copy beside** the first
(room width + 500 mm) and its pieces keep their **positions relative to that room**; without a room the set is
**shifted right** of set 1 by its width + 500 mm; the new project is the **whole project at set-N values, set N
becoming set 1**; afterwards the user **stays in the current project**.

**Change control.** Project document (ADR-011): `Project.variableSets`, `ProjectItem.set`, `schemaVersion` 16
(shared with ADR-166). The room (ADR-058) stays one stored room; a set's room is that room translated to the set's
origin, drawn and checked there, never stored twice. Linked copies
([ADR-111](../adr-done/ADR-111-linked-copies-of-a-piece-in-a-project.md)) carry the design
between a piece and its set duplicates.

## Decision

1. **Sets.** `Project.variableSets?: { id; name; values: Record<variableId, string>; origin: { x; z } }[]`. Set 1
   is `Project.variables` itself. **Add set** on the Variables page adds "Set 2" with every value empty and
   `origin` = `(W + 500) × (N − 1)` on x, 0 on z, where W is the room's outline width, or the x extent of the set-1
   pieces without a room; the origin is editable on the set's card (**Set origin**), which moves the whole set.
2. **Complete sets draw.** A set is complete when every variable has a value that evaluates (formulas as in
   ADR-166). The store (`syncSets`, on every commit) keeps, for each complete set, one duplicate of every member
   piece: a bound piece, every piece placed on or above one (ADR-031, through a chain) and every piece grouped with
   one (ADR-097) — the critique answer that closes G-327. `ProjectItem.set = { id, of: originalId }`; the
   duplicate's design, bindings and template reference are copied from the original on every commit (one way: an
   edit of the duplicate is overwritten; its card says "Edit the set-1 piece"), bound values evaluated with the
   set's values, position = the original's + the set origin at creation (then its own: Move mode moves it). Groups
   are mirrored per set. An incomplete set shows "2 of 4 values set" and has no duplicates; a set that becomes
   incomplete keeps its duplicates at their last values with a warning diagnostic. A piece that leaves the members
   loses its duplicates; one that joins gets them (one undo step with the change).
3. **Room per set.** With a room, each complete set draws the room (walls, doors, windows, obstacles, wall
   finishes) translated to its origin in the plan and in 3D, and the room checks (ADR-057, ADR-058) of a set's
   pieces run against that translated room. Run parts for a set's pieces come from the automatic refresh
   (ADR-061); user run requests are not copied (G-326).
4. **Save as separate project.** On a complete set's card. The new project: name `<project> — <set name>`, new ids
   (ADR-011), every piece not in a set plus the set's duplicates placed at their originals' positions (origin
   removed), `variables` with the set's values as their `expr`, no sets, the room, project settings, groups and run
   requests pruned to surviving pieces. Saved to the projects table (no Dexie change). Then the question "Keep
   _Set 2_ in this project?" with **Keep** and **Remove**; Remove deletes the set and its duplicates, one undo
   step. The user stays in the current project; the message "Saved as “…”" has **Open**.
5. **Where it shows.** Configure → **Variables** → _Value sets_: set cards (name, values, "4 of 4 values set",
   the duplicates' names with **Select them**, **Set origin**, **Save as separate project**, **Remove set**). The
   selected-piece card: "Set 2 of _Base left_ — edit the set-1 piece" with **Go to it**. The plan tags each set
   with its name. **Open** on the saved note closes Settings (critique answer). Cut list and hardware count every
   duplicate as a piece.

## Alternatives considered

- **Switch between sets (one shown at a time)** — the user chose both visible, side by side.
- **Store a room copy per set** — generated geometry in the document (ADR-011); one room translated is enough.
- **Linked copies both ways (ADR-111)** — an edit of a set-2 duplicate would change set 1 unnoticed; the user chose
  one way (critique answer 2026-10-30).

## Scope

- In scope: core (`sets.ts`, validation, migration), store actions, Variables page set cards, plan and 3D room
  per set, save as separate project with the keep/remove question, tests, fuzz, browser find-it (3D and plan).
- Out of scope: run requests, run handles and sinks per set (G-326). G-327 (pieces on or grouped with a bound
  piece) was pulled in by the critique answer of 2026-10-30.

## Consequences

- Positive: a what-if of a whole kitchen in one project; a complete set becomes its own project in one tap.
- Negative / risks: duplicates double the cut list on purpose; a project with several sets is bigger and slower to
  build (lazy 3D stays, ADR-014).
- Harder to change later: the set origin is stored; changing the room later does not move existing sets.

## Done when

- [x] Add set, fill values → one duplicate per bound piece, linked, at the right position, bound values from the set;
      an incomplete set has none (`tests/sets.test.ts`)
- [x] A design edit on an original reaches its duplicate, an edit of the duplicate is overwritten; a bound value is
      not copied; unbinding removes duplicates; a piece on a bound piece and a grouped piece duplicate too (tests)
- [x] With a room, the set's pieces are checked against the room translated to the set origin; the plan and 3D
      model list one room box per complete set (tests)
- [x] Save as separate project: new ids, pieces at the originals' positions, the set's values as set 1, room and
      settings kept, run parts pruned; Remove deletes the set in one undo step (tests)
- [x] Project `schemaVersion` 16 with sets validates; fuzz 3,000 seeded projects with sets build with no throw
- [x] Browser find-it `tools/variables/find-it.mjs` on the production build (1280 and 390 px): a base cabinet
      bound to `bottom height` in a 3000-wide room → **Add set** → value 450 → a second cabinet and a second room
      outline to the right in the plan and 3D → **Save as separate project** → **Remove** → one cabinet left; the
      new project opens from Projects with the cabinet 450 high; no horizontal scroll at 390 px

## Open questions

None (all answered 2026-10-30).
