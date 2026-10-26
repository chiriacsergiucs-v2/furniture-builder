# ADR-092: Mark research features the app has built and merge the remaining duplicates

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26 (App records, merges and page updates; review findings fixed)
- Depends on: ADR-043
- Design: n/a
- Backlog: N90
- Agreed: 2026-10-26 "In Progress + what's missing"; "Broad: same common idea"; "Yes, merge and deploy when green"

## Context

The user: "Resync with main, mark implemented ones, check the left ones for duplicates or same common idea, merge
if found, update the research page". Since ADR-043 (implemented) the Feature Research page tracked
implementation only as the user's own choice on a device. Meanwhile N46–N72 and others built many research features,
and each ADR names the research row it builds (e.g. ADR-070: _Guided connection snapping_, rank 1). Asked on
2026-10-26: partly built features are marked In Progress with what is missing; merges cover features with the same
common idea, not only exact duplicates; the PR is merged and deployed once green.

## Decision

- Each research feature can carry an `app` record (status, evidence, what is missing, date checked) in
  `src/core/research/ensemble-2026-10-23.app.ts`. Every status cites a backlog row or ADR. **Verified**: built and
  shipped with a find-it pass recorded in the backlog. **Implemented**: built and unit-tested, with no browser
  acceptance of its own. **In Progress**: partly built, and `missing` is required (validation). Features without a
  record are Not Started.
- The status shown is the user's when they set one on the page (stamped `implementationSetAt`; a non-default
  status saved before this ADR also counts), else the app's record. The feature page offers "Use the app's record".
  Imports never change it (ADR-043).
- Remaining features with the same idea are merged into one target (`mergedInto` + `mergeReason`), non-destructively:
  a merged feature stays in the data, is hidden from the list (shown with "Show merged"), and appears under
  "Merged into this" on its target with its own status. The user can undo a merge on a device. Only features the
  app has not built are merged; a target is never itself merged.
- The research page adds: a "Built in this app" summary at the top of the Overview; "Left to build" / "All
  features" on the assessment dashboard (default Left to build); a "Left to build only" filter; and a "This app"
  box on each feature page with evidence and what is missing. The status is shown in the list.

Result 2026-10-26 (after the review): 157 features, 31 merged, 126 shown — 69 Verified, 4 Implemented, 25 In
Progress, 28 Not Started (53 left to build). Verified and Implemented never carry a missing part; a merge target is
never a feature the app has built, so a merge never hides work left to do (both enforced by validation).

## Alternatives considered

- **Write the statuses into the user's decisions (IndexedDB)** — would overwrite or fake user decisions, and could
  not ship with the app.
- **Delete merged features** — loses evidence and breaks re-import (ADR-043).
- **Strict merges only** — rejected by the user ("Broad: same common idea").

## Scope

- In scope: app records for every built or partly built feature (98); 31 merges; page updates; tests.
- Out of scope: updating the app records automatically when a later ADR ships (G-076).

## Consequences

- Positive: the page shows what is left to build, from repository evidence, without touching user decisions.
- Negative / risks: the records go stale as new ADRs ship. The `next-adr`/`ship-adr` steps do not update them yet;
  each change to the research page must re-check them.
- Harder to change later: merges hide features from the default list; undoing one is per device.

## Done when

- [x] Every app record cites a backlog row or ADR, and In Progress names what is missing (`tests/research.test.ts`).
- [x] A status the user set wins over the app record, and imports never change it (tests).
- [x] Merges only take unbuilt features, with no chains and a reason, and merged features stay viewable (tests).
- [x] Find-it: Overview shows "Built in this app" and "Left to build (…)"; the feature page shows "This app:" with
      "Missing:"; "Left to build only" filters the list (`tools/research/find-it.mjs`, 1440/1024/390/360 px).
