---
name: add-tests
description: Write unit, fuzz and storage tests that prove an ADR's "Done when" items, following the test setup already in the repo. Use when the user says "add tests", "cover this", "write tests for X", "fix this bug" (start with a failing test), or when an implementation is missing the tests an ADR requires.
---

# Add tests

Project: **Furniture Builder** — pure TypeScript model, Vitest (ADR-015).

## Workflow

1. **Follow the setup in `tests/`:** Vitest, one file per area (`core`, `fuzz`, `persist`,
   `project`, `nesting`, `wizard`, `merge`…). Match their helpers and naming.
2. **Map `Done when` to tests.** At least one test per item; say which test covers which.
3. **Pick the right level:**
   - **Unit** on `src/core` for every new rule (build a design, call `buildModel()`, assert
     panels, diagnostics, cut list, hardware).
   - **Fuzz** (`tests/fuzz.test.ts`, seeded): extend generators and invariants when a new
     option changes geometry; invariants: integer mm, no overlaps, inside the envelope,
     exact gaps, no throw.
   - **Storage** (`tests/persist.test.ts`, fake IndexedDB): upgrades from every older Dexie
     version, unreadable rows kept, import gets new ids.
   - **Store** for undo/redo, selection and stable selectors.
   - **No committed browser suite** unless the user asks (ADR-015). Visible behaviour is
     proven by a find-it script in `tools/<feature>/find-it.mjs`, run on the production build
     (for an `Acceptance: light` ADR: later, at the catch-up; record `find-it pending (light, ADR-066)`, ADR-066).
4. **Cases this domain breaks on:** minimum and maximum sizes, thickness larger than the
   space, odd millimetres in equal splits, every quarter turn in projects, every front style,
   empty spaces, schemaVersion 1 documents, invalid imports.
5. **Make tests trustworthy:** behaviour not implementation; deterministic (seeded fuzz, no
   clock or order dependence); clear names. For important rules, check that a deliberate
   code mutation makes a test fail and record it in the backlog evidence.
6. **Bug fixes start with a failing test.**
7. **Run** the new tests alone (`pnpm exec vitest run tests/<file>.test.ts`), then the `verify`
   skill; the deep fuzz for geometry.

## Rules

- Never delete, skip or weaken a test, or lower a fuzz count, to make a run pass.
- No real personal data in fixtures. Generate images in the test rather than committing binaries.
- Report: tests added, which `Done when` item each covers, and any case not covered and why.
