# Acceptance criteria (verifier checklist)

Each line is a check the `verifier` role can run; the FR/NFR it proves is in brackets.

## Engine
- `npm run test:kernel` passes; fixture with free width = part + (kerf−1) is rejected [FR-012, NFR-002].
- Same project optimised twice → deep-equal result [FR-011].
- Grain-locked part on cross-grain sheet ends in `unplaced`, never rotated [FR-008].
- `validateResult` finds: duplicate placement, node outside usable area, kerf mismatch, area non-conservation [FR-015, FR-016, NFR-004].
- `validate.ts` imports nothing from `guillotine.ts`/`optimize.ts` [FR-015].

## Storage
- `npm run test -- db`: migration twice = once; existing Dexie ID not overwritten; `localStorage` keys unchanged after migration [FR-023, FR-024, NFR-005, NFR-006].
- Full backup export→import into empty DB → equal counts; second import changes nothing [FR-025, NFR-007].
- `database.ts` has one `version(n)` block per shipped version; old blocks byte-identical to history [NFR-007].

## Furniture engine
- Parity test passes for every `status:'ready'` template: cut rows equal model extents, no overlapping solids [FR-030, FR-036].
- `initialSpecForTemplate` on a `planned` ID yields no parts [FR-036].
- Parent width change updates child shelf, sibling untouched; repeat N→N+1 keeps first N IDs [FR-027].
- No `HardwareRequirement` reaches `Project.parts` [FR-037, NFR-012].
- Legacy fixture adapted in memory; stored row unchanged [FR-038].

## UI / 3D
- `reorderParts` returns same ID multiset [FR-039, NFR-010].
- `Assembly3DEditor.tsx` does not import `optimize.ts`; no part dimension write path from 3D [FR-031, FR-032].
- WebGL unavailable → list fallback renders (unit/E2E where authorised) [NFR-009].

## Platform / release
- `vite.config.ts` base `/furniture-builder/`; `dist/` has no third-party `<script src>` [FR-034, FR-035, NFR-014].
- `grep -rn "fetch(" src/` empty outside generated SW [NFR-001].
- Release claim cites `lockfile.yml`, CI run, Pages run; vocabulary from `workflows/release.md` [NFR-011].
- Implementation reply ends with `Skipped this iteration` [NFR-015].
