# Goal runner report: mobile-middle-ground (2026-11-26)

Goal file: `goals/mobile-middle-ground.md`. ADR-295. Pull request #325. Loops run: 5 (the limit). Result: **PARTIAL —
14 of 16 checks pass; C8 (drag long task) fails, C16 (review) has open should-fix items.**

Machine results: `goals/reports/mobile-middle-ground-checks.json` (loop 5); browser report
`goals/reports/mobile-middle/report.json`; tap table `goals/reports/mobile-middle/mobile-middle-taps.json`.

## Checks (loop 5)

| Check | Result | Evidence |
| --- | --- | --- |
| C1 browser script on a fresh build | PASS | `find-it.mjs` 63/63 at 390×844 and 844×390 |
| C2 no chip rail, edit bar never scrolls sideways | PASS | report.json: "no chip rail and no Editor actions toolbar", "the edit bar does not scroll sideways" |
| C3 every control in ≤ 2 taps | PASS | "every control needs at most 2 taps"; per-control counts in mobile-middle-taps.json |
| C4 no accordion in a drawer or sheet | PASS | "no `<details>` in main.work" with the panel, Settings and Material open |
| C5 Hardware found by scrolling; fixed index order | PASS | "section Hardware is reachable", "Jump to section keeps one fixed order (piece vs space)" |
| C6 3D counters inside the 3D view | PASS | "card box is inside its host (3D pane)", "no two stepper controls overlap" at both sizes |
| C7 open/close across taps, back, rotation, selection | PASS | Edit ×3, goBack, rotation 844↔390, different space, aria-expanded checks |
| C8 drag ≥ 50 fps and no long task > 50 ms (4× CPU) | **FAIL** | fps met (52.9); one long task of 66 ms at drag start (G-597) |
| C9 rework KEEP items still work | PASS | `tools/canvas-editor/find-it.mjs` 58/58 |
| C10–C15 typecheck, lint, format, test, build, docs | PASS | exit 0 each; CI on the PR green |
| C16 review: no open issues | **OPEN** | loop 4 re-review: 0 blockers, 2 should-fix (1 fixed after loop 5, test gap partly), nits → G-600 |

## 3D drag, before and after

Headless Chromium with SwiftShader (no GPU), 390×844 touch context, scripted 3 s drag, `tools/mobile-middle/drag-perf.mjs`.

| Build | Drag 4× fps | Long tasks | Max long task |
| --- | --- | --- | --- |
| Original (`62d02f9`) | 12.5 | 40 | 121 ms |
| Rework (`ba38355`, 150 px squeezed canvas) | 14.7 | 46 | 81 ms |
| Middle ground before the drag fix (592 px canvas) | 8.4 | 28 | 195 ms |
| Loop 3 (frozen floor shadow, adaptive pixel ratio) | 45.7 | 2 | 63 ms |
| Loop 4 (thin edges, steady ratio; median of 3) | 53.3 | 0–1 | 52 ms |
| After loop 5 review fixes (load 5.6) | 52.9 | 1 | 66 ms (drag start) |

At 1× CPU: drag 58.9 fps, wheel 59.1 fps, 0 long tasks.

Root cause of the lag: drei `ContactShadows` redrew the scene plus four blur passes every frame (`frames=Infinity`);
then the fat edge lines (`LineSegments2`) and canvas resizes from an oscillating pixel ratio.

## Still failing

| Item | Blocker | Unblocks it | Cost | Gap |
| --- | --- | --- | --- | --- |
| First drag frame 52–66 ms | canvas resize at the ratio change (≈ 11 ms) + needed pointerdown raycast (≈ 13 ms) + SwiftShader GPU wait | draw drag frames into a fixed reduced render target, no canvas resize | M | G-597 |
| Review nits and glue tests | scope (5-loop limit reached) | jsdom tests for FloorShadow and press wiring; twins built in an effect; mouse-only tap slop | S–M | G-600 |
| Real Android device check | no device in the sandbox | the user opens the live build on the phone | S | G-596 |
| Room drawings 20 px high at 844×390 (also on `main`) | layout decision for the short-landscape work area | pick: minimum stage height, work column scrolls | M | G-601 |

Covered after the report (S-leftover rule, CLAUDE.md): G-599 built (`find-it.mjs` 73/73 with the 320×640 edit bar
and the 844×390 room drawings passes); G-598 acknowledged (0.1 ms per frame, stale-transform risk); the touch slop
answered and built (a wobbling touch tap selects).

## Agents

| Step | Agent | Why |
| --- | --- | --- |
| Inventory, design (ADR-295) | main session | needs the user's feedback and the repo rules in one head; no design agent fits |
| UI implementation and UI review fixes | mobile-fixes-implementer | phone layout, touch targets, overflow |
| Browser acceptance script | test-writer | writes the checks independently of the implementer |
| 3D drag | performance-optimizer | profiling and frame-time work |
| Goal runner skill | skill-builder-v2 | writes SKILL.md files |
| Review | code-reviewer | did not write any of the code |
