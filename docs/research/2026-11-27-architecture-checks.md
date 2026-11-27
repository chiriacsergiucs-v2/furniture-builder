# Architecture checks the 2026-11-17 review could not cover (G-534)

- Date: 2026-11-27
- Gap: G-534 (architect-review 2026-11-17); backlog row N439
- Branch: `gap-docs` (based on `medium-batch-c`, commit `efa0deed` for the runs below)
- Scope: run each check the review listed and record its result. Defects are described here and not fixed.

Evidence labels: **ran** means a command or script was run in this session and its result is quoted; **read** means
the result comes from reading the code at the cited lines.

## Summary

| #   | Check                                              | Result                                     | Evidence     |
| --- | -------------------------------------------------- | ------------------------------------------ | ------------ |
| 1   | Integer millimetres: every `Math.round/floor/trunc` in `src/core` | 159 of 160 calls conform; 1 defect | read, ran    |
| 2   | Integer, size and thickness checks, `src/core/build.ts` lines 1–150 | Present and independent; two checks have no test that fires them | read, ran |
| 3   | Deep fuzz, `FUZZ_N=30000`                          | Pass, 9 of 9 tests                         | ran          |
| 4   | Quick-count card over the 3D view (ADR-085)        | Within the exception                       | read, ran    |
| 5   | Service worker and content security policy         | Pass; two notes                            | read, ran    |
| 6   | `supabase/functions/assistant`                     | No defect; two notes                       | read         |
| 7   | Runtime lazy mount of the 3D view                  | Pass at 1280 and 390 px                    | ran          |

One defect found (check 1): a diagonal corner with two or more doors can leave up to `n − 1` mm unshared at the end
of the diagonal. Described under check 1; not fixed here.

## 1. Integer millimetres across `Math.round`, `Math.floor` and `Math.trunc` in `src/core` (ADR-003)

**Ran:** `grep -rn -E "Math\.(round|floor|trunc)\(" src/core --include=*.ts` lists 160 calls (the review counted 161
on 2026-11-17). **Read:** each call was read in context and classified; the classification is an inference from the
code, one class per call.

| Class | Meaning                                                                                                          | Calls |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ----- |
| S     | Exact integer split: the remainder is handed out 1 mm at a time, so the parts sum to the whole                   | 13    |
| C     | Centring or halving to whole mm: the odd millimetre goes to one side on purpose; paired halves sum to the whole | 29    |
| M     | A computed, measured or dragged value turned into whole mm (metres to mm, shaped vertices, gestures, snaps)      | 52    |
| K     | A value used only in a check or a message; no geometry comes from it                                             | 8     |
| N     | Not millimetres: money, counts, indices, dates, random seeds, pixels, degrees, scores, tenths of a mm, SVG text  | 57    |
| D     | Defect against ADR-003                                                                                           | 1     |

- **S (13):** `src/core/geometry.ts`:183,201 (the remainder goes to a flexible part at 194–195; `equalParts` at
  200–203); `src/core/groupSize.ts`:96 (`share`, leftover at 97–99); `src/core/align.ts`:321 (`extra` at 322–323);
  `src/core/fasteners.ts`:348,414 (spare mm to the first gaps at 349–351, 415–417); `src/core/wallfill.ts`:225
  (`exactSplit`), 359 (difference of rounded running totals, which telescopes to `W`), 366, 397, 404, 465, 675.
- **C (29):** `src/core/catalog/roomPresets.ts`:78; `src/core/project.ts`:2659,2660; `src/core/cabinet.ts`:1135;
  `src/core/frame.ts`:119,265,355,361,370,578,590; `src/core/arrange.ts`:248,449 and `src/core/model3d.ts`:98 (a
  `ceil`/`floor` pair, so the halves sum to the size); `src/core/geometry.ts`:299,300 (`halfLo` + `halfHi` = `g`);
  `src/core/merge.ts`:197; `src/core/panel.ts`:62,64,65,66,80,81; `src/core/align.ts`:213; `src/core/snap.ts`:435;
  `src/core/moveTo.ts`:353; `src/core/roomfill.ts`:553; `src/core/build.ts`:178; `src/core/fasteners.ts`:393.
