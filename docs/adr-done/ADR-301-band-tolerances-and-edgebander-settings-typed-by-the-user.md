# ADR-301: Band tolerances and edgebander settings typed by the user

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-077, ADR-212
- Design: docs/ui-design.md
- Backlog: N428

## Context

G-460 (`docs/adr/GAPS.md`, remainder of G-038): the band spec (ADR-077) names type, thickness, width, code and a
trim allowance, but no tolerances (thickness or width deviation, overhang left to trim) and no edgebander settings.
The user asked to "Check the European standards for ABS, apply them accordingly"; the decision on G-460 (user
2026-11-27, suggested pick accepted) is "Add them only as fields you fill, labelled guidance, nothing shipped
(ADR-010)". No standard value is shipped: the app does not hold the standard's figures, and ADR-010 forbids inventing
them. The band spec lives in the design document (`Material.band`, `frontBand`, `roleBands`, `partBands`), so the
fields change `src/core/types.ts` and the document shape (ADR-011).

## Decision

- `EdgeBand` gains four optional fields (design schemaVersion 14, after ADR-300 took 13): `thicknessTolerance`, `widthTolerance` (± deviation)
  and `overhang` (left to trim per side), each in tenths of a mm from 0.1 to 10 mm as the band thickness is; and
  `edgebander`, the user's own settings as text up to 200 characters. Absent = not given. Nothing fills them in.
- Validation (`bandProblems`) checks each field when present; a design below schemaVersion 14 that carries one is
  refused ("Band tolerances and edgebander settings need schemaVersion 14"). Versions 1 to 13 still load and upgrade
  unchanged. The band's grouping key, cut sizes and metres to buy do not change.
- The board's edge band editor (Settings → Boards, sheets and saw cut, `BoardBand`) shows the four fields under
  "Tolerances and edgebander (guidance)", with a hint that they come from the user's datasheet and the app neither
  fills nor checks them. A pick from the band list keeps them, as it keeps the trim allowance (ADR-212).
- The printed cut sheet adds them to the board's caption only when one is filled, labelled "(orientativ)", in the
  print language (`pt()`, Romanian, Russian, English).
- Decided by Claude: projects keep their project schemaVersion; their boards and run parts accept the same optional
  fields through `bandProblems` (older readers ignore unknown band fields). No Dexie change: designs are stored whole.

## Alternatives considered

- **Ship EN/ABS standard values** — refused by ADR-010; the repo holds no such figures.
- **Store them on the imported band list (Dexie `bands` rows)** — a new import replaces the list, and the band spec
  the cut sheet prints lives on the board, so the values would not reach the sheet or survive an import.
- **Structured edgebander fields (glue temperature, feed speed, pressure)** — each needs units and ranges the app
  would have to choose; free text keeps it the user's words.

## Scope

- In scope: the four fields, validation and version gate, the editor fields, the printed caption, translations.
- Out of scope: checking a part against the tolerances, the parts CSV and the shopping list (not asked).

## Consequences

- Positive: the shop's band datasheet values travel with the design and print on the cut sheet.
- Negative / risks: values are not checked against anything; they are guidance only.
- Harder to change later: the field names are in saved files (schemaVersion 14).

## Done when

- [x] A new design's bands carry none of the fields (empty by default) (tests/edge-band-guide.test.ts)
- [x] The fields validate (range, text length) and need schemaVersion 14; versions 1–13 still load (tests)
- [x] A band with the fields saves to the device and a file and reloads equal (tests)
- [x] The printed caption names them only when filled, in Romanian, Russian and English (tests)
- [x] Settings → Boards, sheets and saw cut → Edge band shows "Thickness tolerance ± (mm)", "Width tolerance ± (mm)",
      "Overhang to trim per side (mm)" and "Edgebander settings", empty; typed values are kept (find-it, jsdom)
