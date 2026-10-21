# Furniture Builder

Design cabinets, chests, wardrobes and desks to the millimetre, see them in 3D and get the parts list.
Runs in the browser, works offline, keeps everything on your device.

**Live:** https://chiriacsergiucs-v2.github.io/furniture-builder/

## How it works

1. Pick a starting piece (**New**) or open one you saved (**Saved**).
2. In the **front view**, tap a space. Choose what goes in it — shelves, drawers, hanging, empty — add doors, or
   divide it side by side or stacked. Tap **Whole cabinet** to change size, construction and materials.
3. The **3D** view, **Parts**, **Hardware** and **Checks** update as you edit. Hover a part to see it in 3D.
4. When Checks shows no problems, download **Parts CSV** for the panel shop. **Design file** saves a copy you can
   import on another device.

Sizes in the parts list are finished sizes; banded edges are marked L (along the length) and W (along the width).
Hinge counts and shelf-span warnings are common guidance — your hardware's datasheet decides.

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
src/core      pure TypeScript model: types, geometry, cabinet & desk generators, checks, cut list, design document
src/store     Zustand store: design, derived model, selection, undo/redo
src/persist   IndexedDB (Dexie) storage
src/ui        React UI: front elevation, inspector, parts/hardware/checks, dialogs
src/viewer    lazy three.js preview
tests         core, fuzz and storage tests
docs          backlog (single ledger)
claude-flow   architecture decisions and agent contracts
```

Decisions are in `claude-flow/architecture/decisions/`. MIT licensed.
