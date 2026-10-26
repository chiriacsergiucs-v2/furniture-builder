# ADR-100: Compatibility rules as data, checked when snapping and in project checks

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-035, ADR-070
- Design: docs/ui-design.md (Plan view)
- Backlog: N98
- Agreed: 2026-10-26 "New adr 3"; answer "Any difference warns"

## Context

The user, 2026-10-26: "New adr 3". Item 3 of the fit review: _Compatibility-rule engine preventing invalid
connections_ (rank 2, value 5.0, P0, In Progress, missing "product-family, dimension and exclusion rules for
connections"; merged into it: _Connector compatibility rules_ and _Interface capabilities instead of brand checks_).
The paper: "Compatibility should consider product family, dimensions, connector types, structural rules and
exclusions" (line 126) and "treat constraints as explainable domain data rather than hidden code" (line 556).
Today [ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md) holds three snap rules in code (side-only, same mount, back to wall) and the rules registry
([ADR-035](../adr-done/ADR-035-construction-guidance-is-a-rules-registry-keyed-by-part-role.md)) checks single pieces. Connections are not stored.

## Decision

- **Rules as data** in `src/core/compat.ts`: each rule has an id, what it applies to (product kind, catalog family
  function, placement kind), a check (named predicate with parameters), a severity (`refuse` for snapping, `warning`
  for checks), the text shown, and the repairs that may fix it (ADR-071 ids).
- **Rules shipped:** the three ADR-070 rules (moved, same behaviour); **depth match** — touching side-by-side floor
  units of different depths (warning, names both depths); **height match** — touching base units of different
  heights under one run worktop (warning); **family** — pieces whose families do not share a room group are not
  snapped side by side (refuse, e.g. a bed against a kitchen base). Interface capabilities: rules test what a piece
  is (kind, function, placement), never a brand.
- **Where they run:** while snapping (refuse removes the candidate with "Won't snap to …: <rule text>"; warnings are
  named in the preview), and in project checks for touching pieces as warnings (ADR-008; they never block export).
- **Inspectable:** Configure › Rules lists every rule with its text, what it applies to and its severity.
- Pure and deterministic; the snap ranking of ADR-070 is unchanged.

## Alternatives considered

- **Stored connections with rule status** (research model) — needs persistent connections first (G-091).
- **Rules in each template** — rejected by ADR-035 (a registry keyed by role).

## Scope

- In scope: rule table, the five rules, snap and check integration, the Rules list.
- Out of scope: persistent connections (G-091); rules the user writes (G-092).

## Consequences

- Positive: invalid combinations are refused while placing and explained.
- Negative / risks: the family rule could refuse a joint the user wants; Alt still places freely (ADR-070).

## Done when

- [ ] The three ADR-070 rules behave as before (existing snap tests pass unchanged)
- [ ] Depth, height and family rules: refuse/warn as stated, with the rule text (unit tests)
- [ ] Find-it at 1440 and 390 px: drag a bed next to a kitchen base → "Won't snap to … " names the family rule;
      two base units of different depths → Checks shows the depth warning; Configure › **Rules** lists the rules

## Answers (2026-10-26)

1. Any depth or height difference warns; no tolerance until the user names one (user, 2026-10-26). The question is closed (G-093).
