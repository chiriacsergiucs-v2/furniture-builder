# ADR-158: Add an Information and guides page with the feature tree

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-153
- Design: docs/ui-design.md (pages)
- Backlog: N160

## Context

Part of the user's request of 2026-10-29: "add a page where you list all the features that the app currently
supports, grouped by domain(moving, composition, aligning, creating and so on, you make the tree-like domain with
whall features we have)". Asked where it lives: "Just a link to a "information and guides" page", then "New Info &
guides page".

## Decision

- A new page **Information and guides** (`#info`), opened from a link in the More menu, like Feature Research and
  Gaps.
- Its first section, **Features**, is a tree of domains (Creating, Composition, Moving, Aligning, Sizing,
  Construction, Boards and edges, Hardware, Room, 3D view, Output, Projects, Catalog and templates, Saving and
  sharing, Account, Language) with each built feature under its domain, its ADR id beside it.
- The tree is `src/core/features.ts`, written from the implemented ADRs; translated like every other text.
- Each domain is a `<details>` group; all start open on desktop and closed on phones.

## Alternatives considered

- **Generate the tree from ADR titles at build time** — ADR titles are decisions, not feature names, and the build
  would read `docs/`.

## Scope

- In scope: the page, the link, the tree data.
- Out of scope: written guides (the page is ready for them; not asked yet, G-305).

## Consequences

- Positive: one place that says what the app does.
- Negative / risks: hand-kept; a feature built later needs its line added (CLAUDE.md rule).

## Done when

- [x] Find-it at 390 and 1280 px: More → "Information and guides" → heading "Features" → "Moving", "Aligning"
      (`tests/find-it/info.test.tsx`).

## Open questions

None. All answered by the user on 2026-10-29.
