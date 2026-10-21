# Project baseline

**Furniture Builder** — `chiriacsergiucs-v2/furniture-builder`, rebuilt from zero on branch `rebuild/v1` (2026-10-21).
A phone-first, offline PWA: design casework by dividing a front elevation into spaces, see it in 3D, get a grouped
cut list with edge-band notation and a hardware schedule. No backend.

**Stack:** React 19, TypeScript 5.9 strict, Vite 7, Zustand 5, three 0.186 + @react-three/fiber 9 + drei 10 (lazy),
Dexie 4, vite-plugin-pwa 1, Vitest 3, ESLint 10. Fonts: Barlow (bundled).

**State:** first slice done — see `docs/backlog.md` (F01–F18; F14–F17 partially verified). Next: sheet nesting (N01).

**Authority:** explicit user decision › Accepted ADR › code + tests on the branch › earlier discussion › proposal.
