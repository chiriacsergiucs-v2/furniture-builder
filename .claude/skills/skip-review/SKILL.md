---
name: skip-review
description: Review every item that was skipped, deferred or left "not started" in a piece of work (a branch, a pull request, an audit, a reply's "Skipped this iteration"), find out why each was skipped, cross-examine that reason against the code, classify it, name the decision faults behind the skips, and propose behaviour rules and a re-plan. Analysis only. Use when the user asks "why did you skip X", "did we cover it all", "review the skips", "cross-examine your decisions", or when a reply is about to list skipped items. Do not use when reviewing a change against its ADR or the hard rules (use review).
---

# Review the skips

Project: **Furniture Builder**. Origin: the user's review of the 2026-11-09/10 cleanup skips (EDC'd into this skill,
2026-11-10). It enforces CLAUDE.md › Process › _Skips and proof_. **Analysis only:** no code, docs or settings change,
nothing is merged; proposals wait for the user.

Every claim carries its evidence and its kind: **ran** (a command or test you ran, with its output) or **read** (a
file and line). Never accept a skip because a document says it was justified.

## Stages

The stages run in order by default ("run all"); any one can be run alone (`RUN FLOW NN`). Stop after the last stage
asked for.

### RUN FLOW 01 — Inventory

- Inputs: the work under review (branch diff, pull request, audit, backlog rows, ADR _Out of scope_ and _Skipped_
  lists, the last replies' **Skipped this iteration**).
- Output: a table: id, item, where it was skipped (file:line), the reason word for word. Include implicit skips:
  "not started", "later", items in a plan that never got built, checks that were stopped before finishing.

### RUN FLOW 02 — Reasons and evidence

- Output per skip: the stated reason, the evidence it relied on (ran or read), and what that evidence did not
  cover (for example one segment of nine, a script that failed before reaching the step).

### RUN FLOW 03 — Cross-examination

- Output per skip:
  - the strongest case against skipping;
  - a check against the code (ran or read);
  - one class: **valid**, **premature** (a cheap proof existed), **wrong** (the reason does not match the code),
    **avoidance** (no blocker; breaks R2), **needs consent** (deleting, branch-wide moves, a user decision) or
    **blocked (external)** (access, credentials, another person);
  - for premature and avoidance: the cheapest proof or fix and its size (S/M/L).

### RUN FLOW 04 — Patterns

- Output: 3–6 recurring decision faults, each tied to the skips that show it.

### RUN FLOW 05 — Rules and re-plan

- Output:
  - rules that would have prevented the faults, each with how a reviewer checks it; **compare each with the rules
    already in CLAUDE.md** and propose only new ones or sharper wording;
  - a re-plan in dependency order, split into **do now (low risk)** and **needs consent**, each with its size.
- Proposal only: do not edit CLAUDE.md or build anything unless the user then asks.

## Reply

Lead with the answer to "did we cover it all": yes, or the count of items not done. Then the stages asked for,
tables for inventories, one line per verdict.
