# Mobila rooms — rebuilt from the project file

Source: `MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json` (format 2.0.0, exported 2026-10-22), attached to the Mobila
project. Generator: `src/core/samples/mobila.ts`. Importable files: `mobila-living.project.json`,
`mobila-dormitor.project.json` (also under **New → Mobila rooms** in the app). `tests/mobila.test.ts` checks them.

## Living (`living_535`) — three pieces

| Piece | Structure in the file | Built as |
|---|---|---|
| **Coloana** | Sides 2600 × 400; top and bottom 499 between the sides; 4 shelves + 1 fixed shelf; tall door + upper door | Cabinet 535 × 2600 × 400, top and bottom between sides. Inside split top→bottom: upper compartment 410 mm with its own door, then a fixed shelf, then 4 shelves behind the tall door. Floor, x = 0 |
| **Corp jos (JOS)** | Top and bottom 2685 × 400 over the sides; sides and 4 uprights 399 high; bays 510 · 519 · 519 · 519 · 510; one shelf and one door per bay | Cabinet 2685 × 435 × 400, top **on** the sides, bottom **under** the sides (new option). 5 bays, 1 shelf and 1 door each. Floor, x = 535 |
| **Corp sus (SUS)** | Same as JOS, underside at 2165 | Same cabinet, wall brackets. Placed **on a piece**: 1730 mm above JOS, left edges aligned (underside 2165, as in the file) |

All 47 living parts appear, with the file's carcass sizes one for one (2600 × 400 ×2, 2685 × 400 ×4,
400 × 399 ×12, 499 × 400 ×7, 510 × 400 ×4, 519 × 400 ×6) and 12 fronts. Overall 3220 × 2600, as the file.

## Dormitor — nightstand A, quantity 2

Cabinet 450 × 400 × 332 (+18 fronts = 350 deep), top on the sides, two drawers: top front 160, lower front takes
the rest. Front gap 4 gives the file's 446 mm front width. Floor; the file has no position next to the bed.

## Where the app differs from the file (decide before cutting)

| Part | File | App | Why |
|---|---|---|---|
| JOS / SUS fronts | 535 × 435 | 535 × 433 | App leaves half the 2 mm gap at the top and bottom edge; the file has none vertically (older cut sheet said 534 × 435) |
| Coloana tall door | 535 × 2162 | 533 × 2161 | Same outer reveal, on all four edges |
| Coloana upper door | 535 × 436 | 533 × 435 | Same |
| Fronts' distance from carcass | 5 mm (y 405) | 0 mm | App fronts sit on the carcass; depth 418 instead of 423 |
| Coloana shelf heights | 460 · 910 · 1360 · 1810 | evenly spaced | App spaces shelves evenly; part sizes are the same |
| SUS bottom LV-0030 | MDF P110 | PAL 18 | One body board per cabinet; change the part material at the panel shop |
| SUS left side LV-0032 | contested PAL / MDF | PAL 18 | Same limitation; file marks it contested |
| 17 shelves / column panels | PAL or MDF unresolved | PAL 18 | Unresolved in the file; PAL used as the body board |
| Nightstand top | 450 × 350 (covers the fronts) | 450 × 332 | App top stops at the carcass front |
| Nightstand sides | 400 × 332 | 382 × 332 | App sides stand under the top, so the unit is 400 high overall; the file's 400 sides + top = 418 |
| Nightstand lower front | 446 × 234 | 446 × 232 | Gaps and reveals at 4 mm; the file's fronts total 394 of 400 |
| Nightstand bottom | not listed | 414 × 332 ×2 | A drawer cabinet needs one |
| Backs, plinths | not in the file | none | Left out to match the file. SUS shows a warning: hanging brackets usually need a set-in back |
| Drawer boxes | not in the file | PAL 16 sides, HDF 3 bottoms, 300 mm runners | App defaults, not from the file |

## Not built

| Item | Reason |
|---|---|
| Pat Noi (bed) | Not a cabinet; the app has no bed product. Panel sizes also look swapped (sides 1800, foot 2040 for an 1800 × 2000 mattress) |
| Panou bucătărie (splashback 3670 × 700 × 3) | Single wall panel, no product type for it |
| Banc montaj RHS | Envelope only, steel; no member list in the file |
| Nightstand B, simplified bed | Marked alternative / superseded in the file |
| Archived cutting orders | Marked "do not merge" in the file |
