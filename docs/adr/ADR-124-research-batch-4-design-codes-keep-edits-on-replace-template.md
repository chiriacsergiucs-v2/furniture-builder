# ADR-124: Research batch 4: design codes, keep edits on replace, template references, project-wide settings

- Status: Deferred (open questions G-159, G-160, G-161, G-162)
- Date: 2026-10-27
- Depends on: ADR-055, ADR-096, ADR-098
- Design: docs/ui-design.md (project editor, selected-piece card, project panel)
- Backlog: N125

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Fourth batch of the features left after ADR-093…120 (list in [ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)):

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

1. **Design codes.** **Copy code** on a design and on a project produces a compact text code (the validated
   document, compressed with the browser's `CompressionStream`, base64url — no dependency, no network). **Open
   from code** on Projects pastes one; it is validated before load and gets new ids (ADR-011); a bad code is a
   message, never a throw. Link form waits for G-159.
2. **Keep edits on replace.** Replace (ADR-098) compares the old piece with its catalog origin, carries the changed
   settings onto the new design, and the result lists what carried and what could not ("Kept: handles, back
   board. Not kept: drawer 3 height — the new piece has 2 drawers"). One undo step. Which settings waits for G-160.
3. **Template references.** A piece added from the catalog stores `{ templateId, revision, overrides }`; its design
   is the template plus overrides, rebuilt by a pure `resolveItem` in `src/core`. **Update to revision N** (ADR-096)
   keeps the overrides. A missing template never loses a piece (ADR-012). The fallback waits for G-161.
4. **Project-wide settings.** A **Project settings** panel holds choices every piece follows unless it overrides
   them (as material overrides do, ADR-055); a piece's card shows "Follows project" or "Own: …" with **Follow
   project**. Changing a setting rebuilds the pieces and reruns checks; one undo step. Which settings waits for
   G-162; locked sizes ([ADR-122](ADR-122-research-batch-2-align-heights-lock-sizes-height-drag-in-3d.md)) are respected if built first.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Codes stored on a server** (IKEA's way) — no backend (ADR-002).
- **Keep full copies and only diff on demand** — does not store "only the parameters that differ" as the research
  describes.

## Scope

- In scope: the four features above, document validation and migration, core, storage and UI-logic tests, fuzz on
  resolved designs, jsdom find-it.
- Out of scope: nothing; the undecided parts are the open questions (G-159 to G-162).

## Consequences

- Positive: designs move between devices without files; replacing keeps work; one change updates the whole project.
- Negative / risks: two document changes in one batch; every reader must resolve references first (ADR-004).
- Harder to change later: references and project settings in saved projects.

## Done when

- [ ] Copy code → Open from code gives an equal design with new ids; a damaged code shows a message (tests).
- [ ] Replace carries every listed own edit that exists on the new design and lists the rest (tests).
- [ ] A referenced piece resolves to template + overrides; Update to revision N keeps the overrides (tests, fuzz).
- [ ] Projects saved before this ADR load unchanged and still save for old readers' fields (storage tests).
- [ ] Changing a project setting changes every following piece and no overriding piece, one undo step (tests).
- [ ] jsdom find-it at 390 and 1280 px: "Copy code", "Open from code", "Kept:", "Project settings", "Follow project".

## Open questions

- **G-159** A link that opens the app with the design plus the text code, or the text code only? Suggested: link
  plus code (estimate +10 % work, +25 % of value).
- **G-160** Which edits carry on replace: every changed setting that also exists on the new design, or size and
  boards only? Suggested: every one, listing the rest (estimate +40 % work, +50 % of value).
- **G-161** References: refer by default and keep a copy as fallback, refer with no copy, or opt in per piece?
  Suggested: refer with a kept copy (estimate +20 % work over no copy, same value).
- **G-162** Which project-wide settings: carcass, front and back boards and banding; handle type; front overlay;
  plinth height — all or a subset? Suggested: all (estimate +40 % work over boards only, +60 % of value).
