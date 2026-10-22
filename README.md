# Furniture Builder

Design cabinets, chests, wardrobes and desks to the millimetre, see them in 3D and get the parts list.
Runs in the browser, works offline, keeps everything on your device.

**Live:** https://chiriacsergiucs-v2.github.io/furniture-builder/

## How it works

1. **New** → pick a starting piece (cabinets, chest, bookcase, sideboard, wardrobe, wall cabinet, blind or L-shaped
   corner, desks) or start a **project** with several pieces.
2. In the **front view**, tap a space: shelves (fixed or adjustable on 32 mm pin rows), drawers (equal or chosen
   heights), hanging, empty; add doors and handles, or divide it side by side or stacked. **Whole cabinet** sets size,
   construction, overlay / half overlay / inset fronts, wall mounting and materials.
3. **Parts**, **Sheets** (heuristic layouts on your stock sheets), **Hardware** and **Checks** update as you edit.
4. When Checks is clear: **Parts CSV** (Romanian, for the panel shop), **Print** (Romanian A4 cutting sheet with
   sheet plans; save as PDF from the dialog), **Export** → front-view SVG, Fusion 360 script (not yet tested in
   Fusion), design or project file.
   **Library** lists what is saved on this device. The theme follows your system; the sun / moon button switches it.
5. In a **project**, place pieces on the plan (position in mm, quarter turns), set quantities, and get one parts list,
   one set of sheets and one hardware list. Editing a piece there never changes your saved pieces.

Sizes are finished sizes; banded edges are marked L/W. Defaults: 4 mm saw cut, 10 mm sheet trim, PAL/HDF 2800 × 2070,
MDF 2440 × 1220 (Materials). Hinge, pin and bracket counts are common guidance — the maker's datasheet decides.

## Develop

```sh
npm ci
npm run dev        # http://localhost:5173/furniture-builder/
npm test           # unit, fuzz and storage tests
npm run lint && npm run typecheck && npm run build
```

`FUZZ_N=50000 npx vitest run tests/fuzz.test.ts` runs a deep geometry fuzz.

## Layout

```
src/core      pure TypeScript model: geometry, cabinet/desk/corner generators, checks, cut list, nesting, projects,
              Romanian output, Fusion export, design document
src/store     Zustand store: design, derived model, selection, undo/redo
src/persist   IndexedDB (Dexie) storage
src/ui        React UI: front elevation, inspector, parts/hardware/checks, dialogs
src/viewer    lazy three.js preview
tests         core, fuzz and storage tests
docs          backlog (single ledger)
claude-flow   architecture decisions and agent contracts
```

Decisions are in `claude-flow/architecture/decisions/`. MIT licensed.
