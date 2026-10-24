# ADR-041: Parts known only by their cut sizes are a panel set, never an invented assembly

- Status: Implemented
- Date: 2026-10-23
- Implemented: 2026-10-23
- Decided by: user decision, see the amendment
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-008, ADR-010, ADR-022, ADR-032, ADR-038
- Backlog: N21, N31

## Context

The user wants every Mobila room imported as a project with its full furniture set, including the Pat Noi bed in the
Dormitor. The Mobila file (`MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json`) gives the bed only
as cut panels: sizes, boards and quantities, with every position marked `UNPLACED_DO_NOT_INVENT`. No product type
could hold them, and building a bed frame would invent joints and positions (ADR-010).

## Decision

- New product kind `panels` (`PanelSetParams`): a list of loose panels (name, length, width, board, quantity) and a
  note. Thickness comes from the board. No schema bump: older documents never contain it.
- `buildPanelSet` lays every part flat in one pile, largest face at the bottom, back-left corners aligned, role
  `loose`, no edge banding. A warning (`not-assembled`) always says how the parts join is not in the design.
- Panel sets go through the same model as every piece: cut list, sheets, Romanian CSV, print, 3D, projects and
  placement. Part names are printed as typed (no translation).
- Editor: name, length, width, quantity and board per panel; add and remove. A "Loose panels" catalog family
  (`loose-panels`, storage, room "other") starts one.
- Mobila: Dormitor gains Pat Noi (BD-0050…BD-0055). The kitchen splashback is left out at the user's request.

## Alternatives considered

- **A bed product with a frame generator** — needs joints, rails and heights the file does not give.
- **Parts outside the model (a free list)** — would break ADR-004: views and lists must all come from `buildModel()`.
- **The `frame` bed (ADR-038)** — generates rails, slats and boards from a mattress size; the Mobila panels would be
  replaced by parts the file does not list. **The `panel` root (ADR-036)** is one front with a purpose and handle,
  not a list of parts.

## Consequences

- The pile is not the furniture's shape; the plan shows the pile's footprint.
- A part longer than its board's stock sheet shows under Sheets as "larger than the usable sheet".

## Evidence (repository files)

- `src/core/types.ts` (`LoosePanel`, `PanelSetParams`), `src/core/panelset.ts`, `src/core/build.ts`, `src/core/design.ts` (validation, template).
- `src/core/catalog/storage.ts` (`loose-panels` family), `src/ui/Inspector.tsx` (`PanelSetEditor`), `src/store/designStore.ts` (`updatePanelSet`).
- `src/core/samples/mobila.ts`, `docs/samples/`; `tests/mobila.test.ts` (panel set and Mobila blocks).

## Compliance check

`grep -n "not-assembled" src/core/panelset.ts` finds the warning every panel set carries.

## Open questions

1. How do the bed panels join, and at what height? Needed before the bed can be built as an assembly.

## Answers (2026-10-23, from the user)

1. **Bed joints:** the Pat Noi panels join with **bed-rail brackets**. Still open: the rail height (and bracket
   model) — needed before the bed can be built as an assembly; until then it stays a panel set.

## Amendment (2026-10-23, user decision)

The user answered the open question: **"Replace bed rails with screwed on chipboards and just proceed."**

- A panel-set part may carry a **place** (`LoosePanel.place`: back-left-bottom corner and how it lies, six ways). A
  placed part is built where it sits (quantity 1); every other part still lies in the pile, now beside the assembly.
  The independent overlap check covers placed parts like any other.
- **Screwed joints** (`PanelSetParams.joints`, kind `screwed`) between placed parts go to the hardware schedule as
  `screws` lines. Screw type, length and count are not given: a warning says to choose them (ADR-010).
- Pat Noi: the side boards (BD-0050, listed as left and right) stand on edge behind the foot board (BD-0051), flush
  with its ends, screwed through it. The headboard trim (BD-0053…0055) has no known place and stays in the pile.
  Still not in the file, and said so: what carries the mattress, and the swapped-looking sizes.
- Validation: lie from the list, whole-mm corner, quantity 1 when placed; joints name two different existing parts.
- Evidence: `src/core/panelset.ts`, `src/core/samples/mobila.ts`, `src/ui/Inspector.tsx` (place, joints),
  `tests/mobila.test.ts` (Pat Noi frame positions, joints, pile; placement and joint validation; overlap caught).
