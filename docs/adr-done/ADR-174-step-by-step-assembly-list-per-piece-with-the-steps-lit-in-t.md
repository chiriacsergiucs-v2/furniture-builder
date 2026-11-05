# ADR-174: Step-by-step assembly list per piece with the steps lit in the exploded 3D view

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-05
- Depends on: ADR-010, ADR-074, ADR-122, ADR-157
- Design: docs/ui-design.md (section 4, Build & Preview results)
- Backlog: N177
- Acceptance: browser
- Agreed: 2026-11-04 "Now do the high appreciation features, similar way"; answer "Ordered step list + 3D highlight"

## Context

The research feature _Step-by-step assembly sequence_ (rank 30, appreciation "High for DIY", complexity Very high,
P2) is not started. The paper warns that a correct sequence "needs explicit knowledge of assembly relationships —
joints, hardware and ordering — that geometry alone does not give" and not to imply manufacturability. What the app
knows: every panel's role and box (ADR-004), which panels touch and how (`contactAxis`, ADR-074's joint counts),
the hardware schedule (ADR-010) and an exploded 3D view. ADR-010 forbids inventing screw, dowel or drilling specs.
User (2026-11-04): an ordered step list plus a 3D highlight.

## Decision

- **Steps from the model, labelled guidance.** Pure `src/core/assembly.ts`: `assemblySteps(model)` orders a
  piece's panels by role and contact into steps, each with its parts (names, sizes, quantities), the joints it
  closes (the pairwise contacts ADR-074 counts, by joint type, e.g. "4 carcass joints") and the hardware scheduled
  on its parts (hinges, runners, pins — counts only, as the schedule names them). Order: bottom (or plinth frame
  when the plinth is part of the carcass) → sides → fixed dividers and fixed shelves → top (or top rails) → back →
  plinth → adjustable shelves → drawer boxes → fronts and doors → handles; a panel set (ADR-041) and frame furniture
  (ADR-038) get one step "loose parts" with no order claimed. A part the rule cannot place goes last under "also".
  Every sheet and screen carries **"Guidance: order from the parts' positions; your joints, fasteners and drilling
  decide"** (ADR-010). No fastener names, lengths or torques; the user's own fastener list (ADR-074) is quoted per
  joint type when set.
- **Assembly tab:** a sixth results tab **Assembly** (`Tab` 'assembly', after Hardware) for a piece or each piece of
  a project (one section per piece, linked copies once with "× N"). Each step: number, title ("Sides to the
  bottom"), parts, joints, hardware, and **Show step**.
- **Show step** lights the step's parts in the 3D view: the viewer gets a viewer-only `litIds` set (as Isolate's
  set, ADR-122): lit parts keep their colour, the rest go translucent; with **Exploded 3D** on, the step is read
  best. The next and previous step move with ← → on the tab. Nothing in the model changes (ADR-014).
- **Print:** the tab prints as a sheet (`pt()` texts, Romanian by default, ADR-157: "Fișă de asamblare") with the
  piece's front view and the steps; the parts CSV is unchanged.
- Research record: _Step-by-step assembly sequence_ becomes Verified with the note "order from geometry, labelled
  guidance; no joint or fastener knowledge (ADR-010)".

## Alternatives considered

- **Step list only** — the user chose the 3D highlight too.
- **Per-step exploded pictures in the print** — needs the renderer for print; the front view with the step's parts
  marked is the slice (G-343).
- **An editable sequence** — the user reorders or renames steps; not asked for (G-344).

## Scope

- In scope: `assembly.ts`, the tab, Show step with ← →, the print sheet, tests over every catalog template (every
  panel appears in exactly one step; order rules hold), browser find-it for the 3D highlight.
- Out of scope: per-step pictures in print (G-343); editing the sequence (G-344); project-level steps (which piece
  first, worktops, run parts: G-345).

## Consequences

- Positive: a DIY builder gets an order to follow, traceable to the parts list; the research row closes.
- Negative / risks: the order is a heuristic from positions; the guidance line and ADR-010 keep it honest. The
  viewer gains one more highlight mode beside Isolate.
- Harder to change later: the step titles become print text in three languages.

## Done when

- [x] For every catalog template, every panel is in exactly one step; bottom before sides before top before back
      before fronts; drawer boxes before their fronts; adjustable shelves after the carcass (tests)
- [x] Joint counts per step sum to ADR-074's counts for the piece; hardware counts match the schedule (tests)
- [x] The guidance line is on the tab and on the printed sheet in ro, ru and en (tests)
- [x] Assembly tab lists the steps for a piece and per piece in a project; Show step lights the parts in 3D and
      ← → move (browser find-it, 390 and 1280 px, production build)
- [x] Russian and print entries for every new text; the feature tree gains "Assembly steps" (ADR-158)
