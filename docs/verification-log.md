# Verification log

Date: 2026-10-10 (UTC date). Environment: sandbox Node v22.16.0.

| Command | Result | Evidence/notes |
|---|---|---|
| `node --experimental-strip-types --test tests/engine.node.test.mjs` | PASS 19 / FAIL 0 | 12 engine cases (includes 200 randomized instances and 103/104 kerf boundary) + 7 integration cases (CSV, JSON, SVG, schema tampering) |
| `timeout 35s npm install --no-audit --no-fund --ignore-scripts` | BLOCKED | npm registry inaccessible; timed out |
| `npm run lint` | NOT RUN | Dependencies absent |
| `npm run typecheck` | NOT RUN | Dependencies absent |
| `npm run test` | NOT RUN | Dependencies absent |
| `npm run build` | NOT RUN | Dependencies absent |
| `npm run test:e2e` | NOT RUN | Browser/dependencies absent |
| GitHub Actions/Pages | NOT VERIFIED | Remote full source not yet committed; Pages configuration unverified |

Do not infer any full acceptance gates from standalone Node test results.

Benchmark (Node v22.16, max 6 restarts, single run per workload): 20 parts 14.49ms/2 sheets/85MiB RSS; 50 parts 8.21ms/3 sheets/87MiB; 100 parts 18.76ms/5 sheets/87MiB; 250 parts 46.41ms/12 sheets/93MiB. These are not mobile-device performance guarantees.

## Dexie milestone — verified 2026-10-10 (GitHub hosted Node 22)
| Validation | Result | Evidence |
|---|---|---|
| `npm ci` with new Dexie lockfile | PASS | CI run 38028499465 |
| ESLint | PASS | CI run 38028499465 |
| TypeScript `tsc --noEmit` | PASS | CI run 38028499465 |
| Native engine + integration | 25 PASS / 0 FAIL | CI run 38028499465 |
| Vitest including fake-indexeddb migrations/backups | 10 PASS / 0 FAIL | CI run 38028499465 |
| Playwright Chromium (desktop/mobile, presets, migration, offline) | 8 PASS / 0 FAIL | CI run 38028499465 |
| Production build / Pages artifact | PASS | Deploy run 38028499287 |
| GitHub Pages publish | PASS | Deploy job 114144405469; URL https://chiriacsergiucs-v2.github.io/furniture-builder/ |

Latest tested source: `f7f38e7fcb9df908f062066460799f9073417f2d`. GitHub deployment action reported success; independent HTTP retrieval was unavailable, so real mobile browser/storage retention after upgrade has not been individually checked.

## 2026-10-10 — R3F/Three and dnd-kit release
- Code commit 1d4791c; lockfile bot 004da9f; verification source b01f2e64.
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:kernel`, `npm run test`, `npm run build`, `npm run test:e2e` all passed in GitHub CI https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38038577231.
- 25 kernel tests, 15 Vitest tests (4 files), 10 Playwright tests.
- GitHub Pages deployment https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38038577305 passed; Pages reports https://chiriacsergiucs-v2.github.io/furniture-builder/.
- Not independently tested: physical Android GPU, live URL over this assistant HTTP client.

## 2026-10-10 — Positioned drawers, preset-to-assembly and Fusion export
- GitHub CI: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38048669793
- Results: 25/25 kernel, 21/21 Vitest, 14/14 Playwright across desktop and emulated Android; lint, typecheck and production build all PASSED.
- GitHub Pages: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38048670051 — reported deployment success for d298f5af.
- Tests cover 4 row / 5 panel drawer placement, 3-set positioning and per-instance indices, independent XYZ edit persistence after IndexedDB save, Fusion script content, default Drawers preset use.
- Pending: independently run generated script in Fusion, real Android GPU gestures, real physical drawer fit and hardware allowances, independent live URL GET.

## 2026-10-11 — Saved preset categories, separate navigation, optional 3D, explicit duplicate drafts, editor cleanup

- CI: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38107863136 — passed 25 kernel tests, 22 Vitest tests, 16 Playwright tests (desktop and Android viewport). TypeScript/lint/production build passed.
- Pages: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38107862978 — deployed successfully from a1bcb4cf194cc334ef78728e2c37611fda042393.
- Confirmed standalone preset browsing, explicit save, cancellation without database writes, project insertion, reload persistence and on-demand 3D region via automated tests.
- Existing Dexie database schema preserved. Avoid clearing site data; use complete JSON backups.

## 2026-10-11 — EDC iteration 5 B19/B20/B22
- Pinned source revision and serialized manufacturing instance provenance; non-destructive stable legacy cabinet/drawer graph hydration; explicit-save configured furniture preset draft.
- CI https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38117222030 passed 25/25 kernel, 56/56 unit and 12/12 browser tests, typecheck, lint and build. Pages https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38117222131 succeeded. Source commit 07a1eaf93427ec0d345253e57103de46cf4f288e.
- Still deferred: generic editor for unknown component kinds, physical Android GPU, Fusion execution, additional furniture families, hardware/drilling and photorealism.
