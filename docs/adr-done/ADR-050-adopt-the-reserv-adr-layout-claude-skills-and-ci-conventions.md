# ADR-050: Adopt the reserv ADR layout, Claude skills and CI conventions

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24: "reserv is the model" for the ADR format, the skills and CI; rename the old ADRs and fix the links
- Depends on: none
- Design: n/a
- Backlog: N45

## Context

The user works on two repositories, `alin-obedea/reserv` and this one, and saw "different
configuration on flows" between them. reserv plans work as ADRs in `docs/adr/` →
`docs/adr-done/` (`ADR-NNN`, Pending / Deferred / Implemented), runs each lifecycle step as
a Claude skill in `.claude/skills/` (`new-adr`, `next-adr`, `ship-adr`, `verify`, …), keeps
its rules and a Commands table in `CLAUDE.md`, and runs CI on pull requests and on pushes
to `main`. This repository used `claude-flow/`: runtime-neutral contracts (ADR-017), six
agent roles, `tasks/tasks.json`, `ADR-NNNN` files in one folder with Accepted / Approved /
Proposed / Superseded, `AGENTS.md`, and CI on every push. Asked which repository is the
model, the user chose reserv for all three: ADR format, skills and CI.

This ADR replaces ADR-017 (contracts in `claude-flow/`) and changes where ADR-016's process
rules live; the rules themselves are unchanged.

## Decision

- **ADRs** move to `docs/adr/` (pending) and `docs/adr-done/` (implemented) as
  `ADR-NNN-short-kebab-title.md`, with reserv's header lines and template. Ids are renamed
  `ADR-00NN` → `ADR-0NN` everywhere (code, tests, docs, visible notes). Status mapping:
  Accepted → Implemented (date from the commit that accepted it); Approved → Pending
  (ADR-027 depends on ADR-029 for its brand facet); Proposed → Deferred with its reason
  (ADR-047). Bodies are kept as written; Owning role lines are dropped with the roles.
- **`CLAUDE.md`** is the project guide: stack, layout, Commands table, ADR lifecycle, hard
  rules (from the guardrails and role gates), delivery rules R1–R4 and the standing process
  rules. `AGENTS.md` points to it.
- **Skills** in `.claude/skills/`: reserv's `new-adr`, `next-adr`, `ship-adr` and `verify`
  with their helper scripts unchanged; `review`, `debug`, `add-tests`, `implement-design`
  and `design-review` rewritten for this app; `add-storage-version` in place of reserv's
  `add-migration` (Dexie and the design document). Change control lives in `new-adr`, the
  implementation iteration in `next-adr`, the verifier and release gates in `review`,
  `verify` and `ship-adr`.
- **Retired:** `claude-flow/` (roles, workflows, `tasks.json`, guardrails, `validate.py`).
  `docs/backlog.md` stays the single ledger. Project memory moves to
  `docs/product/product-context.md`, the overview to `docs/architecture.md`.
- **Docs check:** `scripts/check-docs.py` (`npm run docs:check`) replaces `validate.py`.
- **CI** runs on pull requests and on pushes to `main`, in the Commands table order. The
  Pages deploy is unchanged.

## Alternatives considered

- **Make reserv follow `claude-flow/`** — rejected by the user; reserv has two developers
  and a working skill set.
- **Keep the old ADR files and use the new layout only for new ADRs** — rejected by the
  user: two numbering schemes side by side.
- **Keep `tasks.json` next to the ADRs** — rejected: two plans to keep in step; the backlog
  already records evidence.

## Scope

- In scope: ADR files and index, `CLAUDE.md`, `AGENTS.md`, skills, docs check, CI, README.
- Out of scope: app behaviour; reserv itself; pnpm, Prettier or Node 24 (the stacks differ).

## Consequences

- Positive: one way of working in both repositories; the same skill names do the same step.
- Negative: branches without a pull request get no CI run; ADR-001 to ADR-049 keep their
  old sections and have no `Done when` list (`next-adr` writes one before building).
- Implemented ADRs still mention `claude-flow/` and `AGENTS.md` paths as history.

## Done when

- [x] Every ADR is in `docs/adr/` or `docs/adr-done/` with the reserv header; no `ADR-NNNN` id is left
- [x] `npm run docs:check` passes and runs in CI
- [x] `CLAUDE.md` holds the Commands table, hard rules, R1–R4 and process rules; `verify.sh` runs it
- [x] The ten skills exist; `new-adr.sh` and `next-adr.sh` work on this repository
- [x] CI triggers match reserv; lint, typecheck, tests and build pass
