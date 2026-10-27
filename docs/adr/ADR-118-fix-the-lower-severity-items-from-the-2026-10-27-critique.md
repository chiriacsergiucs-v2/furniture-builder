# ADR-118: Fix the lower-severity items from the 2026-10-27 critique

- Status: Deferred (open question G-145: the proposed fixes are not agreed yet)
- Date: 2026-10-27
- Depends on: ADR-112
- Design: docs/ui-design.md (sections 3 and 4)
- Backlog: N116
- Acceptance: browser
- Agreed: 2026-10-27 "accept gap picks" (G-139 "One follow-up ADR for all of them")

## Context

Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). The lower-severity items were not picked to build first (G-139); the user, 2026-10-27, accepted G-139's pick: one
follow-up ADR for all of them. Each fix below is the critique's proposal, not yet agreed (G-145).

## Decision (proposed, G-145)

1. Plan toolbar: Snap and Select become checkboxes like Fronts and Clear. (one toggle style per row).
2. Desktop: Width and Depth show once, in the panel's Selected piece card; the inspector's copy goes.
3. Projects rows at ≤ 520 px: the three icon buttons fold into one ⋯ menu, so names fit one line.
4. The editor's name field ends in an ellipsis when cut.
5. "Back to the editor" gets a left chevron and shows only when a design is open.
6. No ADR numbers in UI text.
7. Romanian names move from English descriptions to their own "RO:" line.
8. Projects: "Import a file" moves beside "New"; "Fill a wall" shows once (in the New dialog).
9. "front faces you" joins the Turn label ("Turn · front faces you").

## Alternatives considered

- **Leave them** — not chosen (G-139 pick).

## Scope

- In scope: the nine fixes above and a browser find-it script.

## Consequences

- Positive: the critique's remaining items are closed.
- Negative / risks: small visible changes on several screens.
- Harder to change later: nothing.

## Done when

- [ ] Each of the nine items is visible as described at 390 (touch) and 1280 px.
- [ ] Find-it passes from the bare app at phone and desktop widths (`tools/critique-low/find-it.mjs`, production
      build).

## Open questions

- Accept the nine proposed fixes as written, or change any? Until answered this ADR is Deferred. G-145.
