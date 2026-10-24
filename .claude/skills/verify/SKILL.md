---
name: verify
description: Run the project's full verification (lint, type-check, tests, build, docs check) exactly as defined in the Commands table of CLAUDE.md, and report a short pass/fail result. Use when the user says "verify", "run the checks", "does it pass", "check before the PR", or whenever work is about to be declared done or shipped.
---

# Verify

Runs the same checks CI runs, as listed in the **Commands** table of `CLAUDE.md`,
and reports the result. The table is the single place that knows the commands;
this skill never hardcodes them.

Project: **Furniture Builder** — offline PWA.

## Workflow

1. **Run the helper** from anywhere in the repo:
   ```bash
   bash .claude/skills/verify/verify.sh            # full run
   bash .claude/skills/verify/verify.sh quick      # Lint + Type-check only
   bash .claude/skills/verify/verify.sh --install  # force the Install row
   ```
   Rows run top to bottom. `Install` is skipped when `node_modules` already exists.
   Failures do not stop the run, so you see every problem at once.
2. **If it exits with code 2** the Commands table is missing or incomplete. Do not guess
   commands: read `package.json` and `.github/workflows/ci.yml`, propose the rows, run each,
   then write them into `CLAUDE.md`.
3. **If a check fails**, fix the real cause. Never make a check pass by weakening it: no
   skipping or deleting tests, no lowering fuzz counts, no loosening lint or compiler rules,
   no `any` / `@ts-ignore` / `eslint-disable` to silence errors.
4. **Run the extra checks the change needs** (not in CI): `FUZZ_N=30000 pnpm exec vitest run
   tests/fuzz.test.ts` after geometry changes; `pnpm catalog:docs` /
   `pnpm catalog:snapshots` after catalog changes; the feature's `tools/*/find-it.mjs`
   on the production build for anything visible.
5. **Compare with CI.** If `.github/workflows/ci.yml` runs a check that is not in the table
   (or the commands differ), tell the user and suggest updating the table.
6. **Report briefly:** one line per row (pass/fail), the cause of any failure, what you
   changed. Say the work is verified only if every row passed, and only for the rows that
   ran — never claim a check that did not run.

## Notes

- The helper only runs the listed commands; it never edits files.
- Ship flow: run `verify` before `ship ADR-NNN` so the `Done when` check rests on a green run.
