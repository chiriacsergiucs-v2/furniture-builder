# ADR-111: Re-check research features and delete the built ones from the data

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-043, ADR-092, ADR-110
- Design: n/a
- Acceptance: browser
- Backlog: N109
- Agreed: 2026-10-27 "Re-validate, remove implemented ones"; answers "Research features", "Delete from the data", "Apply all", "Verified + Implemented", "Become top-level", "Keep for what's left"

## Context

User request 2026-10-27: "Re-validate, remove implemented ones"; answers "Research features" and "Delete from the
data". The app statuses (ADR-092) were checked on 2026-10-26. Since then ADR-093 to ADR-109 shipped (N91–N107),
and several of the 53 features left to build are now built. Of 157 features, 69 are Verified and 4 Implemented;
31 are merged into other features; 25 are In Progress and 28 Not Started.

## Decision

1. **Re-check.** Update `ENSEMBLE_APP_STATUS` (checked 2026-10-27) from the backlog rows of N91–N107:

   | Feature                                               | Was         | Becomes                                                                               | Evidence   |
   | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- | ---------- |
   | Drag-and-drop placement                               | In Progress | Verified                                                                              | N92        |
   | Multi-select, groups and whole-ensemble transforms    | In Progress | Verified                                                                              | N95        |
   | Selection box                                         | Not Started | Verified                                                                              | N95        |
   | Cycle through overlapping objects                     | Not Started | Verified                                                                              | N95        |
   | Smart replace/swap with compatible alternatives       | Not Started | Verified                                                                              | N96        |
   | Edge/face/centre alignment and equal distribution     | In Progress | Verified                                                                              | N97        |
   | Compatibility-rule engine                             | In Progress | Verified                                                                              | N98        |
   | Constraints as inspectable domain data                | In Progress | Verified                                                                              | N98        |
   | Auto-fit a run/span using valid module widths         | Not Started | Verified                                                                              | N101, N102 |
   | Lock/pin modules and preserve manual overrides        | Not Started | In Progress (missing: lock single named parameters)                                   | N93        |
   | Never silently move unrelated items                   | Not Started | In Progress (missing: stop-and-explain when a change cannot keep every hard rule)     | N93        |
   | Direct manipulation in 2D/3D                          | In Progress | In Progress (missing now only: free rotation; turns are 90° steps by choice, ADR-093) | N91        |
   | Existing-template instancing                          | Not Started | In Progress (missing: store only the parameters that differ)                          | N94        |
   | Connected items stay independently selectable         | In Progress | In Progress (missing now: connections; groups built, N95)                             | N95        |
   | Deterministic generation of alternative valid layouts | In Progress | In Progress (still missing: a whole project; one wall run built)                      | N101       |

   Two In Progress rows also gain evidence with the same missing part narrowed to "connections": Ensemble document
   model and Versioned save/reload (N94 template revisions, N95 groups).

2. **Delete** every Verified and Implemented feature from the shipped research data (82), and the 10 features
   merged into one of them (same idea, built). 65 features stay: 44 listed and 21 merged into them. Their
   assessments and app records go too.
3. **Sub-features** of a deleted feature become top level (answer "Become top-level"). Links (related,
   dependencies) to a deleted feature are removed; a contradiction left with no feature is removed (5).
4. **Traceability:** the bundle gets an optional `removed` list (`RemovedFeature`: id, name, the backlog row or ADR
   that shows it built, its findings). It is never shown; the coverage audit counts its findings as accounted for,
   so every ranked row, recommendation, request and requirement of the paper still traces to a record. The
   validator rejects a removed record that is still a feature or names an unknown finding. Optional, so older
   stored bundles stay valid.
5. **No edition bump:** the paper did not change. The shipped bundle replaces the stored one of the same edition
   because its content differs (`seedShipped`); a bump would keep the old edition stored and bring the deleted
   features back as retired.
6. **"Built in this app"** stays for what is left (answer "Keep for what's left"): "N features the app has built
   are no longer listed", then in progress and not started (planned, and any built by a status the user set, when
   there are some).
7. Decisions and notes saved on the device for a deleted feature stay stored (ADR-012) and are not shown.

## Scope

- In scope: the status update, the deletion, the removed list, the panel, tests and the find-it script.

## Consequences

- Positive: the page lists only what is left to build.
- Negative / risks: the research page no longer shows what the paper said about built features.
- Harder to change later: getting a deleted feature back means restoring it from git history.

## Done when

- [x] Statuses above are in the data, checked 2026-10-27
- [x] No Verified or Implemented feature is in the shipped bundle; the bundle validates and the audit passes (tests)
- [x] The page lists only features left to build, with counts to match (find-it at phone and desktop widths)
