# Mobila rooms — rebuilt from the project file

Source: `MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json` (format 2.0.0, exported 2026-10-22), attached to the Mobila
project. Generator: `src/core/samples/mobila.ts`. Importable files: `mobila-living.project.json`,
`mobila-dormitor.project.json` (also built into the app: **New** or **Library → Built in the app**, on the deployed site with no import).
`tests/mobila.test.ts` checks them.

| Room in the file | Project | Pieces |
|---|---|---|
| Living | Mobila — Living | Re-done from the catalog 2026-10-24: Corp jos 1–3 on the floor, Corp sus 1–3 at the ceiling |
| Dormitor | Mobila — Dormitor | Noptieră A ×2, Pat Noi (loose panels) |
| Bucătărie | — | Splashback left out at the user's request (2026-10-22) |
| Atelier | — | Banc montaj RHS not built: envelope only, steel, no member list |

## Living — re-done from the catalog (user request 2026-10-24)

User's words: "re-do the living project to contain 1 base cabinet on the left, the rest is 2x base cabinet + 1x base
cabinet, both on floor and ceiling". Answers to the follow-up: per row a 1-door, a 2-door and a 1-door cabinet; fit the
current wall (3220 wide, 435 high, 400 deep, ceiling row underside 2165, Mobila boards). The Coloana is removed.

| Piece | Catalog origin | Built as |
|---|---|---|
| Corp jos 1 / Corp sus 1 (left) | Base cabinet, doors — 1 door + shelf | 805 × 435 × 400, one shelf, one door. x = 0 |
| Corp jos 2 / Corp sus 2 | Base cabinet, doors — 2 doors + shelf | 1610 × 435 × 400, one shelf, a pair of doors. x = 805 |
| Corp jos 3 / Corp sus 3 (right) | Base cabinet, doors — 1 door + shelf | 805 × 435 × 400, one shelf, one door. x = 2415 |

Widths share the 3220 wall equally between the four doors (805 · 1610 · 805). Construction as the old JOS/SUS: PAL 18
body, top on the sides, bottom under the sides, no back, no plinth, MDF P110 fronts. The floor row stands on the
floor; each ceiling cabinet is placed **on a piece**, 1730 mm above its floor cabinet, on wall brackets (underside
2165, top 2600). Overall 3220 × 2600, the file's envelope. 38 parts: 8 fronts 803 × 433, tops/bottoms 1610 × 400 ×4,
805 × 400 ×8, sides 400 × 399 ×12, shelves 1574 × 400 ×2, 769 × 400 ×4.

Warnings shown (guidance, not errors): every door is 803 wide (over the typical 600); the 1574 shelf in the 2-door
cabinets is over the 900 span; the ceiling row has no set-in back for hanging brackets. The kitchen catalog base
cabinet's own sizes (720 + 100 plinth, 560 deep) are not used, at the user's choice.

The file's original Living (Coloana 535 × 2600, JOS and SUS 2685 × 435 with five bays) is no longer built.

## Dormitor — Pat Noi (panel set with a screwed frame, ADR-0041 as amended 2026-10-23)

The file gives the bed's cut panels only; every position is marked "do not invent". The user decided on 2026-10-23
that the bed rails are the chipboard side boards **screwed to the foot board**. So the two sides (1800 × 270) stand on
edge behind the foot board (2040 × 270), flush with its ends, and two screwed joints are scheduled (screw type, length
and count are your choice). The head end stands against the existing headboard panel. The headboard trim has no known
place and lies in a pile beside the frame. What carries the mattress is not in the file.

| Part (file id) | Cut size | Board | Qty |
|---|---|---|---|
| Laterală pat stânga / dreapta (BD-0050) | 1800 × 270 | PAL 18 | 2 |
| Cap pe picioare (BD-0051) | 2040 × 270 | PAL 18 | 1 |
| Traversă tăblie (BD-0053) | 2100 × 100 | MDF P110 18 | 1 |
| Poliță sus tăblie (BD-0054) | 2100 × 80 | MDF P110 18 | 1 |
| Poliță laterală tăblie (BD-0055) | 450 × 80 | MDF P110 18 | 2 |

Not listed (not cut from board): upholstered zone BD-0052 2100 × 600 × 40, existing headboard panel 2100 × 1100.
The file's alternative continuous shelf 2992 (446 + 2100 + 446) is not added, as the file says not to double it.
Placed next to the nightstand in the plan only so the pieces do not overlap; the file has no position.

## Dormitor — nightstand A, quantity 2

Cabinet 450 × 400 × 332 (+18 fronts = 350 deep), top on the sides, two drawers: top front 160, lower front takes
the rest. Front gap 4 gives the file's 446 mm front width. Floor; the file has no position next to the bed.

## Where the app differs from the file (decide before cutting)

| Part | File | App | Why |
|---|---|---|---|
| Nightstand top | 450 × 350 (covers the fronts) | 450 × 332 | App top stops at the carcass front |
| Nightstand sides | 400 × 332 | 382 × 332 | App sides stand under the top, so the unit is 400 high overall; the file's 400 sides + top = 418 |
| Nightstand lower front | 446 × 234 | 446 × 232 | Gaps and reveals at 4 mm; the file's fronts total 394 of 400 |
| Nightstand bottom | not listed | 414 × 332 ×2 | A drawer cabinet needs one |
| Backs, plinths | not in the file | none | Left out to match the file. The ceiling row shows a warning: hanging brackets usually need a set-in back |
| Drawer boxes | not in the file | PAL 16 sides, HDF 3 bottoms, 300 mm runners | App defaults, not from the file |

## Not built

| Item | Reason |
|---|---|
| Panou bucătărie (splashback) | Left out at the user's request (2026-10-22) |
| Pat Noi mattress support and headboard trim positions | Not in the file. Sizes also look swapped (sides 1800, foot 2040 for an 1800 × 2000 mattress); check before cutting |
| Banc montaj RHS | Envelope only, steel; no member list in the file |
| Nightstand B, simplified bed | Marked alternative / superseded in the file |
| Archived cutting orders | Marked "do not merge" in the file |