- **M (52):** `src/core/surface.ts`:79; `src/core/selectPath.ts`:137,138,139,142; `src/core/project.ts`:701,710
  (a plan tap, clamped to x, z ≥ 0 as its comment at 705–708 says; not typed input); `src/core/planPicture.ts`:40,51,56;
  `src/core/frame.ts`:54; `src/core/outline.ts`:68; `src/core/explode.ts`:18; `src/core/geometry.ts`:74,75;
  `src/core/height.ts`:28; `src/core/roomSurfaces.ts`:53; `src/core/room.ts`:884; `src/core/selection.ts`:95,136,137;
  `src/core/corner.ts`:314,315,317; `src/core/variableCore.ts`:120,126,427,456 (a formula result is rounded and the
  message at 464 says "{raw} → {n} mm", so it is not silent, ADR-008); `src/core/snap.ts`:595,596,601,693;
  `src/core/shape.ts`:126,269,281; `src/core/roomfill.ts`:534,658; `src/core/modelPlace.ts`:49,120;
  `src/core/insertTemplate.ts`:60,61; `src/core/wallPicture.ts`:186,187,196,197,198,199; `src/core/model3d.ts`:125,173,179,180,181.
- **K (8):** `src/core/cabinet.ts`:641,956 (`noFrontRoom` size checks; 956 uses the smallest of the `equalParts`
  sizes, which is the right one to judge); `src/core/room.ts`:824; `src/core/variableCore.ts`:464;
  `src/core/rules.ts`:82; `src/core/reviewPack.ts`:56; `src/core/wallfill.ts`:406,1044.
- **N (57):** `src/core/surface.ts`:72; `src/core/wizard/suggest.ts`:48,56; `src/core/project.ts`:738;
  `src/core/frame.ts`:50,130,369; `src/core/shopping.ts`:67; `src/core/owned.ts`:101 (a count; the UI refuses a
  number outside 0 to the total with a notice first, `src/ui/Output.tsx`:130–134); `src/core/prices.ts`:52,54,59,60,62,64,131,132,134,178;
  `src/core/connections.ts`:230,231; `src/core/geometry.ts`:91,92 and `src/core/shape.ts`:146,147 (projections in
  thousandths of a mm for the overlap test); `src/core/design.ts`:580,643,644 (counts bounded by the inspector
  counters' `max`, `src/ui/Inspector.tsx`:1071,2312), 874; `src/core/backupReminder.ts`:54;
  `src/core/stagger.ts`:30,61,66; `src/core/materials.ts`:101; `src/core/shape.ts`:322;
  `src/core/snapshot.ts`:265,313,314,315,349,350; `src/core/zip.ts`:30; `src/core/reviewPack.ts`:21,59;
  `src/core/model3d.ts`:146,242; `src/core/wallfill.ts`:247,252,307,335,530,533,535,544,629,672,677.

### Defect D1: diagonal corner doors are not an exact split

`src/core/corner.ts`:341 sets each door leaf to `Math.floor((span - 2 * r - (n - 1) * g) / n)` and lays the leaves
from the left at `r + i * (leaf + g)` (347). The remainder of the division is not handed out, so the right end gap is
`r + remainder` instead of `r`. Cabinet doors use `equalParts` for the same job (`src/core/cabinet.ts`:673,752).

**Ran** (a throw-away probe, not committed): the diagonal corner from `cornerDefaults('diagonal')` with two doors.
At width 900 the diagonal `span` is 481 mm and the two leaves are 238 + 238 mm, which fills it exactly
(481 − 2 × 1 − 3 = 476). At width 901 the span is 482 mm, the exact leaves would be 238 + 239, and the build gives
238 + 238: the right end gap is 2 mm and the left 1 mm. No diagnostic is raised. Size of the error: at most
`n − 1` mm. Fix (not done here): split with `equalParts(span - 2 * r - (n - 1) * g, n)` and lay each leaf at the
running sum.

## 2. Integer, size and thickness checks in `src/core/build.ts` above line 150 (ADR-008)

**Read:** after the generator runs, `buildModel` checks every panel again, independently of the generator:

- `non-integer` error (`src/core/build.ts`:92–104): every box value must pass `isMm` (`Number.isSafeInteger`,
  `src/core/geometry.ts`:3).
- `zero-size` error (106–117): cut length or width ≤ 0.
- `narrow-part` warning (118–126): cut width under 30 mm.
- `shape` error (128–136): `shapeProblems` for shaped parts (whole degrees, profiles inside the blank).
- `thickness` error (137–150): a sheet part whose cut thickness differs from its board's (solid timber exempt,
  ADR-038).

