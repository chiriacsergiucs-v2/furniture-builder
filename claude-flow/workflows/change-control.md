# Workflow: change control and disagreement

Triggered by: a new user instruction that conflicts with an ADR; a proposal to change a shared contract
(types, Dexie schema, backup format, registry interface, objective order, FurnitureModel shape); a vendor
dimension/mapping question; a failed validation that someone proposes to "fix" by loosening the check.

## Authority order (from `memory/decision-guardrails.json`)
1. New explicit user decision in the current conversation
2. Confirmed consensus recorded in an ADR as Accepted
3. Accepted ADR / written spec
4. Executed code and tests on `main`
5. Earlier discussion (docs/handoff.md history)
6. Unconfirmed proposal

Implemented code is evidence of *state*, not permission to overrule product intent recorded above it.

## Steps
1. **Name both sides.** Quote the existing ADR (ID + sentence) and the proposed change.
2. **Classify.** Supersede (new ADR, old one marked Superseded with link), amend (same ADR, new "Decided" date and
   note), or reject.
3. **Owner.** Only `architecture-authority` writes the ADR change. Proposing roles attach EDC reasoning.
4. **Data-safety veto.** `storage-migration` may block any change that deletes, rewrites-on-read or overwrites
   user records (ADR-0004, ADR-0006, ADR-0022). The block can only be lifted by a new explicit user decision.
5. **Manufacturing veto.** `optimisation-engineer` and `furniture-domain` may block any change that turns
   supplier ABS-inclusive finished sizes into cut sizes without a signed-off transform (ADR-0010, ADR-0026), or
   that invents physical/hardware facts (ADR-0019).
6. **Record.** Update `architecture/decisions/README.md` index and lineage, `requirements/traceability.json`,
   and `evidence/conflicts.md` (resolved or still open). Run `scripts/validate.py`.
7. **Unresolved** contradictions stay listed in `evidence/conflicts.md` as OPEN with both sources; agents treat
   the affected area as BLOCKED, not as free to choose.

## Things that are always change-control, never "minor"
- Any network call, token, key, SDK with telemetry, or CDN asset (ADR-0002, ADR-0027).
- Editing an existing Dexie `version(n)` block (ADR-0005).
- Changing lexicographic objective order or kerf semantics (ADR-0008, ADR-0011).
- Promoting a `planned` template or marking B24 complete (ADR-0020, ADR-0021).
- Committing native Claude Flow/Ruflo files (ADR-0030).
