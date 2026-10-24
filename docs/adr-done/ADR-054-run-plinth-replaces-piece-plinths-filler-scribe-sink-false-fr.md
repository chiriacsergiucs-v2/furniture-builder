# ADR-054: Run plinth replaces the pieces' own plinths; filler scribe allowance; sink false front

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-036
- Design: docs/ui-design.md (project panel → Run parts; Inspector → drawers)
- Backlog: N51

## Context

Research features _Automatic fillers, plinths/toe-kicks, end panels and trim_ (rank 14, value 4.6, P1; IKEA, Coohom)
and _Generated shared components_ (value 4.5; Roomle, Coohom). ADR-036 decided run-level filler, cover, plinth and
worktop. `suggestRunParts` in `src/core/project.ts` builds worktop, fillers and covers but **no run plinth**, because
every cabinet draws its own plinth (`cabinet.ts`, role `plinth`) and a run plinth would be doubled. N26 lists the
open gaps: no run plinth, no scribe allowance, sink false front not built.

## Decision

- **Run plinth.** For each run of two or more cabinets (floor base units side by side, gaps ≤ 150 mm) whose
  **sides stand on their bottom** (Bottom → _Under the sides_), the suggestion adds one `RunPart` of kind
  `'plinth'`: the run length, the height and setback of the run's pieces, board = the pieces' body board. Its `from`
  ids name the pieces whose own `plinth` panels the project build leaves out (cut list, sheets, 3D); the pieces keep
  their outline and height. With sides down to the floor a continuous plinth would cut through them, so those runs
  keep their own plinths and the run-parts list says why.
- **Different plinths in one run** (height, setback or board differ): no run plinth for that run, and a note names
  the pieces and the values. Nothing is averaged (ADR-008).
- **Scribe allowance.** A project setting _Scribe allowance for fillers_ (mm, default **0**). Each filler is cut that
  much wider (the model keeps the installed size); its reason says "gap 37 mm + 20 mm scribe". No value is
  invented (ADR-010).
- **Sink false front.** A drawer front can be marked _Fixed front (no drawer)_ in a cabinet space: the front panel
  stays, the drawer box and runners are left out, and the hardware schedule lists "front fixing — user-specified"
  (ADR-010). Optional field on the space, absent = today's behaviour; no schema bump.
- Run parts stay listed with a reason, removable one by one, and undoable (ADR-051).

## Alternatives considered

- **Keep piece plinths and add none at run level** (today) — a run of pieces has visible joints in the plinth and
  the paper's "Add plinth works like Add countertop" is not met.
- **Shorten each piece's plinth instead** — still one board per piece; does not give the single toe-kick users cut.

## Scope

- In scope: run plinth, filler scribe allowance, fixed top drawer front.
- Out of scope: worktop joints and cut-outs, corner runs.

## Consequences

- Cut list: n piece plinths become one run plinth (split by the stock length if longer than a board, as worktops are).
- Removing the run plinth gives the pieces their own plinths back (nothing else to keep in step).

## Done when

- [x] One run plinth of the run length replaces the three piece plinths in the project cut list (`tests/run-parts.test.ts` "a run of three base units gets one plinth…")
- [x] Different plinth heights, setbacks or body boards → no run plinth and a note naming each piece and its value (`tests/run-parts.test.ts`, three tests)
- [x] Scribe 20 mm cuts the filler 20 mm wider; the model keeps the installed size (`tests/run-parts.test.ts`)
- [x] A fixed front keeps the front panel and drops the drawer box and one runner pair; fixing listed as user-specified (`tests/run-parts.test.ts`; fuzz covers `fixedTop`, 30,000 deep run passed)
- [x] Seeded project fuzz: no run part overlaps a piece and every run plinth spans its run when the project has no errors (`tests/run-parts.test.ts` "run parts, seeded project fuzz")
- [x] find-it `tools/ensemble/find-it-adrs.mjs` (80/80, 1440 and 375 px): **Suggest worktop, plinth, fillers and covers** lists **Plinth**; the Parts CSV has one _Run: Plintă_ row of 1800 mm; the fixed-front fixing shows in Hardware

## Answers

1. _Should the run plinth replace the pieces' own plinths?_ — **Yes; the pieces' plinths are left out while the run
   plinth exists.**
2. _Scribe allowance default?_ — **0 mm, set by the user per project** (no invented value).
3. _What if plinths in a run differ?_ — **No run plinth for that run, warning with the values.**
4. _Build the sink false front now?_ — **Yes, as a fixed drawer front with user-specified fixing.**

## Implementation notes

`src/core/project.ts` `planRuns`: a run plinth (kind `plinth`, key, `from`) only where every piece is a cabinet whose **sides stand on the bottom** (Bottom → _Under the sides_): with sides to the floor, a continuous plinth would cut through them — this condition is added to the decision, and the run-parts list says why a run got no plinth. Instead of a `plinthFromRun` item flag, the pieces covered are the plinth's `from` ids (`plinthCovered`), so removing the plinth gives the pieces their plinths back with nothing else to keep in step. `placeItem` keeps the piece's full outline when its plinth is left out. Scribe allowance (_Scribe allowance for fillers_, default 0) widens **fillers** in the cut list only; covers stay as they are. Fixed front: `DrawersSpace.fixedTop` in `src/core/cabinet.ts`, Inspector toggle _Top drawer is a fixed front (sink false front)_, hardware line _Fixing for the fixed (false) front — user-specified_. Tests: `tests/run-parts.test.ts`, fuzz covers `fixedTop` (3,000 seeded; 30,000 deep run passed). find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60. After review: the run plinth also needs the same body board; every note names the pieces and their values; a run part made for a removed piece, or a run plinth whose length no longer matches its pieces, is an error (`run-part-stale`) while automatic refresh is off.
