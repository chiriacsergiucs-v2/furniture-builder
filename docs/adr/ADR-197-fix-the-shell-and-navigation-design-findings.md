# ADR-197: Fix the shell and navigation design findings

- Status: Deferred (empty placeholder)
- Date: 2026-11-05
- Depends on: ADR-078, ADR-079, ADR-080
- Design: docs/ui-design.md (Shell and navigation)
- Backlog: N202

## Context

Placeholder for domain 1, **Shell and navigation**, of the 2026-11-05 design critique. The user asked: "run a /batch for 1
through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow", then "Create empty adrs
for them, not ready, add a note inside them with what prompt need to be run to finish them". Domains 2 to 5 became
ADR-193 to ADR-196. This one is not ready: it has no findings yet (G-367). The stopped run had probes for: a text drag released on a dialog backdrop, Esc on the More menu, clicks through an open menu, bad-file import messages on Projects and More, theme following the system, Ctrl+Z on the Catalog page undoing an editor change, and visiting the editor saving a placeholder design.

## Note: the prompt that finishes this ADR

Run in a Claude Code session on this repository, with the production build served (`pnpm build && pnpm exec vite
preview --port 4173`):

> Critique the design of domain 1, Shell and navigation, and fill ADR-197 with its findings. Scope: pages Projects, Catalog, Editor (Compose / Configure / Build), Info, Research; the ⋯ More menu, language menu, theme, file import, top bar and tabs at phone and desktop widths, the home page. Files: src/ui/App.tsx, src/ui/shell/* (MoreMenu.tsx, LanguageMenu.tsx, ProjectsPage.tsx, uiStore.ts, files.ts, importFile.ts), src/ui/useTheme.ts, src/ui/useMediaQuery.ts, src/ui/Dialogs.tsx (Dialog only).
> Implemented ADRs to respect: ADR-078, 079, 080, 114, 115, 118, 153, 157 (grep `docs/adr-done` for more). Evidence: read the code; probe with scratch
> Vitest tests (delete them after); screenshot the production build at 390 × 844 and 1280 × 900. Keep only High
> (blocks or misleads, loses work, wrong output, hard-rule breach) and Medium (clear friction a user hits in normal use)
> findings, 4 to 10, each with evidence (file:line or what you saw) and ONE fix chosen over 2–3 options. Do not repeat
> ADR-191 or ADR-193 to ADR-196. Write Context, Decision (numbered findings), Alternatives considered, Scope, Consequences
> and Done when (≤ 8 items) in this file, ≤ 100 lines; ask every open question at once; record out-of-scope items as
> gaps; set Status Pending once every question is answered; move G-367's part for this domain into it.

Earlier evidence from the stopped run, if the session still has it:
`/tmp/claude-0/-home-user-furniture-builder/ab53647a-dfb3-571a-958d-b77425e3749c/scratchpad/batch/d1/` (screenshots and
probe scripts; scratch space, may be gone).

## Decision

Not written yet; see the note above.

## Done when

- [ ] The critique has run and this ADR lists its High and Medium findings with one fix each (the prompt above).
