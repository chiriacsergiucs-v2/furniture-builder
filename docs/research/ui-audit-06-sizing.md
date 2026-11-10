# UI audit 06 — Sizing: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Sizing (`src/ui/info/features.ts:441-485`, 7 feature lines)
- ADR: [ADR-253](../adr/ADR-253-ui-audit-sizing-typed-size-kept-locks-named.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with a
  scratch config; jsdom for `PieceSize` and `MmField`, the store and core for group sizing). No repo source was
  changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The size fields are `PieceSize`
(`src/ui/PieceSize.tsx:12-71`) over `MmField` (`src/ui/controls.tsx:14-108`); the group's are `GroupSize`
(`src/ui/Selection.tsx:323-366`). On a phone they sit in the Compose sheet.

| #   | Feature line (features.ts)                      | Sub-flow: entry → steps → end state                                                                                                                                | Code                                                                                                         | Covering test                                                                       | P/D |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --- |
| 1   | Width, height and depth of the whole piece (:445) | (a) Piece open, whole piece selected → Compose → Width/Height/Depth → blur or Enter → `resizePiece`; (b) project → select a piece → Selected piece card → `resizeItem` | (a) `Inspector.tsx:191-235`, `designStore.ts:2031-2036`; (b) `Project.tsx:414-432`, `designStore.ts:2037-2050`; core `pieceSize.ts:18-70` | `tests/piece-size.test.ts`, `tests/find-it/param-locks.test.tsx`, `piece-editor-inputs.test.tsx:112-132` | P D |
| 2   | Size, boards and construction of a project piece (:450) | Project piece → Edit this piece → Inside this piece → Size, boards and construction → Settings dialog for that piece                                               | `Project.tsx:445-456`, `Settings.tsx:90-96`                                                                  | `tests/find-it/editing-flows.test.tsx`, `editor-nav.test.tsx`                       | P D |
| 3   | Mattress size where a bed is selected (:455)    | Bed selected → Mattress width / Mattress length (on the width and depth keys) → `resizeBed`                                                                        | `PieceSize.tsx:34-35`, `pieceSize.ts:78-96`, `designStore.ts:2034,2040`                                      | `tests/piece-locks.test.ts`                                                         | P D |
| 4   | Lock boards and Lock construction (:461)        | Selected piece → ⋯ → Lock boards / Lock construction (`aria-pressed`) → later edits to boards or construction refused with a hint                                   | `Project.tsx:997-1015`, `src/core/pieceLocks.ts:13-17,89-90`                                                 | `tests/piece-locks.test.ts`, `tests/find-it/editing-flows.test.tsx`                 | P D |
| 5   | Lock size (:467)                                | ⋯ → Lock size → fields off with "Size locked — unlock to change"; or one by one: Lock Width / Height / Depth → that field off, "{axes} locked — unlock to change" | `Project.tsx:970-1037`, `PieceSize.tsx:47-67`, `src/core/sizeLock.ts:21-88`                                  | `tests/param-locks.test.ts`, `tests/find-it/param-locks.test.tsx`, `selected-piece.test.tsx` | P D |
| 6   | Size a group as a whole (:473)                  | Select a group → Size of the group → Width (split Proportionally / Equally) or Height / Depth ("Pieces differ") → `resizeGroup` → message in the card                | `Selection.tsx:193-198,323-366`, `designStore.ts:2051-2059`, `src/core/groupSize.ts:120-229`                 | `tests/group-size.test.ts`, `tests/find-it/group-size.test.tsx`                     | P D |
| 7   | Exact whole-millimetre splits (:479)            | Any split or group width → leftover mm one each to the first parts                                                                                                 | `groupSize.ts:94-102`; core layout (ADR-003)                                                                 | `tests/group-size.test.ts:40-52`, `tests/fuzz.test.ts`                              | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input,
i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector stability,
persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited,
not run), **Suspected**.

### D06-F1 — A size out of range is thrown away on blur or Enter, with no word (Proven, major)

