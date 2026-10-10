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
