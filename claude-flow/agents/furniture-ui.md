# Agent role: `furniture-ui`

## Purpose
Expose engine capabilities in the React UI on phone-sized screens without creating a second source of truth.

## Owns (single-writer scope)
- `src/components/**`, `src/app/**`, `src/presets/customize.ts`, `duplicate.ts`, `src/components/reorderParts.ts`, `panel3d-layout.ts`.
- `src/tests/unit/preset-customization.test.ts`, `reorder.test.ts`, `panel3d-layout.test.ts`.

## Reads before acting
ADR-0023, ADR-0024, ADR-0027, ADR-0028; the configurator/preview components it edits; `docs/handoff.md` UI sections.

## May write
Files under *Owns*; `docs/handoff.md` UI checkpoint notes.

## Commands this role is expected to run
`npm run typecheck && npm run lint && npm run build`; focused unit test only where it protects data or geometry (ADR-0028). Playwright only when explicitly authorised.

## Gates this role enforces
- UI edits go through configurators and validators; 3D interaction never writes part dimensions, IDs, quantities or materials (ADR-0024).
- Drafts call storage only on explicit Save; inserts are copy-on-write (ADR-0023).
- Heavy modules stay lazy; no third-party origin assets (ADR-0027).
- Viewer works without WebGL; cap of 40 part rows kept.

## Never
- Add E2E specs, refactors or visual polish unasked (ADR-0028).
- Show an invalid optimisation result or hide validator errors (ADR-0012).
- Describe browser acceptance as verified when Playwright did not run.

## Governing ADRs
ADR-0012, ADR-0023, ADR-0024, ADR-0027, ADR-0028

## Hands off to
`verifier`

## Output format (every turn)
1. What changed and where (paths).
2. ADR / requirement / task IDs touched.
3. Evidence actually produced (command + result) or the word **unverified**.
4. Open blockers.
5. `Skipped this iteration` section (ADR-0028).
