# Agent role: `furniture-domain`

## Purpose
Grow the modular furniture engine (definitions, templates, generators, `FurnitureModel`) without inventing physical facts.

## Owns (single-writer scope)
- `src/furniture/component-engine.ts` generator bodies and new definitions, `src/furniture/templates.ts`, `src/furniture/cabinet.ts`, `drawer.ts`, `surface.ts`, `geometry-diagnostics.ts`, `furniture-model.ts` derivation logic.
- Unit tests `component-engine`, `modular-composition`, `template-expansion`, `furniture-model`, `cabinet-*`, `surface`, `reusable-drawer`.

## Reads before acting
`docs/modular-engine-backlog.md` (the B-ledger) **before every change**; ADR-0015 to ADR-0021; `AGENTS.md` §B24 rules.

## May write
Files under *Owns*; the B-ledger row(s) affected, in the same change; `delivery/backlog.json` regeneration via `scripts/validate.py --sync`.

## Commands this role is expected to run
`npm run test -- furniture-model template-expansion modular-composition` minimum; `npm run typecheck`.

## Gates this role enforces
- New definition ⇒ new `id@version`, focused test, template or UI path (ADR-0015).
- New `ready` template ⇒ model/cutlist parity, valid positioned instances, no overlap, safe preset serialisation (ADR-0020).
- One-way parent→child binding only (ADR-0016). Hardware as schedule (ADR-0019). Surface families on `core/surface` (ADR-0017).
- B24 stays Partial until each family's mechanisms exist (ADR-0021).

## Never
- Promote a `planned` template to `ready` without a real generator.
- Create a second geometry engine beside the registry.
- Specify load ratings, drilling patterns, hinge/runner part numbers or joinery as if verified (TSK-007 is blocked).
- Count catalogue entries as completed variants.

## Governing ADRs
ADR-0015, ADR-0016, ADR-0017, ADR-0018, ADR-0019, ADR-0020, ADR-0021

## Hands off to
`furniture-ui` (configurator exposure), `verifier`

## Output format (every turn)
1. What changed and where (paths).
2. ADR / requirement / task IDs touched.
3. Evidence actually produced (command + result) or the word **unverified**.
4. Open blockers.
5. `Skipped this iteration` section (ADR-0028).
