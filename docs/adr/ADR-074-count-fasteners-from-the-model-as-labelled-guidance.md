# ADR-074: Count fasteners from the model as labelled guidance

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-010, ADR-064
- Design: docs/ui-design.md (Output › Hardware, Shopping list)
- Backlog: N69

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Hardware/fastener completeness_ (rank 25, P2) with detailed BOM and deduplication. The app lists
hardware as a labelled schedule ([ADR-010](../adr-done/ADR-010-hardware-is-a-schedule-with-labelled-guidance-never-invented.md)) and has one shopping list with "to choose before buying"
([ADR-064](../adr-done/ADR-064-one-shopping-list-for-a-project-including-what-is-still-to-ch.md)); fasteners are not counted. The research's "generated hardware" conflicts with ADR-010, which
forbids invented specs; this ADR counts, it does not specify.

## Decision

- **Counts come from the model:** carcass joints (each side-to-top/bottom joint), fixed shelves, adjustable
  shelves (4 pins each), back panels (perimeter), plinth/feet positions, wall-hung units (hanging points), worktop
  fixing points per run. Pure function `fastenerCounts(model)`.
- **Specs come from the user:** a _Fasteners_ list in Materials where the user names what they use per joint
  type (for example "Confirmat 7 × 50", "dowel 8 × 35", per joint count). Until set, the line reads "Joint
  fixings: 48 joints — choose your fastener" in _to choose before buying_.
- Lines are labelled **guidance**; the shopping list combines equal lines across the project (dedupe).
- No screw lengths, spacings or loads are filled in by the app (ADR-010).

## Alternatives considered

- **Ship a default fastener per joint** — invents specs (ADR-010).
- **Leave fasteners out** — the research names missing hardware as a top "cannot be built" frustration.

## Scope

- In scope: joint counting, the user's fastener list, guidance lines, dedupe.
- Out of scope: drilling patterns for fasteners, CNC output.

## Consequences

- Positive: the shopping list stops forgetting the small parts.
- Harder to change later: the fastener list is saved on the device (new Dexie table or a settings row: decided
  in implementation with the `add-storage-version` skill). Implementation: one row per joint type in the existing
  `prices` table (id `fastener:<joint type>`, the user's name and count per joint), so no new Dexie version; price
  lists and price files skip these rows, and a price file cannot overwrite them.

## Done when

- [ ] Joint, pin, hanging and fixing counts match hand counts for each template (unit tests)
- [ ] Without a chosen fastener the line is in _to choose before buying_; with one it is a counted line
      (unit tests)
- [ ] _Fasteners_ is found in Materials and the lines in the Shopping list (find-it at 390 px and 1280 px)
- [ ] All CI checks pass

## Open questions

- Joint types to count separately — default: carcass joint, shelf pin, back fixing, hanging point, worktop
  fixing, foot.
