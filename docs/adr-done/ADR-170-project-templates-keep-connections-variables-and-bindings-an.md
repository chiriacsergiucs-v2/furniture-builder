# ADR-170: Project templates keep connections, variables and bindings and take the project settings

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-04
- Depends on: ADR-060, ADR-123, ADR-124, ADR-166, ADR-168
- Design: n/a
- Backlog: N173
- Agreed: 2026-11-04 "Validate all High demand features, analyze compatibility with app state/direction, create
  adrs"; answer "Keep copies; add connections, variables, bindings, project settings"

## Context

The research feature _Reusable ensemble templates_ (High demand, P1) is _in progress_: "templates keep copies, not
item references, connections or generated-part recipes". ADR-060 chose copies on purpose (a deleted or edited
library piece would silently change or break a template); the run-part recipe is already kept (ADR-060) and
templates can be inserted into a project (ADR-123). What a template still drops: connections (ADR-168), the project
variables and the pieces' bindings (G-323; ADR-166 says "Project templates keep variables and bindings" but
`templateFromProject` does not), and pieces inserted from a template do not take the project settings as Add a
piece does (G-203). User (2026-11-04): keep copies; add connections, variables, bindings and the project settings.

## Decision

- **`ProjectTemplate.schemaVersion` 1 → 2** (`src/core/projectTemplate.ts`): adds `variables?: ProjectVariable[]`
  (ADR-166, the whole list of the project), `TemplateItem.bindings?: Binding[]` and
  `connections?: { itemIds: [string, string] }[]` over template item refs (as `runRecipe.removed` keys are).
  Version-1 templates still load (no new fields = none); a version-2 file is refused by older app versions, as
  ADR-011 allows for a new shape. Validation reuses the project validators for variables and bindings (targets and
  variable names must exist in the template) and refuses a connection over an unknown ref.
- **Save as project template** (ADR-060) and **Save a set as a separate project** are unchanged apart from writing
  the new fields; a template saved from a project without variables or connections stays version 1.
- **Create from a project template** (ADR-060) and **Insert a project template** (ADR-123) carry the fields over
  with new ids: variables are added to the project (a name that already exists in the project keeps the project's
  variable and the inserted bindings point at it; the user is told once in a notice, ADR-008 diagnostics stay the
  judge of values), bindings are remapped to the new item ids, connections to the new pair ids. One undo step as
  today.
- **Project settings (G-203):** pieces inserted or created from a template take the project's settings through the
  same `withSettings` path as Add a piece (ADR-124) — handle, overlay and plinth height — unless the piece has its
  own binding on that value; boards follow ADR-164 (the project's boards). Create from a template on the Home page
  has no project yet, so its pieces keep the template's values.
- Research record: _Reusable ensemble templates_ becomes Verified with the note "copies by choice (ADR-060), not
  item references" when this ships; _Existing-template instancing_ keeps its missing part (G-333).

## Alternatives considered

- **References to catalog items** — reverses ADR-060 and brings back the risk it named; the user chose copies.
- **Variables and bindings only** — leaves the research row in progress on connections; the user chose all four.
- **Project settings written into the template** — a template would carry one project's handle and plinth; the
  user's projects differ, so the target project's settings win, as for Add a piece.

## Scope

- In scope: template schema 2, the three fields, save and load paths, name clash notice, project settings on
  insert, validation, tests.
- Out of scope: item references (G-334, ADR-060 by choice); storing only the parameters that differ from a catalog
  item (G-333); variables in catalog designs and the stand-alone editor (G-323 remainder, G-335).

## Consequences

- Positive: a kitchen template with a worktop-height variable and connected runs comes back whole; the last
  High-demand research row closes.
- Negative / risks: a version-2 template file does not open in an app version before this ADR (ADR-011 accepts
  that for a new shape); variable name clashes on insert need the notice.
- Harder to change later: template schema 2.

## Done when

- [x] `templateFromProject` keeps variables, bindings and connections; version-1 templates still validate and load
      (tests)
- [x] Create from and Insert a template remap bindings and connections to the new ids; a clashing variable name
      keeps the project's variable and notices once (tests)
- [x] Inserted pieces take the project's handle, overlay and plinth unless bound (tests; G-203 closes)
- [x] A template saved without variables or connections stays schemaVersion 1 (tests)
- [x] Russian entries for every new text; the feature tree line "Create a project from a project template" is
      updated (jsdom find-it, 390 and 1280 px)
