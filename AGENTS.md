# AGENTS — Furniture Builder

Read first: `docs/backlog.md`, `claude-flow/architecture/decisions/README.md`, `claude-flow/memory/project-context.md`.

## Hard rules
- Static offline PWA on GitHub Pages; no backend, accounts, cloud, telemetry, remote AI or CDN (ADR-0002).
- Integer millimetres; x width, y height from floor, z depth from back (ADR-0003).
- Every view and list is a projection of `buildModel()`; never compute geometry in UI code (ADR-0004).
- User input never throws; problems are diagnostics; errors block export (ADR-0008).
- Never invent hardware specs, loads, drilling or supplier mappings; label guidance as guidance (ADR-0010).
- Storage: never edit a shipped Dexie version; never delete rows the app cannot read (ADR-0012).
- Zustand selectors return stable references (no `.filter()`/`.map()` inside a selector).

## Delivery (hard, auto-failing — user rule 2026-10-23, see `docs/retros/2026-10-23-catalog.md`)
- R1 Requirement ledger: list every requirement in the user's own words; each needs evidence from the running app the
  user will use. Unreachable or unchecked = not done, and the whole delivery fails.
- R2 No avoidance: never drop or relabel a requirement ("reference", "waits", "gap") to skip building it; ask instead.
- R3 Find-it test: UI acceptance starts from the bare app and finds features by visible text at phone and desktop widths.
- R4 Outcome first: replies open with where to click and whether it is live.

## Process (standing user rules)
- Smallest functional slice. Default verification: `npm run lint && npm run typecheck && npm test && npm run build`.
- No new browser/E2E suite, refactors or polish unless asked.
- Update `docs/backlog.md` in the same change; statuses only with evidence.
- Pushed ≠ merged ≠ deployed ≠ live-verified. Never claim tests or deployments that did not run.
- Every implementation reply ends with the backlog status table and a **Skipped this iteration** section.
- Only modify `chiriacsergiucs-v2/furniture-builder`; never force-push `main`.
