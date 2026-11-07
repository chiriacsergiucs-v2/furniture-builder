# ADR-217: Add a Rejected status and close the four won't-do ADRs

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-050, ADR-082
- Design: n/a
- Backlog: N222

## Context

User, 2026-11-07: "Settle all deferred". Four ADRs sat in `docs/adr/` as Deferred with no way to close them, because
ADR-050 allows only `Pending`, `Deferred (<reason>)` and `Implemented`:

- ADR-027 (catalog page brand facet), ADR-029 (catalog feed and PDF extraction) and ADR-052 (run the catalog feed):
  the user already decided "won't do" (no access to IKEA data, 2026-10-24 and 2026-10-25).
- ADR-063 (supplier price feeds, live stock, online ordering): blocked on a paid supplier and a change to ADR-002.

Answers (user, 2026-11-07, interactive question): ADR-027, ADR-029, ADR-052 → "Close as Rejected"; ADR-063 →
"Close as Rejected" (prices stay the user's own list, ADR-062, and the seller exports, ADR-161 and ADR-172; orders
stay the shopping-list file, ADR-064).

## Decision

- A new ADR status `Rejected (<reason>)`: the user decided not to build it. A rejected ADR moves to
  `docs/adr-done/` like an implemented one; it is never built and does not count as a met dependency.
- ADR-027, ADR-029, ADR-052 and ADR-063 get `Rejected (<reason>)`, move to `docs/adr-done/`, and every link to them
  is fixed. What ADR-027 already built (the Catalog page, as amended by ADR-032) stays; only its brand facet is
  rejected.
- `scripts/check-docs.py` accepts `Rejected (<reason>)` in `docs/adr-done/`; `scripts/sync-pending.mjs` counts only
  `Implemented` ADRs; `next-adr.sh` treats only an `Implemented` dependency as done.
- Backlog: N16 and N58 become Dropped, N14 becomes Done (its remaining brand facet is rejected), D02 (ADR-029) says
  Rejected. Gap G-009 (ADR-063's gap) becomes Done (rejected); G-312's text names ADR-063 as Rejected.

## Alternatives considered

- **Leave them Deferred** — the user asked to settle them.
- **Delete the files** — loses the reasons and breaks links in implemented ADRs.
- **A separate `docs/adr-rejected/` folder** — one more folder for every script to read, for four files.

## Scope

- In scope: the status, the checker and script changes, the four moves, links, backlog rows and gaps above.

## Consequences

- Positive: `docs/adr/` holds only work still to do; the reasons stay readable.
- Negative / risks: G-009's offline middle step (supplier price-file column maps) closes with ADR-063; a new request
  reopens it as a new ADR.

## Done when

- [ ] `pnpm docs:check` passes with the four ADRs in `docs/adr-done/` as `Rejected (<reason>)`, and fails on a
      Rejected ADR left in `docs/adr/` (checked by hand).
- [ ] `tests/sync-pending.test.ts` passes (rejected ADRs are not listed as uncited).
- [ ] `next-adr.sh` runs and reports no next ADR besides ADR-217 itself.
- [ ] README conventions, the template comment and the index rows name the new status.
