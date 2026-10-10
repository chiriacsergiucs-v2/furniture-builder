# AGENTS — Cutlist optimizer

Read `docs/progress.json` and `docs/handoff.md` first. Reconcile state with git and executed test evidence; never trust stale statuses. Follow `CUTLIST_OPTIMIZER_RESUMABLE_BUILD_PROMPT_v2.md` in project root, then update five checkpoint files after each verified batch. Never fake tests or deployment success.

## Invariants
No backend, database, remote API, accounts, external scripts or data upload. Store integer millimetres only. Respect material+thickness+stock quantity, 4-sided trims, kerf, orientation/grain and ABS labels. A production layout **must** pass `validateResult` before rendering or export; solver is heuristic and cannot claim a global optimum. Recursively executable guillotine cut tree only. Never import unsupported Regency columns. All datasets stay in localStorage; backups generated locally only.

## Commands
`npm install` (must create package-lock on networked machine); `npm run test:kernel`; `npm run typecheck`; `npm test`; `npm run build`; `npm run test:e2e`. `npm run test:kernel` is runnable using only Node 22 with TypeScript stripping, even before installing npm dependencies. Gate on actual command results.

## Git safety
Target **only** `chiriacsergiucs-v2/furniture-builder`; confirm ownership and branch before pushing. Never modify unrelated `mobila-cutlist` or `ai-config`. Do not check in customer cutlists/backups or original template workbooks. Avoid force pushes, automated overwrite, and deleted localStorage records.
