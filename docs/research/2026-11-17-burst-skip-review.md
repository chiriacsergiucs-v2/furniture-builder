# Burst skip review, batch D (window 2026-11-15 to 2026-11-16)

Date of this review: 2026-11-17. Branch `catch-up-2026-11-17`, tree at `main` d189439 (PR #280 merge). Skill: `skip-review`, stages 01 to 05, analysis only.

## Answer: did we cover it all?

Yes for the inventory: every `burst-skipped:` marker in `docs/backlog.md` and every gap G-509 to G-523 is listed below and has a class. No for the debt itself: of 68 marker-and-row pairs, 35 are valid skips that CI has already paid, 30 are live-verify items that nobody can pay from this sandbox, 2 are stale `ship-adr` markers and 1 (the "other 34 scripts re-run") is a premature skip that still needs a proof. Nothing is classed avoidance, and nothing in the markers needs the user's consent. The one consent item sits outside the markers: duplicate backlog ids (G-523).

## How to read this report

Evidence kinds follow the skill. **read** means I read a file at the given line. **API** means I read a GitHub REST result with `gh api` (PR list, check runs, deploy runs); it is evidence that a run happened, not a run of mine. **ran** appears nowhere in this report: I ran no test, build, lint or regress, as instructed, because another worker is using `dist/` for the browser regression in the same tree. Anything I could not check is marked "unverified".

A count note. `grep -n "burst-skipped:" docs/backlog.md` returns 32 lines. Case-insensitive `burst.skipped` returns 33. The 33 are: 31 rows that carry a real debt marker (30 distinct ids, because id N326 appears on two rows), plus two rows that only mention the marker in prose, N281 (line 367, the row that introduced burst mode) and N312 (line 342, the gaps-hook row). N281 and N312 carry no debt. Rows that share an id are told apart by line number below (N326 at 384 and 386).

Standing reason for every marker: the `burst` toggle is on (`CLAUDE.md:279-282` lists find-it tests, skip-review stage 03, live-verify after deploy, local format check, lint and the full suite as steps burst may skip). Every row says "(burst, 2026-11-16)". No row gives a per-item blocker, cost or unblocker, which `CLAUDE.md:298` asks of every skip; "burst" is the whole reason.

---

## Stage 01: Inventory

### 1a. Debt markers, grouped by kind

| Marker kind | Rows (id, backlog line) | Pairs |
| --- | --- | --- |
| Lint and full suite, written as two markers ("lint", "full suite") | N311 (341), N313 (343), N314 (344), N315 (345), N316 (346), N318 (348), N319 (349), N320 (377), N324 (379), N323 (380), N322 (381), N329 (382), N328 (383), N326 More menu (384), N325 (385), N326 disabled reasons (386), N327 (387) | 17 |
| "local lint and full suite" | N274 (314), N286 (325), N287 (326), N288 (327), N302 suggestion cards (369) | 5 |
| "local format:check, lint and full suite" | N304 (370), N305 (371), N306 (372), N307 (373), N308 (374), N309 (375), N310 (376) | 7 |
| live-verify (also written "live-verify after deploy") | every debt row except N316: N274, N286, N287, N288, N311, N313, N314, N315, N318, N319, N293, N302, N304 to N310, N320, N321, N324, N323, N322, N329, N328, N326 (both), N325, N327 | 30 |
| skip-review stage 03 | N274 (314), N286 (325), N287 (326), N288 (327), N293 (368) | 5 |
| ship-adr | N274 (314, ADR-265), N293 (368, ADR-217) | 2 |
| find-it test | N302 (369): "find 'Suggested combinations' shows 4 cards, wall and room mixes show 2, fronts see-through" | 1 |
| "the other 34 scripts re-run" | N321 (378) | 1 |

Row status of the 31 debt rows: 10 read **Done** (N313, N314, N315, N318, N319, N320, N321, N322, N324, N327) and 21 read Partially done. `CLAUDE.md:292-293` says a row with a burst marker "stays Partially done".

### 1b. Implicit skips found inside the same rows

| Id | Where | What was left | Status today |
| --- | --- | --- | --- |
| N274 | backlog:314 | Data words inside a warning (hardware, family, board, piece names) stay in the app language | G-516 done (N324); the remainder is G-521, open |
| N314 | backlog:344 | `tools/catalog-flows` and `tools/control-rule` ran before the chip CSS change, not after | Covered: N328 (backlog:383) ran control-rule 176 PASS and catalog-flows 42 PASS on the later production build |
| N314 | backlog:344 | 3D view, Gaps, Research, Information, Account, Share, Assistant, saved-piece screens left in G-509 | Pass 3 (N317) covered most; G-509 still lists signed-in Account, share links, Assistant replies, error states, drag gestures, Move mode, Render and AR export |
| N315 | backlog:345 | "Not observed firing in a live session" | G-094 and G-517, open |
| N316 | backlog:346 | "Not yet seen in a CI run" | Seen: `id-check` is `success` on the PR heads of #248, #249, #250 and #251 (API). It has not caught a real collision (G-517) |
| N326 disabled reasons | backlog:386 | Move and Adjust reason proved only in jsdom on its own component | Closed by N329 and `tools/exploded-why/find-it.mjs` (file exists, read) |
| N327 | backlog:387 | F-08 and F-10 "not on origin/main" | Fixed by #279 (N328) and #280 (N329); the audit register marks F-08 fixed (`2026-11-15-ui-flow-audit.md:402`) |
| N281 | backlog:367 | "first real burst and first catch-up run not tried" | This catch-up is the first run; row still Partially done |
| N293 | backlog:368 | "ADR-217 still Pending; `ship-adr` not run; N222 still Not done" | All three are now false (see stage 03) |
| N311, N313 | backlog:341, 343 | 6 `tools/catalog-compact` checks failing on main | Fixed in N313 |
| N302, N281, N164, N326 | backlog:339/369, 321/367, 203/207, 384/386 | Four ids are used by two rows each | G-523 names only N326 |

### 1c. Gaps created in the window (G-509 to G-523), 15 gaps

| Gap | Title (short) | Status in ledger | Where |
| --- | --- | --- | --- |
| G-509 | UI audit coverage | Open | `GAPS.md:1722` |
| G-510 | Fix the 38 failing browser scripts | Done (N321) | `GAPS-archive.md:3503` |
| G-511 | Catalog Brands and Saved lists not paginated | Done (N311) | archive:3516 |
| G-512 | `tools/catalog-compact` 6 failing checks | Done (N313) | archive:3528 |
| G-513 | Pagination at 12 families does not shorten the page | Done (N311) | archive:3540 |
| G-514 | Gaps Stop hook passable with any G id | Done (N318) | archive:3552 |
| G-515 | Find-it for ADR-265, 268, 269, 270 | Done (N320) | archive:3562 |
| G-516 | Cut-sheet warnings: data words | Done (N324) | archive:3574 |
| G-517 | Length and id-collision hook bypasses | Open | `GAPS.md:1734` |
| G-518 | Audit F-24 to F-30 | Done (N319) | archive:3586 |
| G-519 | Esc in the template form closes Settings | Done (N318) | archive:3598 |
| G-520 | ADR-265 oversized | Done (withdrawn) | archive:3610 |
| G-521 | Piece, board, hardware names in warnings | Open | `GAPS.md:1746` |
| G-522 | Exploded 3D reasons not browser-proved | Done (N329) | archive:3622 |
| G-523 | Two rows share id N326 | Open | `GAPS.md:1758` |

`pnpm gaps list` shows only open gaps; the window's four open gaps are G-509, G-517, G-521, G-523. No gap above G-523 exists.

---

## Stage 02: Reasons and evidence

| Marker kind | Stated reason | Evidence the row relied on | What that evidence did not cover |
| --- | --- | --- | --- |
| Lint and full suite (29 rows) | Burst: "run `pnpm format`; CI runs the rest" (`CLAUDE.md:281-282`) | Rows cite `pnpm typecheck`, `pnpm build`, `pnpm docs:check`, related tests, jsdom or browser find-it scripts (ran locally) | The whole suite and eslint on the tip. The rows N304 to N310 say "local format:check, lint and full suite", and the PR-level CI for N306 to N310 was skipped by `ship-check` (see 3a) |
| live-verify (30 rows) | Burst (`CLAUDE.md:279-280`). N325 adds the visible text to find: "Search the catalog" and the Size step's number fields 44 px tall on a phone | Local production-build runs in headless Chromium (N287, N288, N322, N323, N325, N326, N328, N329) or jsdom only (N286, N302, N320) | The published site. A local production build is not the deployed one |
| skip-review stage 03 (5 rows) | Burst | None, by design | Everything: no cross-examination of the five ADR rows existed |
| ship-adr (N274, N293) | Burst; N293 also "ADR-217 still Pending" | N293: its Done when list checked by hand (`ADR-217...md:53-57`, all ticked) | At skip time the `ship-adr` rule was still "skipped in burst" (changed 2026-11-16 by PR #253) |
| find-it (N302) | Burst | `snapshotSvg` and `CARDS_FIRST` and `MIXES_FIRST` changes plus unit tests (`tests/wallfill.test.ts:38`, `tests/roomfill.test.ts:141`) | Nothing found by role and visible text from the bare app (R3) |
| other 34 scripts (N321) | "burst" only; no blocker stated | N304 to N310 per-batch regress results (documents), and 4 scripts re-run on 2026-11-16 (arrange, catalog-compact, count-stepper, critique-bugs) | Thirty-four scripts after the 13 PRs merged since the batch results (#267 to #280, including `src/styles.css` changes in #274, #275, #279 and #280) |

---

## Stage 03: Cross-examination

Classes: valid, premature, wrong, avoidance, needs consent, blocked (external).

### 3a. Lint and full suite, 29 rows: valid

Strongest case against skipping: eslint and the suite are the only checks that would catch a regression in untouched files, and N304 to N310 changed `src/styles.css`, `designStore.ts` and `History.tsx`.

Check against the code and CI. `CLAUDE.md:279-282` allows the skip. `package.json:22` defines `lint`; `ci.yml:144` runs `pnpm lint` in the `checks` job (skipped only for docs-only pull requests, `ci.yml:143`), and `ci.yml:205-209` runs `pnpm test` in three shards. From the GitHub API, every code-bearing PR head below finished with `checks`, `test (1..3)`, `build` and `verify` all `success`:

| Row | PR | Result |
| --- | --- | --- |
| N302 | #237 | all success |
| N274 | #239 (build), #273 | all success; ship #266 had no source change and main push success |
| N286, N287, N288 | #240, #242, #244 | all success |
| N311, N313, N314, N315, N316 | #241, #245, #246, #247, #248 | all success |
| N304, N305 | #249, #251 | all success |
| N318, N319, N320, N321 | #267, #268, #269, #270 | all success |
| N322, N323, N324 | #271, #272, #273 | all success |
| N325, N326 (More menu), N326 (disabled reasons) | #274, #275, #276 | all success |
| N327, N328, N329 | #278, #279, #280 | all success; #280 merge commit d189439 also success on main with `deploy` success |
| N306 to N310 | #260 to #264 | PR head: `verify`, `checks`, `test` skipped (see below). Main push of each merge commit: `checks`, `test (1..3)`, `verify`, `build` and `deploy` success (API) |

The exception worth stating: PRs #260 to #264 each hold one commit titled "Ship ADR-…", and `ci.yml:35-46` skips the full run on a pull request whose latest commit subject starts with "Ship ADR-", on the assumption that it "only moves docs". These five PRs changed 5 to 8 files under `src`, `tools` or `tests` each (API, `files` count), so the PR-level run did not happen; the main-push run did, after the merge. The skip of lint and the suite is still valid for N306 to N310 because the post-merge run is green, but the shortcut's premise is false for a build-and-ship single commit. That is an observation about `ship-check`, not a marker, and changing it needs the user's call (rule dated 2026-10-29), so I do not file it as a gap.

N293 has no code change (backlog:368), so there is nothing to lint.

What is not proven: I did not run eslint or vitest, and the CI results are for the merged tips named above, not for any later tree state. Class: **valid** for all 29. The markers can be removed with the CI run evidence above.

### 3b. Live-verify, 30 rows: blocked (external)

Strongest case against skipping: pushed, merged and deployed are not live-verified (`CLAUDE.md:318-319`), and 13 rows change visible CSS where only a browser finds a defect.

Check. The deploy happened: `Deploy GitHub Pages` run 43956437549 on d189439 is `success` at 2026-11-16T21:06:09Z (API), so every row's code was published. I tried to open the live site: `curl` to `https://chiriacsergiucs-v2.github.io/furniture-builder/` fails with `CONNECT tunnel failed, response 403` (the agent proxy allows only a fixed host list); `WebFetch` returned only the static HTML shell ("Furniture Builder" title), with no app text, because the page renders in JavaScript. So no visible text can be found from this session. At skip time the skip was valid (`CLAUDE.md:279-280`).

What would unblock it: a session or person with a browser and egress to github.io. The browser scripts take a URL as their first argument (`tools/lib/harness.mjs:36`, `previewUrl`), so one pass of the relevant `tools/<area>/find-it.mjs` against the live URL, plus a click-through for rows that have only jsdom tests (N286, N302, N320), would pay it. Cost: M (30 rows, one visit per visible text; many share one page). Class: **blocked (external)** for all 30. Nothing here is unverified-as-passed: all 30 stay "not live-verified".

### 3c. skip-review stage 03, 5 rows: valid (paid by this report)

The skip is allowed by `CLAUDE.md:279`. This report is the stage 03 run. What it found in each row:

| Row | Code check (read) | Finding |
| --- | --- | --- |
| N274 (ADR-265) | `src/core/i18n/warning-text.ts` exists; `src/ui/PrintSheet.tsx:7,182` calls `warningText(w.message)` for the "De verificat" list; `tests/warning-print.test.tsx` and `tests/find-it/cut-sheet-warnings.test.tsx` exist; `docs/adr-done/ADR-265-...md:3` is Implemented, acceptance full (line 9) | Claim holds. Known remainder is G-521 (open) |
| N286 (ADR-268) | `tests/space-tree.test.ts`, `tests/structure-tree.test.tsx`, `tests/find-it/structure-tree.test.tsx` exist; ADR in `adr-done`, line 3 Implemented | Claim holds |
| N287 (ADR-269) | `tests/pin-and-deep.test.tsx` and `tools/pin-and-deep/find-it.mjs` exist; ADR Implemented | Claim holds |
| N288 (ADR-270) | `tests/enter-and-focus.test.tsx` and `tools/enter-and-focus/find-it.mjs` exist; ADR Implemented, acceptance browser (line 9) | Claim holds. The 3D opacity proof is a mapping test, as the row says |
| N293 (ADR-217) | `scripts/check-docs.py:4,36-37` accepts `Rejected (<reason>)` only in `adr-done/`; ADR-217 Done when items are all ticked (`ADR-217...md:53-57`) | Claim holds, but the row's text is stale (see 3d) |

Class: **valid** for all 5. These five markers are paid by this report once the user accepts it.

### 3d. ship-adr, 2 rows: wrong (stale)

N274 and N293 still say `ship-adr` was skipped. The code says otherwise: `docs/adr-done/ADR-265-...md:3` and `docs/adr-done/ADR-217-...md:3` both read `Status: Implemented`, and neither file is in `docs/adr/`. Shipped by PR #266 ("Ship ADR-265", merged 2026-11-16T09:57Z) and PR #253 ("Ship ADR-217; burst no longer skips ship-adr", 07:01Z) (API). N293's gap text ("ADR-217 still Pending", "N222 still Not done") also contradicts `docs/backlog.md:262`, where N222 is Done and says "ADR-217 shipped 2026-11-16". The strongest case for the skip (burst allowed it when the rows were written) is true for the time, but the reason no longer matches the code, so the marker is wrong as it stands. Class: **wrong**. Fix: delete both markers and rewrite N293's gap sentence. Size S.

### 3e. find-it test, N302 (suggestion cards): valid, being paid by a sibling batch

Strongest case: the visible-text acceptance of R3 was never run, and the row's own marker names the text to find. Check: `CARDS_FIRST = 4` (`src/core/wizard/suggest.ts:11`), `MIXES_FIRST = 2` (`src/core/wallfill.ts:120`), `clearFronts` (`src/core/snapshot.ts:271-312`) are in place. `tests/find-it/suggestion-cards.test.tsx` now exists and asserts 4 cards under "Suggested combinations", "Show more", 2 "Suggested mixes", 2 "Suggested room mixes" and see-through fronts at 390 and 1280 px (read, lines 38 to 91). It is untracked (`git status` shows `??`), so another worker wrote it in this tree; I did not run it. The browser scripts `tools/wizard-findings` (N310) and `tools/wall-fill` (N309) already check the 4-card and 2-mix counts. Class: **valid** (burst allows it, `CLAUDE.md:279`); the marker can go once that test is committed and passes.

### 3f. "The other 34 scripts re-run", N321: premature

Strongest case against skipping: the row closed G-510 and turned itself Done using "Evidence: from documents" (backlog:378), while the request behind G-510 was "For all failures, no skipping, all" (`GAPS-archive.md`, G-510 Request). `CLAUDE.md:313` allows a status change only with evidence that ran, and the burst list (`CLAUDE.md:279-282`) does not include this skip.

Check against the code: `tools/*/find-it*.mjs` holds 84 scripts today. The 38 repaired scripts each passed at the end of their batch (N304 to N310, documents), but 13 PRs merged afterwards (#267 to #280), and #274, #275, #279 and #280 change `src/styles.css` or layout (N325, N326, N328, N329). N328 re-ran only control-rule and catalog-flows (backlog:383). So a pass on 2026-11-16 morning is not proof for 2026-11-16 evening.

Cheapest proof: `pnpm regress --no-build` against a fresh `pnpm build` of d189439, or a subset by area (menus, plan, 3D toolbar, catalog) first. Size M for a subset, L for all (look-render alone needs about 25 minutes, `tools/regress.mjs:30`). A sibling worker is running the browser regression in this tree now; I did not read its result. Class: **premature**; also the row's "Done" status is wrong while this marker stands.

### 3g. Rows marked Done with open debt: wrong (status)

Ten rows read Done and still carry markers: N313, N314, N315, N318, N319, N320, N321, N322, N324, N327. `CLAUDE.md:292-293` says the row stays Partially done; `catch-up` step 6 says a row turns Done only when none of its gaps remain. For nine of them the open item is only live-verify (blocked, 3b); for N321 it is the 34 scripts as well. This is a status error, not a skip; it is fixed by changing the status (S) or by paying the marker.

### 3h. Gaps G-509 to G-523 checked against the code

| Gap | Check | Class |
| --- | --- | --- |
| G-509 | Remaining items need a real account and remote requests (`GAPS.md:1725-1730`) | blocked (external) for those items; the rest is scope |
| G-510 | Closed from documents; see 3f | premature (closure) |
| G-511 to G-516, G-518, G-519, G-520, G-522 | Each closing row cites tests or scripts that exist (read), PR heads green (API) | valid |
| G-517 | Length hook "kept as is" by the picked option; id check now in CI at `ci.yml:214`; neither observed catching a real collision | valid (open, bypasses recorded) |
| G-521 | Needs a judgement on translating board and hardware names (ADR-010) | needs consent |
| G-523 | `scripts/check-docs.py:55` builds the backlog as a dict keyed by id, so a second row with the same id silently overwrites the first; no duplicate check exists. Four ids are duplicated, not one (N164, N281, N302, N326). Renumbering is forbidden without the user (`CLAUDE.md` Never renumber) | needs consent for renumbering; wrong that G-523 names only one id |

### 3i. Counts

| Class | Pairs | Rows |
| --- | --- | --- |
| valid | 35 (29 lint-and-suite, 5 stage 03, 1 find-it) | see 3a, 3c, 3e |
| blocked (external) | 30 (live-verify) | 3b |
| wrong | 2 (ship-adr) | N274, N293 |
| premature | 1 (34 scripts) | N321 |
| avoidance | 0 | none |
| needs consent | 0 markers (G-521 and G-523 are gaps, not markers) | none |
| Total | 68 | |

---

## Stage 04: Patterns

1. **Evidence was written down once and never refreshed.** N274 and N293 keep a `ship-adr` marker and "still Pending" text after PRs #266 and #253 shipped the ADRs; the N302 find-it marker outlived the need. Shown by: N274, N293, N302.
2. **"Done" while debt is open.** Ten rows read Done with markers, against `CLAUDE.md:292-293`. Shown by: N313, N314, N315, N318, N319, N320, N321, N322, N324, N327. The same fault made G-510 close on documents (N321).
3. **Passing once is treated as passing later.** 38 scripts were repaired in the morning, then 13 PRs changed CSS and layout, and only two scripts were re-run. Shown by: N321, N314 (control-rule and catalog-flows before the chip CSS), N325 to N329.
4. **Bare "burst" as the only reason.** No row states a blocker, unblocker or size per skip (`CLAUDE.md:298`), so a reader cannot tell a paid item from an open one, nor cheap from expensive. Shown by: all 31 debt rows.
5. **The ship shortcut skipped the very checks the burst rule leans on.** The burst rule says "CI runs the rest" (`CLAUDE.md:281`), but `ci.yml:35-46` skips PR-level CI for any "Ship ADR-" commit, even one that holds the build (#260 to #264). Only the post-merge main run caught up. Shown by: N306 to N310.
6. **Id hygiene is checked against `main`, not within the ledger.** Four duplicated ids exist and `docs:check` cannot see them (`check-docs.py:55`); a gap names one of them. Shown by: N302 (339 and 369), N326 (384 and 386), N281, N164, G-523.

---

## Stage 05: Rules and re-plan

### Rules compared with what `CLAUDE.md` already says

| Proposed rule | How a reviewer checks it | Already in `CLAUDE.md`? |
| --- | --- | --- |
| A marker is removed in the same change that pays it, and any row text that says "not run" or "still Pending" is updated with it | `grep -c burst-skipped` before and after; the row text names the evidence | Partly: `catch-up` step 5 says remove the marker; nothing says to refresh prose. Sharpen the wording |
| A row with any `burst-skipped:` marker reads Partially done, whatever its other evidence | Script: a row with a marker and status Done fails `docs:check` | Already stated (`CLAUDE.md:292-293`) but not enforced. Add the check |
| Each marker names its unblocker and size, for example `burst-skipped: live-verify: find "Show 8 more" (burst, date, M)` | Reviewer reads one marker and knows what to do | Partly: only find-it names the visible text (`CLAUDE.md:292`). Extend to every marker kind |
| Closing a gap or turning a row Done needs a run after the last UI-affecting merge, or the closing text says "not re-run since PR #n" | The closing row cites a run id or command newer than the last CSS change | Partly: `CLAUDE.md:313` asks for evidence; it does not say how fresh |
| A duplicate backlog id fails `docs:check` | Run it on a branch with two rows of one id | Not stated |

I propose nothing about `ship-check` without the user, since it is a user rule of 2026-10-29.

### Re-plan in dependency order

**Do now (low risk)**

1. Delete the `ship-adr` markers on N274 and N293 and rewrite N293's stale sentence (S).
2. Record that the 29 lint and suite markers are paid by the CI runs listed in 3a, and remove them (S).
3. Commit and run the untracked `tests/find-it/suggestion-cards.test.tsx`, then remove N302's find-it marker (S).
4. Accept this report as the stage 03 run and remove the 5 stage 03 markers (S).
5. Set the ten Done rows back to Partially done while their live-verify marker stands (S).
6. Run `pnpm regress --no-build` on a build of d189439, subsets first (menus, plan, 3D toolbar, catalog), then the rest; then remove N321's marker (M to L). Depends on the sibling run now using `dist/`.
7. Add a duplicate-backlog-id check to `scripts/check-docs.py` that reports the four current duplicates as known (S).

**Needs consent**

8. Which row keeps each of N326, N302, N281, N164, and what new id the other gets (S, user decision, `CLAUDE.md` never renumber).
9. Board and hardware print names for G-521 (M, ADR-010 judgement).
10. Whether `ship-check` should key on the changed file list instead of the commit subject (S, user rule 2026-10-29).
11. Live-verify of 30 rows: needs a person or a session with a browser and access to github.io (M, blocked external).

## Proposed gaps (for the main session to record with `pnpm gaps add`)

1. **Stale burst markers and Done rows with open debt.** Origin: skip review of the 2026-11-15 to 2026-11-16 burst. Missing: `ship-adr` markers on N274 and N293 although ADR-265 and ADR-217 are shipped; N293's "still Pending" text; ten Done rows with markers. Request: "Run skip-review stages 01 to 05 over the burst window". Questions: none. Pick: remove paid markers with the CI evidence in 3a and set the ten rows to Partially done.
2. **34 repaired browser scripts not re-run after later UI changes.** Origin: N321 and G-510 closure. Missing: a run of the 34 scripts after PRs #267 to #280. Questions: none. Pick: `pnpm regress --no-build` on d189439, subsets first.
3. **`docs:check` does not reject duplicate backlog ids.** Origin: G-523 and this review. Missing: N164, N281, N302, N326 are each used twice; `check-docs.py:55` overwrites silently. Questions: which row keeps each id. Pick: add the check, leave renumbering to the user.
