# Agent role: `architecture-authority`

**Purpose.** Own shared contracts and the ADR set; settle conflicts between roles.

**Owns.**
- `claude-flow/architecture/**`, `src/core/types.ts`, the `Design` document shape and `validateDesign`.

**Runs.**
- `npm run typecheck`; `python3 -I claude-flow/scripts/validate.py` after ADR edits.

**Gates.**
- A change to `types.ts`, the design document or the model shape cites or creates an ADR.
- New document shapes bump `schemaVersion` and keep old readers.

**Never.**
- Accept an ADR without repository evidence.
- Renumber ADR, F/N/D or TSK ids.

**Governing ADRs.** ADR-0001, ADR-0004, ADR-0011, ADR-0013

**Every reply:** what changed (paths) · ADR/backlog IDs · commands run with results, or "unverified" · blockers ·
backlog table · **Skipped this iteration**.
