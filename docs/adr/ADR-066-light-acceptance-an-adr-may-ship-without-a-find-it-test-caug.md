# ADR-066: Light acceptance: an ADR may ship without a find-it test, caught up later

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-050
- Design: n/a
- Backlog: N61

## Context

The user asked (2026-10-24): "Can i strip down playwright and find it and other time-consuming things for a adr?",
then "Can i run them retroactively later?", and agreed to a per-ADR opt-out with a backlog marker and a later
catch-up run ("yes, write that ADR").

The Delivery rules in `CLAUDE.md` (R1–R4, from `docs/retros/2026-10-23-catalog.md`, kept there by
[ADR-050](../adr-done/ADR-050-adopt-the-reserv-adr-layout-claude-skills-and-ci-conventions.md)) make a find-it test
(`tools/*/find-it.mjs`, Chromium on the production build at phone and desktop widths) part of every visible
change. Writing a new script per feature is the slowest step; running it needs a build, a preview server and
a browser. CI does not run it. ADR-065 already shipped with "find-it skipped on the user's instruction" (N60),
with no rule saying how that gap gets closed.

This ADR changes the user rule R3 (the user's decision outranks it). It does not change R1, R2 or R4.

## Decision

- **Opt-in per ADR.** The ADR header gets an optional line `- Acceptance: light`. With no line (or
  `full`), R3 applies as today. Only the user sets `light`, when the ADR is written or before it is built.
- **A light ADR skips:** writing or running a find-it script, starting `pnpm preview`, and any Chromium or
  Playwright run. Its `Done when` list keeps the find-it items, marked `(light — catch-up)`.
- **A light ADR still needs:** every CI check (lint, format, typecheck, test, build, docs:check); a unit
  test for each `Done when` item that can be tested without a browser; the deep fuzz after geometry changes;
  the R1 ledger, with each visible requirement marked _not checked in a browser_.
- **No softened status (R2).** A light ADR's backlog row stays **Partially done**. Its gap reads exactly
  `find-it pending (light, ADR-066)` and names the visible text the test must find. `ship-adr` may ship the ADR;
  the backlog row turns **Done** only after the catch-up.
- **Catch-up when the user says so.** "Catch up acceptance" lists every backlog row carrying the marker. The
  agent writes the missing scripts, one per area or one shared script as in `tools/ensemble/find-it-adrs.mjs`,
  and runs them against the production build of `main`, or against the live URL when it is reachable
  (`node tools/<area>/find-it.mjs <url> <out dir>`). Passing rows turn Done, with the result as evidence.
  A failure becomes a fix under its own backlog row; the marker stays until that fix passes.
- **Where the rule lives:** `CLAUDE.md` Delivery R3, `docs/adr/_template.md`, and the `new-adr`, `next-adr`,
  `implement-design`, `add-tests`, `verify`, `review` and `ship-adr` skills each get one line saying
  "skip for `Acceptance: light`; record the marker".

## Alternatives considered

- **Drop R3 for everything.** Fastest, but it brings back the retro's failure: built but not findable.
- **One generic find-it script (visible texts × 390 and 1440 px).** Cuts writing time, but every ADR still
  needs a build, a preview and Chromium. It can be added later as the catch-up tool.
- **Skip find-it with no marker.** This is what happened with ADR-065: nothing records the gap, so it is
  never closed.

## Scope

- In scope: the header line, the backlog marker, the rule text in `CLAUDE.md`, the template and the seven
  skills; `scripts/check-docs.py` accepts `- Acceptance: light|full` and flags a light ADR whose backlog rows
  have neither the marker nor Done; ADR-065 / N60 marked light retroactively.
- Out of scope: the catch-up run itself (the user triggers it); writing the generic script; changes to CI;
  the deep fuzz and catalog snapshot rules (unchanged).

## Consequences

- Positive: small or low-risk ADRs ship in one pass, with no browser tooling; the gap stays visible in the
  backlog until a real browser run closes it.
- Negative / risks: discoverability bugs are found after deploy, when the catch-up runs; markers can pile
  up. A new screen, tab or menu entry is where the retro's failure happened, so light fits those worst.
- Harder to change later: nothing; removing the line restores R3.

## Done when

- [x] `CLAUDE.md` R3 states the light exception and the `find-it pending (light, ADR-066)` marker.
- [x] `docs/adr/_template.md` documents the optional `- Acceptance: light` header line.
- [x] The seven skills each say what a light ADR skips and that it records the marker.
- [x] `pnpm docs:check` accepts `Acceptance: light|full`, rejects any other value, and fails when a light
      ADR's backlog row is Done without catch-up evidence or lacks the marker.
- [x] N60 (ADR-065) carries the marker; `pnpm docs:check` passes.
- [x] CI passes.

## Answers (2026-10-24)

The user accepted both defaults ("defaults are fine"):

- A new top-level screen, tab or menu entry may go light; the user decides per ADR, and the ADR states the risk.
- Every implementation reply lists the rows still marked `find-it pending (light, ADR-066)` in its status
  table; there is no automatic catch-up.
