# Goal: Phone editor middle ground (ADR-295)

## Context

User request 2026-11-26 (Android Chrome): fix the mobile editor with a middle ground between the original UI
(`62d02f9`) and the canvas editor rework (`ba38355`, `main`). Spec: `docs/adr/ADR-295-phone-editor-middle-ground-one-scroll-panel.md`.
Inventory: `docs/research/2026-11-26-mobile-middle-ground-inventory.md`. Files: `src/ui/App.tsx`,
`src/ui/CanvasEditor.tsx`, `src/ui/controls.tsx`, `src/styles.css`, `src/viewer/*`, `packages/i18n/src/ru/*`,
`tools/mobile-middle/*`. Hard rules: offline core, translation rule, no new dependency, geometry only from
`buildModel()`, no horizontal page scroll at 390 px.

The browser checks read one report: C1 builds, starts the preview on port 4173 and runs
`tools/mobile-middle/find-it.mjs` (390×844 and 844×390, Chromium) into `goals/reports/mobile-middle/`.

## Agents

| Step           | Agent                    | Why                                                                              |
| -------------- | ------------------------ | -------------------------------------------------------------------------------- |
| Inventory      | main session             | Needs both builds side by side; scripted with Playwright, no agent measures taps |
| Design         | main session             | ADR-295 decisions are the orchestrator's; no design agent in `.claude/agents/`   |
| Implementation | mobile-fixes-implementer | Mobile CSS and layout fixes across App, CanvasEditor, controls, styles           |
| Tests          | test-writer              | Writes the browser acceptance script and its checks                              |
| 3D performance | performance-optimizer    | Profiling and frame-time work in `src/viewer`                                    |
| Review         | code-reviewer            | Did not write the code                                                           |

## Checks

1. C1: The browser acceptance script runs on a fresh production build.
   - Command: `pnpm build:ci >/dev/null && (pnpm preview --port 4173 --strictPort >/dev/null 2>&1 &) && sleep 4 && node tools/mobile-middle/find-it.mjs http://localhost:4173/furniture-builder/ goals/reports/mobile-middle --json goals/reports/mobile-middle/report.json; pkill -f "vite preview" ; test -f goals/reports/mobile-middle/report.json`
   - Fix agent: test-writer
2. C2: No tab-pill row (chip rail) exists at mobile width and the edit bar does not scroll sideways.
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "chip rail|scroll sideways|Editor bar"`
   - Fix agent: mobile-fixes-implementer
3. C3: Every inventory control is reached in ≤ 2 taps; the script lists each control with its tap count.
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "at most 2 taps|reached"`
   - Fix agent: mobile-fixes-implementer
4. C4: No accordion inside a drawer or sheet; opened panels show their content expanded.
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "details|expanded|visible with content|opens into a sheet"`
   - Fix agent: mobile-fixes-implementer
5. C5: Hardware and every other section are found by scrolling, without search; the jump index keeps one order.
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "by scrolling|fixed order|Results|Hardware"`
   - Fix agent: mobile-fixes-implementer
6. C6: In the 3D view no counter overflows its container at 390×844 and 844×390 (bounding boxes compared).
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "^3D"`
   - Fix agent: mobile-fixes-implementer
7. C7: Open/close state stays right across repeated taps, back, rotation and a change of selection.
   - Command: `node tools/mobile-middle/report-check.mjs goals/reports/mobile-middle/report.json "Edit ×3|goBack|rotat|different space|aria-expanded"`
   - Fix agent: mobile-fixes-implementer
8. C8: 3D drag: 3-second scripted drag, 4× CPU throttling, average ≥ 50 fps and no long task over 50 ms; report shows before and after.
   - Command: `pnpm build:ci >/dev/null && (pnpm preview --port 4173 --strictPort >/dev/null 2>&1 &) && sleep 4 && node tools/mobile-middle/drag-perf.mjs http://localhost:4173/furniture-builder/ --assert; s=$?; pkill -f "vite preview"; exit $s`
   - Fix agent: performance-optimizer
9. C9: Every rework KEEP item still works (canvas editor find-it script: ladder, size tags, handles, picks, pins, output lenses, Find, hints, More switch).
   - Command: `pnpm build:ci >/dev/null && (pnpm preview --port 4173 --strictPort >/dev/null 2>&1 &) && sleep 4 && node tools/canvas-editor/find-it.mjs http://localhost:4173/furniture-builder/ goals/reports/mobile-middle/canvas; s=$?; pkill -f "vite preview"; exit $s`
   - Fix agent: mobile-fixes-implementer
10. C10: Type-check passes.
    - Command: `pnpm typecheck`
    - Fix agent: typescript-types-specialist
11. C11: Lint passes.
    - Command: `pnpm lint`
    - Fix agent: mobile-fixes-implementer
12. C12: Format passes.
    - Command: `pnpm format:check`
    - Fix agent: mobile-fixes-implementer
13. C13: Unit and jsdom tests pass (the full suite also runs in CI).
    - Command: `pnpm test`
    - Fix agent: test-writer
14. C14: Production build passes.
    - Command: `pnpm build`
    - Fix agent: mobile-fixes-implementer
15. C15: Docs check passes.
    - Command: `pnpm docs:check`
    - Fix agent: technical-writer
16. C16: The review agent reports no open issues.
    - Evidence: `code-reviewer` (not the writing agents) reviews the branch diff against ADR-295 and CLAUDE.md; its findings list is empty, or every finding is fixed and re-reviewed.
    - Fix agent: mobile-fixes-implementer

## Limits

Max loops: 5

## Report

goals/reports/mobile-middle-ground-2026-11-26.md
