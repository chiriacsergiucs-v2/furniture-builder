# ADR-187: Gaps page: work, impact and necessity ratings, an issue and a fix line, and an ADR check per gap

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-082, ADR-101
- Design: docs/ui-design.md (section 4, Gaps page)
- Backlog: N191
- Agreed: 2026-11-05 "Iterate over all gaps, do a rough estimate of work/impact/necessity. Update the page to include
  these as filters (similar to features page with high/high-medium and so on). Then run a /batch validation per gap
  that it does not contradict any preexisting adr, add a 1 line of issue description and a 1 line of fix
  description, visible within the listing page."

## Context

The user's words are in _Agreed_ above. The gaps ledger (`docs/adr/GAPS.md`, ADR-082) has Origin, Missing, Request,
Questions and Suggested pick per gap; the Gaps page (ADR-101) filters by status only. The Research page already rates
on the scale Low, Low-medium, Medium, Medium-high, High (`src/core/research/types.ts`).

## Decision

1. Each open or acknowledged gap gets six fields in `GAPS.md`, written by a rated pass (rough estimates, labelled as
   such):
   - `Work:`, `Impact:`, `Necessity:` — one of Low, Low-medium, Medium, Medium-high, High;
   - `Issue:` — one line: what is wrong or missing, in plain words;
   - `Fix:` — one line: what would close it;
   - `Conflicts:` — `none`, or the implemented ADR(s) the gap's fix would contradict, with why (checked against
     `docs/adr-done/`).
2. `scripts/gaps.py` (add) and `scripts/check-docs.py` accept the fields; a rating outside the scale is an error.
3. The Gaps page shows the Issue and Fix lines and the three ratings on each row, and adds filters for Work, Impact and
   Necessity (multi-select chips on the five levels, as on the Research page), combined with the status filter and
   search. A Conflicts value other than `none` shows as a marked chip. The page stays English (ADR-154).
4. New gaps added later carry the fields too (`pnpm gaps add` options).

## Alternatives considered

- **Store ratings on the device only** — not shareable and lost on another device. Not chosen.

## Scope

- In scope: the six fields for every open and acknowledged gap (not the archived Done ones), the scripts, the Gaps page
  filters and rows.

## Consequences

- Positive: gaps can be picked by impact and work; contradictions with built ADRs are visible.
- Negative / risks: estimates are rough and go stale; a later sync re-rates only what `pnpm sync:pending` lists.

## Done when

- [ ] Every open and acknowledged gap has Work, Impact, Necessity, Issue, Fix and Conflicts; `pnpm docs:check` refuses
      a rating outside the scale (tests)
- [ ] Gaps page → Impact: High → only high-impact gaps, each row with its Issue and Fix lines at 390 and 1280 px
      (jsdom find-it)
- [ ] A gap with a conflict shows its Conflicts chip (jsdom find-it)
