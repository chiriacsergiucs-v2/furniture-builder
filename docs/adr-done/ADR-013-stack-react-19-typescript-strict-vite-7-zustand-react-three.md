# ADR-013: Stack: React 19, TypeScript strict, Vite 7, Zustand, react-three-fiber (lazy), Dexie

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-002, ADR-014

## Context

The user left the stack to the architect. Needs: fast phone load, offline, 3D, small surface area.

## Decision

React 19 + TypeScript (strict) + Vite 7; Zustand for one store (design, model, selection, undo/redo history);
three.js via @react-three/fiber and drei, lazy-loaded and mounted only when the 3D view is visible; Dexie for
IndexedDB; vite-plugin-pwa; Vitest; ESLint 10 with typescript-eslint and react-hooks rules. Versions pinned exactly.
The core (`src/core`) is pure TypeScript with no React/three/storage imports.

## Alternatives considered

- **Svelte/Solid** — viable, but React + R3F is the most mature 3D path.
- **Redux** — heavier than needed.

## Consequences

- 3D chunk (~1 MB, ~260 kB gzip) is loaded only on demand; main bundle ~380 kB (~122 kB gzip).
- Zustand selectors must return stable references (a filtered array caused a render loop and was fixed).

## Evidence (repository files)

- `package.json`; `src/store/designStore.ts`; `src/ui/App.tsx` (`lazy`, `mount3d`); `eslint.config.js`.

## Compliance check

`grep -rn "from 'react'\|from 'three'\|dexie" src/core` returns nothing.
