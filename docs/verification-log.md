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
