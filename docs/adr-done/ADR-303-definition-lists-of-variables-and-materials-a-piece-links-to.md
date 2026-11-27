# ADR-303: Definition lists of variables and materials a piece links to

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-124, ADR-166, ADR-170
- Design: docs/ui-design.md (Configure, selected-piece card)
- Backlog: N430

## Context

The user (2026-11-27): "I would like to be able to set the variables at the beginning of the project in a number of
definition lists, let's say it like that. So we have the definition list A, which I can apply to any piece I choose.
So I have a template, I have a room with 3 pieces. I want for each to be able to set the values using the values from
any of the subsets."

Answers (2026-11-27, interactive questions): a list holds **variables and materials**; a piece links to **one list**,
**linked** (editing the list updates every piece using it) and the piece **may override a value**; lists live **per
project** (saved in the project and its template).

The project already has variables and bindings
([ADR-166](../adr-done/ADR-166-project-variables-and-formulas-that-drive-piece-sizes.md)), value sets that duplicate
pieces ([ADR-167](../adr-done/ADR-167-value-sets-duplicate-variable-pieces-with-their-room-and-sav.md),
a different job: a whole second rendering) and project-wide settings for boards (with their banding), handle, front
overlay and plinth height ([ADR-124](../adr-done/ADR-124-research-batch-4-design-codes-keep-edits-on-replace-template.md)).
A definition list reuses both: it gives the project's variables other values and the project settings other values,
for the pieces linked to it only.

**Change control.** Project document (ADR-011): `Project.definitionLists`, `ProjectItem.list`, project
`schemaVersion` 23; 1–22 still load. Project template (ADR-060, ADR-170): `definitionLists` and the item's `list`,
template `schemaVersion` 4; 1–3 still load.

## Decision

1. **Lists.** `Project.definitionLists?: { id; name; values: Record<variableId, string>; settings?: ProjectSettings }[]`.
   Names are unique (case-insensitive), at most `MAX_VARIABLES` lists. `values` gives a project variable another
   number or formula (ADR-166 syntax); an absent or empty value keeps the project's. `settings` has the shape of
   project settings (carcass, front and back board with their edge banding, handle, front overlay, plinth height); an
   absent key keeps the project's.
2. **Link.** `ProjectItem.list?: { id; values?: Record<variableId, string> }`. Linking a piece applies the list's
   settings to it at once and evaluates its bindings with the list's values; unlinking keeps the boards and handle the
   piece has, and its bound sizes follow the project's values again (they are still bound). A piece is linked to at most one list.
3. **Precedence** (decided, the picks above): for a variable, the piece's own override › the list's value › the
   project's value; for a setting, the list's › the project's. A value-set duplicate (ADR-167) keeps its set's values
   and is not linked (duplicates exist to show set N).
4. **Overrides.** A variable: the piece stores its own value in `list.values`; **Use list value** removes it. A
   setting: as ADR-124, a piece whose own value differs no longer follows; **Follow list** puts the list's value back.
5. **Propagation.** Changing a list value re-evaluates the bindings of every linked piece without an override (one
   undo step, `applyBindings`). Changing a list setting gives the new value to every linked piece that followed the
   old one (list's, else the project's); clearing a list setting changes no piece (as ADR-124). A project setting
   change skips linked pieces whose list sets that key.
6. **Delete and rename.** Deleting a list asks when pieces use it, then unlinks them (as 2: boards stay, bound sizes
   take the project's values). Deleting a
   variable removes its values from every list and override. A rename needs nothing (values are keyed by id).
7. **Problems** (ADR-008): a list value that does not evaluate is an error diagnostic naming the list and variable; a
   linked piece's binding is checked with its own scope. Export is blocked; nothing is clamped.
8. **Where it shows.** Configure → **Definition lists** (after Variables): **Add list**, each list with its name, a
   value per project variable (empty = project's), the settings (boards from the project's boards, ADR-164), "Used by
   N pieces", **Delete list**. The selected piece in a project: a **Definition list** fold with a select (None or a
   list), each variable with its value and **Override** / **Use list value**, each setting with Follows list or own
   value and **Follow list**.

## Alternatives considered

- **Copy values once** — the user chose linked lists.
- **A source list per value** — more taps per piece; the user chose one list per piece.
- **Lists of their own variables** (not the project's) — two names for one size; bindings would need a scope per list.
- **Reuse value sets (ADR-167)** — a set duplicates pieces; a list changes pieces in place.

## Scope

- In scope: core (`defLists.ts`, validation, project schema 23, template schema 4), store actions, Configure panel,
  piece fold, diagnostics, translations, unit tests, jsdom find-it.
- Out of scope: lists outside projects (a single piece has its own variables, ADR-210); lists on run requests.

## Consequences

- Positive: three pieces in one room can take three sets of sizes and boards from lists set up once.
- Negative / risks: one more place a value can come from; the piece's fold names the source of every value.
- Harder to change later: list values are keyed by variable id; the setting keys follow ADR-124.

## Done when

- [x] Three pieces bound to `height`; list A `height = 700`, list B `height = 900`; pieces 1, 2 → A, piece 3 → B: heights
      700, 700, 900; change A to 720 → 720, 720, 900 in one undo step (`tests/definition-lists.test.ts`)
- [x] A piece override wins over its list; Use list value restores it; a bad list formula is an error diagnostic (tests)
- [x] List settings: linking applies the list's carcass board and handle; a list change reaches followers only; a project
      setting change skips pieces whose list sets it; Follow list restores (tests)
- [x] Deleting a list unlinks (boards stay, bound sizes take the project's values); deleting a variable drops its list
      values (tests)
- [x] Project schemaVersion 23 validates; a 22 file loads; an unknown list id is refused; template version 4 keeps lists
      and links and a version 3 template loads (tests)
- [x] Find-it `tests/find-it/definition-lists.test.tsx` (390 and 1280 px): Settings → **Definition lists** → **Add
      list** → value → piece → **Definition list** select → the piece follows it
- [x] Every new text has its Russian entry (`pnpm typecheck`)
