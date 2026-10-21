# Workflow: release and deployment claim

Governs STEP_13 (full acceptance) and STEP_14 (release/handoff), and any statement that something is "deployed".

## Gate sequence (all must be cited with run IDs or command output)
1. `lockfile.yml` has run after the last `package.json` change (bot commit present on `main`).
2. Full verification: `npm ci && npm run lint && npm run typecheck && npm run test:kernel && npm run test && npm run build && npx playwright install --with-deps chromium && npm run test:e2e` — counts recorded (kernel / Vitest / Playwright).
3. Licence inventory (`docs/licences.md`) covers every runtime dependency in `npm ls --all` (TSK-011).
4. Network boundary check: no third-party origin in `dist/`, no `fetch(` outside the service worker (ADR-0001, ADR-0002, ADR-0027).
5. Honest labelling: README and UI copy say "heuristic" (ADR-0011) and "unverified in Fusion" (ADR-0025); 3D described as non-authoritative (ADR-0024).
6. `Deploy GitHub Pages` run succeeded for the exact commit.
7. External items remain listed, not claimed: physical Android device test (TSK-009), Fusion runtime (TSK-008), physical fitting/hardware (TSK-007).

## Vocabulary (use exactly)
| Phrase | Means |
|---|---|
| pushed | commit on a branch |
| merged | on `main` |
| CI passed (run N) | the cited run succeeded |
| deployed (run N) | Pages workflow succeeded for that commit |
| live-verified | someone fetched the published URL and checked behaviour — CI does not do this |
| reported | taken from a document, not re-executed by the current agent |

## Output
`release-compliance` updates `docs/progress.json` STEP_13/14 status with evidence, `docs/handoff.md` release
checkpoint, and runs `scripts/validate.py --sync`. Then hands the decision to the user; agents do not merge or
publish without an explicit instruction (ADR-0028).