A panel whose board is unknown skips the thickness check (`m &&` at 138); document validation refuses unknown
boards before a build (`tests/core.test.ts`:293–299), and part and role boards apply only when the board exists
(`src/core/build.ts`:42–50).

**Ran** (throw-away probe on the chest template, bypassing document validation): width 800.5 mm gives the
`non-integer` error; a board 0.5 mm thicker gives `non-integer` (the generator copies the thickness into the boxes);
width = 2 × board thickness gives the generator's `carcass-too-small` and no panels to judge. Existing tests fire
`thickness` (`tests/role-boards.test.ts`:61, `tests/part-boards.test.ts`:25) and `narrow-part`
(`tests/fixtures/diagnostics-golden.json`:300). No committed test fires `non-integer` or `zero-size` through
`buildModel`; the fuzz run checks the same invariants on its own (`tests/fuzz.test.ts`:397,399,662,1031). Not a
defect: the checks exist and the invariants are tested, only the two error paths themselves are untested.

## 3. Deep fuzz run

**Ran:** `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` → `Test Files 1 passed (1)`, `Tests 9 passed (9)`,
duration 164 s, exit 0.

## 4. Quick-count card over the 3D view (ADR-085 exception to ADR-014)

**Read:** the card is a DOM element beside the canvas, not part of the scene (`src/viewer/Viewer3D.tsx`:568–573);
`CountsAnchor` inside the canvas only reports a screen point (`src/viewer/ViewerScene.tsx`:483) and
`placeCard` clamps the card inside the view with a 6 px margin (`src/viewer/Viewer3D.tsx`:173–188). The card itself
comes from the UI as a prop, `CountStepper` (`src/ui/shell/ViewerSlot.tsx`:9,60), so `src/viewer` imports nothing
from `src/ui` (ran: `grep -rln "from '../ui" src/viewer` → 0 files, ADR-230). Presses call the store's `stepCount`
(`src/store/designStore.ts`:1304–1314), which goes through `updateSpace`, the same path as over the drawing. It hides
while a picture renders or in the review preview (`src/viewer/Viewer3D.tsx`:133–134). Later ADRs widened where it
shows (docked under the view on phones, G-070; drilled-in project pieces), each by its own decision.

**Ran:** `tools/count-stepper/find-it.mjs` against `pnpm build` served by `vite preview` → `44/44 passed`, including
"Quick counts" card with the 3D view, card is inside the 3D view and 3D card shows Doors 2 at 1280 px, the docked card
and Fewer doors in 3D → 1 at 390 px, no page errors.

## 5. Service worker and content security policy

