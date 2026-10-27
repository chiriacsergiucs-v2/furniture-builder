# ADR-124: Research batch 4: design codes, keep edits on replace, template references, project-wide settings

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-055, ADR-096, ADR-098
- Design: docs/ui-design.md (project editor, selected-piece card, project panel)
- Backlog: N125
- Agreed: 2026-10-27: "Accept default" (the suggested picks of G-159, G-160, G-161, G-162)

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Fourth batch of the features left after ADR-093…120 (list in [ADR-121](../adr-done/ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)):

| Research feature (id)                                          | Complexity  | What is missing here                         |
| -------------------------------------------------------------- | ----------- | -------------------------------------------- |
| Saved designs and personal codes (`saved-design-codes`)        | Medium      | a code to share or reopen a design elsewhere |
| Smart replace with compatible alternatives (`compatible-swap`) | Medium-high | keeping the piece's own edits (G-087)        |
| Existing-template instancing (`template-instancing`)           | Medium-high | pieces refer to a template and store changes |
| Global parameters propagating choices (`global-parameters`)    | Medium-high | project-wide settings pieces follow          |

**Change control.** Template references change ADR-022 ("projects keep copies", implemented): pieces would refer to
their catalog template (id + revision, ADR-096) and store only what differs. ADR-111 linked copies already share one
design inside a project. Both template references and project-wide settings change the project document (ADR-011,
`schemaVersion` raised, old readers kept).

## Decision

1. **Design codes.** **Copy code** in the ⋯ menu (Files), for the open design or project, shows a compact text code
   (the document as saved, compressed with the browser's `CompressionStream`, base64url — no dependency, no
   network) and a link `…/furniture-builder/#open=<code>` (G-159), each with Copy. **Open from code** on Projects
   takes a code or a link; opening a link asks first. Either way the document is validated before it is stored and
   gets a new id, as an imported file (ADR-011); a damaged code is a message, never a throw. Pictures and 3D models
   stay on the device; the code says so (a project file carries them).
2. **Keep edits on replace.** Replace (ADR-098) carries every setting the piece changed against its template that
   also exists on the new design (G-160), and the result lists the rest ("Kept: handle kind. Not kept: interior
   space 3 — the new piece has no such setting."). A carried setting that would make the new design invalid is not
   kept and is listed. The outer width, height and depth are the new item's (the list was chosen by size) and are
   listed as not kept. One undo step. Pure `ownEdits` / `carryEdits` in `src/core/ownEdits.ts`.
3. **Template references.** A piece added from the catalog stores `ref: { overrides }` (project `schemaVersion`
   12): the template is its catalog origin (id, variant, revision; ADR-096) and `overrides` are the settings that
   differ from it, kept up to date on every project change while that revision is the catalog's. The full copy stays
   as the fallback (G-161): a missing or newer template never loses a piece (ADR-012), and old readers still read
   the copy. `resolveItem` rebuilds template + overrides. **Replace with the new revision** (ADR-096) applies the
   overrides to the new revision and lists what could not carry.
4. **Project-wide settings.** **Project settings** in Configure holds carcass, front and back boards (with their
   banding), handle, front overlay and plinth height (G-162), all optional (`Project.settings`, `schemaVersion` 12).
   A piece follows a setting while its own value equals the project's; changing the setting changes every
   following piece and no other, one undo step. The selected piece's **Project settings** group shows "Follows
   project" or "Own: …" with **Follow project**. Pieces without such a part (a bed has no fronts) are skipped.
   Locked sizes ([ADR-122](../adr-done/ADR-122-research-batch-2-align-heights-lock-sizes-height-drag-in-3d.md)) are not on main yet; respecting them is G-200.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Codes stored on a server** (IKEA's way) — no backend (ADR-002).
- **Keep full copies and only diff on demand** — does not store "only the parameters that differ" as the research
  describes.

## Scope

- In scope: the four features above, document validation and migration, core, storage and UI-logic tests, fuzz on
  resolved designs, jsdom find-it.
- Out of scope: respecting ADR-122's size lock (G-200); pictures and 3D models in codes (G-201). Found while building: Replace keeps the catalog item's size (G-202); wizard and template pieces do not take project settings (G-203).

## Consequences

- Positive: designs move between devices without files; replacing keeps work; one change updates the whole project.
- Negative / risks: two document changes in one batch; every reader must resolve references first (ADR-004).
- Harder to change later: references and project settings in saved projects.

## Done when

- [x] Copy code → Open from code gives an equal design with new ids; a damaged code shows a message (tests).
- [x] Replace carries every listed own edit that exists on the new design and lists the rest (tests).
- [x] A referenced piece resolves to template + overrides; Update to revision N keeps the overrides (tests, fuzz).
- [x] Projects saved before this ADR load unchanged and still save for old readers' fields (storage tests).
- [x] Changing a project setting changes every following piece and no overriding piece, one undo step (tests).
- [x] jsdom find-it at 390 and 1280 px: "Copy code", "Open from code", "Kept:", "Project settings", "Follow project".

## Open questions

Answered 2026-10-27 ("Accept default"): G-159 link plus code; G-160 every changed setting, listing the rest; G-161
refer with a kept copy; G-162 all the listed settings.
