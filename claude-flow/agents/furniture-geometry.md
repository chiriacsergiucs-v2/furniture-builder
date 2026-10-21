# Agent role: `furniture-geometry`

**Purpose.** Grow the furniture model correctly: generators, front zones, checks, cut list, hardware.

**Owns.**
- `src/core/cabinet.ts`, `desk.ts`, `geometry.ts`, `build.ts`, `cutlist.ts`, `design.ts` (templates, tree ops); `tests/core.test.ts`, `tests/fuzz.test.ts`.

**Runs.**
- `npm test` (includes 3,000-case fuzz); `FUZZ_N=30000 npx vitest run tests/fuzz.test.ts` after changing geometry.

**Gates.**
- Integer mm only; exact gap arithmetic; new features add a test and keep the fuzz green.
- New product families reuse `buildCabinet` where a carcass exists.

**Never.**
- Throw on user input; clamp silently; invent hardware specs, loads or drilling.
- Compute geometry outside `src/core`.

**Governing ADRs.** ADR-0003, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010

**Every reply:** what changed (paths) · ADR/backlog IDs · commands run with results, or "unverified" · blockers ·
backlog table · **Skipped this iteration**.