**Read:** the service worker is generated by `vite-plugin-pwa` with `registerType: 'prompt'` and a precache of
`**/*.{js,css,html,svg,woff2}` only (`vite.config.ts`:35–51), with no `runtimeCaching`; it is registered in
`src/main.tsx`:23,46. The CSP is one meta tag built by `csp.ts`:19–37 and injected first in `<head>`
(`vite.config.ts`:16–25): `default-src 'self'`, `script-src 'self'`, `connect-src` = self, the build's backend
origin (https only, `csp.ts`:9–17) and the seller picture origins, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`.

**Ran:** `pnpm build` (exit 0; precache 206 entries, 8452.64 KiB), then
`REQUIRE_DIST=1 pnpm exec vitest run tests/bundle-boundary.test.ts tests/precache.test.ts tests/security.test.ts tests/network-boundary.test.ts`
→ 4 files passed, 23 tests passed, 2 skipped (the "dist is required" guards, skipped because `dist` exists).
`dist/index.html` carries the policy; `dist/sw.js` has no `runtimeCaching`, `NetworkFirst`, `StaleWhileRevalidate`
or `CacheFirst` (count 0).

Notes, not defects: `style-src` allows `'unsafe-inline'`, as the comment at `csp.ts`:24 explains (React and three.js
inline styles). A meta-tag CSP cannot carry `frame-ancestors`, and GitHub Pages cannot set headers, so framing is
not restricted (known limit of the hosting, `csp.ts`:4). The local build had no `VITE_SUPABASE_URL`, so its
`connect-src` lists no backend; the deployed build's policy was not checked here.

## 6. `supabase/functions/assistant`

**Read** (`supabase/functions/assistant/index.ts`):

- The caller's session is checked first with the user's own token (83–90); no token or no user → 401.
- The body is refused over 600 000 characters, by `Content-Length` (93–94) and again after reading (95–96); bad JSON
  → 400; `valid` (57–77) bounds the message (8 000 characters), the history (100 turns of 8 000 characters each) and
  the document kind. Only the last 20 turns go to the model (116).
- The daily allowance is taken before the model call through `assistant_take` (105–111), a `security definer`
  function that only `service_role` may run (`supabase/migrations/20261109000000_assistant.sql`:14–31); it returns −1
  once the cap is reached (429).
- The provider key stays a server secret (113); CORS allows one origin (26, 37–42); model errors map to 502/503
  without the provider's message (137–142); a refusal becomes a question (143–147). Nothing is stored but the count.
- The plan's `calls` are returned unchecked (154–159) by design: the app checks the whole plan, previews it and
  applies it as one undo step (`docs/architecture.md`, Network paragraph; `src/store/assistantRun.ts`).

Notes, not defects: a request that fails at the model still uses one of the day's requests (the allowance is taken
at 106 before the call at 134); `selection` and `actions` are not shape-checked beyond the body size limit (they only
shape the prompt). Not run: the function was not deployed or called in this session (no backend access).

## 7. Runtime lazy mount of the 3D view (ADR-013, ADR-014)

**Read:** `Viewer3D` is a `lazy` import (`src/ui/shell/ViewerSlot.tsx`:7) rendered only when `mount` is true
(41–66); `mount3d = has3d && shows3d(shown) && active` (`src/ui/shell/EditorWork.tsx`:336). The build keeps three.js
and `@react-three` in their own chunks (`vite.config.ts`:8–13, 57–68) and `tests/bundle-boundary.test.ts` fails a
static import of them from `index` (ran above: pass).

**Ran:** a throw-away Playwright script (`playwright-core` and the repo's `tools/lib/harness.mjs`, system Chromium)
against the production build served by `vite preview`, service workers blocked, recording every `assets/*.js`
request:

| Width   | Home                    | Editor, 2D shown        | After tapping **3D**                  | Back to **2D** |
| ------- | ----------------------- | ----------------------- | ------------------------------------- | -------------- |
| 1280 px | no 3D chunk, no canvas  | no 3D chunk, no canvas  | `Viewer3D` and `three` load, 1 canvas | 0 canvases     |
| 390 px  | no 3D chunk, no canvas  | no 3D chunk, no canvas  | `Viewer3D` and `three` load, 1 canvas | 0 canvases     |

No page errors at either width. The 3D code loads only when the 3D view is shown and the canvas unmounts when it is
hidden.

## Not checked

- The live site and a real phone (G-047): every run above used a local production build.
- The deployed CSP with the backend origin, and a real call to the assistant function (no backend access here).
