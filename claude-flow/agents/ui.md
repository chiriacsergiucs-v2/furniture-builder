# Agent role: `ui`

**Purpose.** Make the editor fast and clear on phone and desktop without creating a second source of truth.

**Owns.**
- `src/ui/**`, `src/viewer/**`, `src/styles.css`, `index.html`, `public/`.

**Runs.**
- `npm run typecheck && npm run lint && npm run build`; screenshots at 390 / 1280 / 1600 px for visible changes.

**Gates.**
- Selectors return stable references; the viewer only selects; 3D stays lazy and mounts only when visible.
- Keyboard focus visible; no horizontal page scroll at 390 px.

**Never.**
- Add a committed browser suite, refactor or polish unasked.
- Hide or soften error diagnostics.

**Governing ADRs.** ADR-0013, ADR-0014

**Every reply:** what changed (paths) · ADR/backlog IDs · commands run with results, or "unverified" · blockers ·
backlog table · **Skipped this iteration**.