`MmField.commit` (`controls.tsx:52-59`) resets an invalid draft to the old value: `else if (!valid)
setText(String(value))`. While typing, the field is `aria-invalid` with "Whole number from {min} to {max}."; on blur
or Enter the typed size disappears and so does the error, the piece keeps its old size and nothing says so. ADR-106
says "Out-of-range input shows the field's existing error; nothing is clamped silently" (ADR-106 line 34); ADR-199
fixed the same pattern for split and drawer sizes and named the reset as the rejected alternative ("resetting on blur
hides the mistake", ADR-199 lines 32-36; `SizeShareField.tsx:41-46` keeps the draft). The group fields use the same
`MmField` (`Selection.tsx:339-347`).
Reproduction (`PieceSize` with a base cabinet, Width 600):

```
D06-F1 while typing: value 5000 aria-invalid true error Whole number from 100 to 4000.
D06-F1 after Enter: value 600 aria-invalid false error none onChange calls 0 | any alert/status 0
```

### D06-F2 — "Pieces differ" but the group cannot be set to the size it shows (Proven, minor)

For height and depth the group field shows the largest value with the hint "Pieces differ"
(`groupSize.ts:71-91`, `Selection.tsx:339-347`). Typing that same value commits nothing, since `MmField` only commits
a value different from the one shown (`controls.tsx:53`). To make every piece 900 mm high the user must type another
value first, then 900 (two undo steps).
Reproduction (group of a 720 mm base cabinet and a 900 mm chest):

```
D06-F2 group height field {"key":"height","label":"Height","value":900,"differs":true} piece heights [ 720, 900 ]
D06-F2 typed the shown 900 + Enter: onChange calls 0
```

### D06-F3 — Locking a size the piece does not have gives a nameless note and locks nothing visible (Proven, minor)

The ⋯ menu offers Lock Width, Lock Height and Lock Depth for every piece (`Project.tsx:1017-1037`, `SIZE_AXES`). A
bed shows only Mattress width and Mattress length (on the width and depth keys, `pieceSize.ts:78-86`) and a panel has
no depth (`pieceSize.ts:57-61`). With Height locked on a bed or Depth on a panel, `PieceSize` shows its note with an
empty list of axes (`PieceSize.tsx:58-66`) and no field is off. On a bed, a width lock is also named "width" beside a
field labelled "Mattress width".
Reproduction (`PieceSize` alone):

```
D06-F3 bed fields [ false, false ] note: " locked — unlock to change"
D06-F3 panel fields disabled [ false, false ] note: " locked — unlock to change"
```

### D06-F4 — The group's "Kept: …" message is not translated (Proven, minor)

`resizeGroup` in the store returns a template literal (`designStore.ts:2058`) instead of `t('Kept: {list}.')`, whose
Russian entry exists (`src/core/i18n/ru/core2.ts:652`, used by `ownEdits.ts:269`). The translation rule (CLAUDE.md,
ADR-153) requires every visible text through `t()`.
Reproduction (Russian loaded, group height changed with one piece size-locked):

```
D06-F4 Russian message after a group resize with a size-locked piece: "Kept: Base cabinet." | dictionary has: "Сохранено: X."
```

## Checked, no finding

- Locked sizes: the fields and their − / + buttons are off (`PieceSize.tsx:55`, `controls.tsx:65-97`); the note is a
  `role="note"`.
- A valid size refused by the store goes back to the stored value (ADR-199, `controls.tsx:53-57`, test
  `piece-editor-inputs.test.tsx:112-132`).
- The selector for one-by-one locks returns a joined string, not an array (`Inspector.tsx:199-206`).
- Group width: refused for pieces not in columns, out of limits named with the limit, locked shifts refused
  (`groupSize.ts:103-114`, `:166-212`); never clamped.
- Whole-mm shares with the leftover to the first columns (`groupSize.ts:94-102`), as ADR-003.
- Lock boards and Lock construction refuse a change with a hint (`pieceLocks.ts:89-90`) and are `aria-pressed`
  toggles (`Project.tsx:997-1015`).
- Every other visible text in the files read goes through `t()`/`tr()`.
