# ADR-060: Save a project as a reusable project template (new Dexie table `projectTemplates`)

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-012, ADR-022, ADR-032, ADR-054
- Design: docs/ui-design.md (Home, Catalog → Saved on this device)
- Backlog: N57

## Context

Research feature _Reusable ensemble templates_ (rank 21, value 4.3, P1; pCon, IKEA planners). The paper: save the
ensemble as a template with item references, defaults, relative positions, connections and generated-part recipes.
Single-piece templates exist (Dexie v3 `templates`, ADR-034); built-in Mobila rooms are shipped projects. A user's
own project cannot be reused as a starting point except by duplicating it in the Library.

## Decision

- **Project → "Save as project template"** stores: name, description, the pieces (embedded design copies, as
  ADR-032 snapshots), their positions **relative to the leftmost-back piece**, quarter turns, placements, the
  run-part **recipe** (which kinds were suggested and the scribe/plinth settings, ADR-054) — not the run-part
  geometry, which is suggested again — and the room (ADR-058/0056) only if the user ticks _Include the room_.
- **Storage:** the next free Dexie version (7 today; ADR-062's `prices` table takes the version after whichever
  ships first, or both tables share one version if built in the same change) adds
  `projectTemplates: 'id, updatedAt, name'`. Earlier versions are not edited (ADR-012); unreadable rows are
  skipped, never deleted.
- **Use:** Home → **Create from a project template** list (next to _Choose a project_); the Catalog page → _Saved on this device_
  shows project templates in their own group with _Use_, _Rename_, _Delete_ (confirmation). Using one creates a new
  project with fresh ids and suggests run parts from the recipe.
- **Export/import:** a project template is exported/imported as a file like designs (`kind: 'project-template'`).

## Alternatives considered

- **Flag rows in the `projects` table** — older app versions would list templates as projects; a separate table
  keeps them apart.
- **References to library pieces instead of copies** — a deleted or edited library piece would silently change or
  break the template; copies match ADR-032.

## Scope

- In scope: save, use, rename, export, import, delete project templates.
- Out of scope: templates made from a selection of pieces.

## Consequences

- One more Dexie version; an older cached app opening the newer database follows the existing update prompt (F17).

## Done when

- [ ] Unit tests: save → use gives a project with the same pieces and relative positions and new ids; recipe re-suggests run parts; corrupt template row skipped and kept; the upgrade from the previous version keeps all tables.
- [ ] Find-it at 1440 and 375 px: project with three pieces → **Save as project template** → Home → **Create a new project** → **From a project template** → the template → new project with three pieces.
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Separate table or a flag on projects?_ — **Separate table in the next free Dexie version.**
2. _Whole project or a selection?_ — **Whole project (there is no multi-select yet).**
3. _Include the room?_ — **Optional tick box, off by default.**
4. _Copies or references of the pieces?_ — **Copies.**

## Implementation notes

`src/core/projectTemplate.ts`, Dexie **v7** `projectTemplates` (shared version with ADR-062 `prices`, built in the same change), `src/ui/ProjectTemplates.tsx`: Project → **Save as project template** (asks _Include the room_ when there is one); Home → **Create from a project template** (a list on the Home page, next to _Choose a project_); Catalog → _Saved on this device_ lists them with Rename, Export, Delete; Library import accepts a project-template file. Tests: `tests/templates-prices-shopping.test.ts` (round trip, room optional, v6 → v7 upgrade, unreadable row kept); version tests updated to 7. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60.
