# ADR-185: Assembly steps: print language, drawings, fasteners and hardware at the right step

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-174, ADR-074, ADR-157
- Design: docs/ui-design.md (section 4, results tabs; print sheets)
- Backlog: N188
- Agreed: 2026-11-05 "Re-check assembly steps, both ui and pdf, they seem to not have the expected assembly relevant info and steps."
  Answers: "Print language bug", "Drawing per piece in print", "Fasteners per step", "Hardware at the right step"

## Context

The user, 2026-11-05: **"Re-check assembly steps, both ui and pdf, they seem to not have the expected assembly
relevant info and steps."** Re-checked on main d64e817 (Assembly tab and printed sheet, a base cabinet and a chest of
drawers):

- the Romanian print shows part and hardware names in English (`src/ui/Assembly.tsx:326`, `:335` print raw labels);
- a project's print has no drawing; the front view prints only for a single design (`Assembly.tsx:297`);
- a step says "2 carcass joints" but never which fastener or how many, although ADR-074 counts them and the user
  names fasteners (Materials › Fasteners, `FastenerChoice`: name and how many per joint); back fixings, feet and
  hanging points are absent;
- runner pairs appear only at Drawer boxes and hinges only at Doors and fronts; nothing fits the runner halves and
  hinge plates to the sides before the carcass is closed, and nothing fits the drawers and adjusts the fronts.

## Decision

1. **Print language.** Every part and hardware name on the printed sheet goes through the print language (`partRo`
   and the print-text table, ro/ru/en), as the parts CSV does (ADR-157).
2. **A drawing per piece.** Each piece's section of the print starts with its front view (the piece's own elevation,
   as the design editor draws it), for projects too.
3. **Fasteners per step.** Each step lists the fasteners it uses, counted per step from ADR-074's rules: carcass
   joints the step closes, back fixings (Back step, per back), feet (Plinth step, a piece on a plinth), hanging
   points (Hanging step, per bracket). With a chosen fastener the line is "{count × per} × {name}"; without one,
   "{n} {joints} — choose your fastener (Materials › Fasteners)". The per-step counts add up to the piece's ADR-074
   totals. Nothing is invented (ADR-010).
4. **Hardware at the right step.** A new step **Fit hardware to the sides**, before Sides to the bottom, lists the
   runner pairs (carcass halves) and hinges (mounting plates) of the piece; Drawer boxes keeps the runner pairs
   (drawer halves); a new last step **Fit drawers and doors, adjust the fronts** lists the doors and drawer fronts
   being hung. Each hardware line shows once with its quantity in each step that uses it, labelled which half.
5. App and print use the same steps; the step order stays guidance (ADR-010).

## Alternatives considered

- **Leave fasteners on the Shopping list only** — the assembly sheet would still not say what goes where. Not chosen.

## Scope

- In scope: `assemblySteps`, the Assembly tab, `PrintAssembly`.
- Out of scope: per-step 3D pictures (G-343); editing steps (G-344).

## Consequences

- Positive: the sheet says what to fix, with what, in which order, in one language.
- Negative / risks: two more steps per piece with doors or drawers.

## Done when

- [ ] The Romanian, Russian and English prints show part and hardware names in that language (tests)
- [ ] A project's print has a front view in each piece's section (tests)
- [ ] With a fastener chosen for carcass joints (per 2), Sides to the bottom of a base cabinet lists "4 × {name}";
      without one it says "choose your fastener"; per-step counts sum to the ADR-074 totals (tests)
- [ ] A base cabinet's steps start with Fit hardware to the sides (hinge plates) and end with Fit drawers and doors;
      a chest's runner pairs appear in the side step and in Drawer boxes (tests)
- [ ] Assembly tab → "Fit hardware to the sides" and a fastener line at 390 and 1280 px (jsdom find-it)
- [ ] Russian entries for every new text; print texts in ro, ru and en
