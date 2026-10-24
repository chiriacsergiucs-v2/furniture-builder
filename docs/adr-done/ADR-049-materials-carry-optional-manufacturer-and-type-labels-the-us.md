# ADR-049: Materials carry optional manufacturer and type labels; the user's own decor list enables a decor choice

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: recorded as a to-do at the user's request, "Delete r3, add a to-do adr with it"; answered the same day, see below
- Depends on: none
- Design: n/a
- Related: ADR-010, ADR-012, ADR-035, ADR-048
- Backlog: N44

## Context

The user first asked for materials from **Egger, Kastamonu, Fundermax and Kronospan**, in the types **PAL, MDF and
kitchen worktops**, with the furniture drawn in each material's colour and structure. The work was narrowed to
pictures on materials (ADR-048), and the labels were kept here as a to-do. The user then answered the open
questions and asked for them to be built.

## Decision

- **Labels.** `Material.maker` and `Material.kind` are both optional.
  - Manufacturer: Egger, Kastamonu, Fundermax, Kronospan or Other.
  - Type: PAL, MDF, Kitchen worktop or Other.
  - They are set in the Materials dialog (**Manufacturer**, **Type**) and are **shown only**: next to the board
    name in every board choice ("PAL 18 white · Egger, PAL"). Nothing is filtered and no specs are filled in from
    them.
- **Worktop boards.** A board labelled Kitchen worktop may be used for any part. When it is used for parts that are
  not worktops, `buildModel()` adds one guidance warning (`worktop-board`), never an error (ADR-035 style).
- **Decor list (user-provided).** The app ships no supplier decors (ADR-010).
  - Materials → **Import decor list (CSV)** reads the user's own file. It needs a header row with the columns
    manufacturer, type, code, name, thickness (whole mm) and color (#rrggbb). Columns may be separated by commas
    or semicolons, and English or Romanian headers both work.
  - Each row with a problem is skipped and listed. Rows are never repaired or guessed.
  - The list is stored in the new Dexie **version 6** table `decors`; a new import replaces it. **Remove decor
    list** clears it.
  - Only while a list is stored does each board show **Decor from your list**. Choosing a decor sets exactly the
    list's values: name ("maker code name"), thickness, colour, labels, and `decor: { code, list }` for tracing.
    A picture (ADR-048) stays.
- Parsing and validation are in `src/core/materials.ts` and are pure.

## Alternatives considered

- **Free-text labels:** rejected by the user in favour of a fixed list plus Other.
- **Filtering board choices by label:** not wanted ("show only").
- **Worktop boards only on worktop parts:** rejected. They are allowed anywhere, with a warning.
- **Built-in supplier decors:** never. Decors come only from the user's list.

## Consequences

- Labels and decor links travel in design and project files. Older builds ignore them.
- Changing a board's thickness through a decor rebuilds its parts, the same as typing a thickness.
- The decor list stays on this device. It is not inside exported design files; only the boards made from it are.

## Evidence (repository files)

- `src/core/materials.ts` (`MAKERS`, `KINDS`, `materialLabel`, `parseDecorList`, `decorPatch`).
- `src/core/types.ts` (`MaterialMaker`, `MaterialKind`), `src/core/design.ts` (validation), `src/core/build.ts`
  (`worktop-board`).
- `src/persist/db.ts` (v6 `decors`, `replaceDecors`), `src/ui/Dialogs.tsx` (Materials dialog),
  `src/ui/Editors.tsx` and `src/ui/Inspector.tsx` (labelled board choices).
- `tests/materials.test.ts`.
- `tools/materials/find-it.mjs` (find-it acceptance).

## Compliance check

`npx vitest run tests/materials.test.ts` checks the following:
- labels are validated and change no part;
- a worktop board on other parts gives a warning;
- comma and semicolon CSV, Romanian headers, quotes and a BOM are read;
- bad rows are listed and the file is never thrown on;
- a decor sets only the list's values;
- a new list replaces the old one.

`grep -rn "decors" src/core` shows no built-in decor data.

## Answers (2026-10-24, from the user)

1. How are labels entered? **A fixed list plus Other.**
2. Do labels filter board choices? **Show only.**
3. Where may a kitchen-worktop board be used? **Anywhere, with a warning otherwise.**
4. Should the app ship supplier decors? **"Both, when I will provide the list, the decor selector will become
   available"**: pictures stay, and a decor choice appears once the user has imported their list.
