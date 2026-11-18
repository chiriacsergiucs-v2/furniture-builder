# Skip review, batch D: burst rows N338, N339, N342, N343, N344, N345, N346

Date: 2026-11-19. Branch `catch-up-2026-11-19`. Method: the `skip-review` skill, stages 01 to 05. Analysis only: no
code, ledger, CLAUDE.md or settings were changed, and no build, test or regress run was started (only reads, `pnpm gaps
list`, `pnpm ls`, `pnpm why` and `pnpm audit`, all read-only). Every claim is marked **read** (file:line) or **ran**
(a read-only command run for this review).

## Answer first: did we cover it all?

Not yet, but nothing was dropped silently. 38 skip items were found across the seven rows. 18 are valid, 8 are blocked
by something external (the deploy, hosted settings or a compiler release), 8 need the user's consent, 3 are premature
(a cheap proof or fix existed), 1 is wrong (the debt marker does not match its own rule) and 0 are avoidance. Every
unfixed code item named in the rows has a G id that exists and is Open in `docs/adr/GAPS.md`, with two exceptions of
detail (N343's remaining audit advisories and N344's missing id in the row text, see stage 02). The only open debt
that is plain burst debt (find-it, live-verify, stage 03, ship-adr) is the part this batch is paying.

Note on state: three untracked files already exist in the tree, `tests/find-it/quick-count-limits.test.tsx`,
`tests/find-it/import-too-large.test.tsx` and `tests/find-it/wizard-labels.test.tsx` (read from `git status`). They are
other work in the same tree and look like the find-it debt of N338, N342 and N345. I did not run them and did not
count them as evidence.

Missing source: the reports named in the gaps and rows (`.tmp/current/bug-hunting-report.md`,
`reuse-hunting-report.md`, `security-scan-report.md`, `dependency-report.md`, `dead-code-report.md`) are not in the
repo (`ls .tmp/current` fails). Anything that rests only on them is "not found in the repo".

## Stage 01: Inventory

Skip ids are `<row letter>-<n>`: N338 = a, N339 = b, N342 = c, N343 = d, N344 = e, N345 = f, N346 = g. Rows carry
their text in `docs/backlog.md` (the row for each id is the `| Nxxx |` line; the file has no stable line numbers
across the burst, so the row id is the location).

| Id | Row | Item skipped | Where | Reason, word for word |
| --- | --- | --- | --- | --- |
| a-1 | N338 | H-1 seller pictures on by default | row N338; G-536 | "H-1 left for the user" |
| a-2 | N338 | Print path does not translate 'Worktop 38' | row N338; G-537 | "(UI only)"; "print path not translating 'Worktop 38' (G-537)" |
| a-3 | N338 | L-2 sites with another formula | row N338; G-538 | "L-2 sites with another formula (G-538)" |
| a-4 | N338 | find-it, stepper at limits | row N338 | "burst-skipped: find-it stepper at limits (burst, 2026-11-17)" |
| a-5 | N338 | live-verify | row N338 | "burst-skipped: live-verify" |
| a-6 | N338 | skip-review stage 03 | row N338 | "burst-skipped: skip-review stage 03" |
| a-7 | N338 | lint, fuzz, vitest related, prettier only by subagent | row N338, evidence cell | "Subagent reports, not re-run by the orchestrator" |
| b-1 | N339 | H1 Russian key conflicts | row N339; G-539 | "H1 Russian key conflicts (G-539)" |
| b-2 | N339 | M2 createExternalValue, M3 variants | row N339; G-540 | "M2 createExternalValue and M3 variants (G-540)" |
| b-3 | N339 | L7 and boundary-blocked copies | row N339; G-541 | "L7 and boundary-blocked copies (G-541)" |
| b-4 | N339 | find-it for the new helpers | row N339 | "burst-skipped: find-it for the new find-it helpers" |
| b-5 | N339 | live-verify | row N339 | "burst-skipped: live-verify" |
| b-6 | N339 | skip-review stage 03 | row N339 | "burst-skipped: skip-review stage 03" |
| c-1 | N342 | M-1 and M-4 (picture and row validation) | row N342; G-542 | "Unfixed, recorded: M-1/M-4 (G-542)" |
| c-2 | N342 | M-5 hosted auth settings | row N342; G-543 | "M-5 (G-543)" |
| c-3 | N342 | L-2, L-4, L-5, L-6 | row N342; G-544 | "L-2/L-4/L-5/L-6 (G-544)" |
| c-4 | N342 | find-it for the import error | row N342 | "burst-skipped: find-it for the new import error message" |
| c-5 | N342 | live-verify | row N342 | "burst-skipped: live-verify" |
| c-6 | N342 | skip-review stage 03 | row N342 | "burst-skipped: skip-review stage 03" |
| d-1 | N343 | vitest 4.1.12 reverted | row N343; G-545 | "reverted, recorded in G-545: vitest 4.1.12" |
| d-2 | N343 | typescript 7.0.2 reverted | row N343; G-545 | same sentence |
| d-3 | N343 | vite 8.3.8 and plugin-react 6.3.0 reverted | row N343; G-545 | same sentence |
| d-4 | N343 | three-mesh-bvh bump | G-545 | "does the three-mesh-bvh bump (not approved) go ahead?" |
| d-5 | N343 | 2 critical, 1 high, 3 moderate advisories remain | row N343 | "9 advisories to 6 (2 critical and 1 high remain: tinypool via vitest 3, picomatch with no fix; 3 moderate via vitest 3)" |
| d-6 | N343 | find-it and live-verify for the peer warning | row N343 | "burst-skipped: find-it and live-verify for the three-mesh-bvh peer warning" |
| d-7 | N343 | skip-review stage 03 | row N343 | "burst-skipped: skip-review stage 03" |
| e-1 | N344 | MAX_SHELVES and MAX_DRAWERS value conflict | row N344; G-546 | "gap added this session" |
| e-2 | N344 | find-it for wizard and sellers modules | row N344 | "burst-skipped: find-it for the wizard and sellers modules" |
| e-3 | N344 | live-verify | row N344 | "burst-skipped: live-verify" |
| e-4 | N344 | skip-review stage 03 | row N344 | "burst-skipped: skip-review stage 03" |
| f-1 | N345 | Seating, Sleeping and lying, stored Wardrobe name | row N345; G-547 | "Unfixed, recorded: ... (G-547)" |
| f-2 | N345 | find-it for wizard labels | row N345 | "burst-skipped: find-it for wizard labels" |
| f-3 | N345 | live-verify | row N345 | "burst-skipped: live-verify" |
| f-4 | N345 | skip-review stage 03 | row N345 | "burst-skipped: skip-review stage 03" |
| g-1 | N346 | ship-adr for ADR-279 | row N346 | "burst-skipped: ship-adr (Done when item 5 needs the Pages deploy after the merge)" |
| g-2 | N346 | live-verify after deploy | row N346 | "find 'Sheets to buy' under Cut list > Sheets" |
| g-3 | N346 | types.ts and project.ts hubs not split | row N346; G-548; ADR-279 Scope | "hubs: G-548" |
| g-4 | N346 | other workspace packages not extracted | row N346; G-549; ADR-279 Scope | "Later packages: G-549" |

N346 has no stage 03 marker of its own; this review is its first stage 03 anyway.

## Stage 02: Reasons and evidence

| Id | Stated reason | Evidence it relied on | What the evidence did not cover |
| --- | --- | --- | --- |
| a-1 | User keeps H-1 | the user's approval list (medium and low only) | Nothing; it is a user decision. G-536 text is correct: `src/ui/ProductPicker.tsx:56` defaults to on (`!== 'off'`) (read) |
| a-2 | UI-only fix | read: `src/core/i18n/ru/data-parts.ts:260` has the entry; `src/core/ro.ts:408`, `src/core/shopping.ts:162` still print `materialName` | The approved M-1 asked for the Russian entry; print was not tried, though G-537 is accurate |
| a-3 | Other sites use another formula | G-538 lists sites | No per-site check is in the row; the listed sites are cheap to check one by one |
| a-4, c-4, e-2, f-2, b-4 | burst rule (find-it is skipped in burst) | CLAUDE.md "Burst mode" | Each names its visible text except d-6 (see stage 03) |
| a-5, b-5, c-5, e-3, f-3, g-2 | burst rule, and a deploy is needed | CLAUDE.md "Burst mode" | Nothing was opened on the live URL |
| a-6 to f-4 stage 03 | burst rule | CLAUDE.md "Burst mode" | Paid by this report |
| a-7 | Four checks only by subagent report | the row labels them "Subagent reports, not re-run by the orchestrator" | The label agrees with the "Executed" list; the checks are unproven for this session |
| b-1 | User must pick Russian wording | G-539 | G-539 is not updated after N345 changed part of H1 (see findings) |
| b-2 | localStorage bodies differ; variants unlike | G-540 | G-540 asks "Accept a larger extraction under ADR-016?" although the user approved "all Medium" in the request that created N339 |
| b-3 | Layer boundaries (Deno, tools cannot import src) | G-541 | Fine for B1 and B3; L7 isInt and wallfill differ from `guards.ts` and was not re-tried |
| c-1 | Not approved; ADR-011 implication | G-542 cites `src/persist/images.ts:128`, `src/core/backup.ts:211-219` | Not re-read here beyond the cited ids |
| c-2 | Hosted setting | G-543: `supabase/config.toml:227`, `:183` | Hosted project not checked (cannot be, here) |
| c-3 | Not approved | G-544 | L-4 (pin workflow actions) is S-sized; skipped only because not approved |
| d-1 | Fails `tests/find-it/seller-pictures.test.tsx` BASE_URL expectation | G-545 | Cause is a test expectation, not product behaviour; not diagnosed further |
| d-2 | typecheck and build fail at `src/core/account.ts:98`, `tests/helpers/warningKeys.ts` | G-545 | Not re-run here (not allowed) |
| d-3 | static import of react-three into main bundle (`tests/bundle-boundary.test.ts`, ADR-222) | G-545 | plugin-react 6.3.0 is in the row but absent from G-545's Missing text |
| d-4 | Not approved | G-545 | Bump version availability not checked |
| d-5 | No fix exists or the parent (vitest 3) is pinned | row N343 | Not recorded as their own gap; G-544 L-5 only says "see dependency health" |
| d-6 | burst | row N343 | A peer warning has no visible text; no "visible text to find" is named, against the debt-record rule |
| e-1 | Intent unconfirmed | G-546 | The row says "gap added this session" without the id |
| f-1 | Stored data would change | G-547 | None |
| g-1 | Item 5 needs the deploy | ADR-279 Done when item 5 | See stage 03 |
| g-3, g-4 | ADR-279 Out of scope | ADR-279 Scope; G-548, G-549 | None |

### Check: are the unfixed items recorded with G ids?

| Row | Unfixed items named | Gap ids cited | Exist and Open (ran: `pnpm gaps list`) | Verdict |
| --- | --- | --- | --- | --- |
| N338 | H-1, print, L-2 sites | G-536, G-537, G-538 | yes, all Open | Complete |
| N339 | H1, M2/M3, L7 and boundary | G-539, G-540, G-541 | yes | Complete, but G-541's Origin also lists L5 and B2, which the row does not name (it says "L1-L7" built) |
| N342 | M-1, M-4, M-5, L-2, L-4, L-5, L-6 | G-542, G-543, G-544, G-536 | yes | Complete |
| N343 | four majors, three-mesh-bvh, advisories | G-545 | yes | Majors and bvh recorded. plugin-react 6.3.0 and the 2 critical and 3 moderate advisories are not named in G-545; only indirectly in G-544 L-5 |
| N344 | MAX_SHELVES / MAX_DRAWERS | "gap added this session" (no id) | G-546 exists | Recorded, but the row does not cite the id, against the "cite the G ids" rule |
| N345 | Seating, Sleeping and lying, Wardrobe | G-547 | yes | Complete |
| N346 | hubs, later packages | G-548, G-549 | yes | Complete |

G-536 to G-549 are all Open in `docs/adr/GAPS.md` (`### G-536` at line 1832 to `### G-549` at line 1987); none is in
`GAPS-archive.md` (ran: grep returned nothing).

### Check: "executed in this session" against "subagent report" labels

| Row | Executed claims | Labels | Agrees? |
| --- | --- | --- | --- |
| N338 | typecheck, build, format:check, docs:check | lint, fuzz, vitest related, prettier marked as subagent reports | Yes, consistent. The cell title still says "Executed in this session", then splits off the subagent items, which is clear |
| N339 | typecheck, build, format:check, docs:check, fuzz 30000, vitest related over 88 files, i18n set | no label at all | Cannot be checked: a long list, none marked as subagent. Treat as unverified here |
| N342 | typecheck, build, format:check, docs:check, vitest 161 passed | none | Cannot be checked; plausible, the test files exist (read: `tests/security-fixes.test.ts`, `tests/own-edits-proto.test.ts`) |
| N343 | typecheck, build, format, docs, targeted 34 passed | full `vitest run` 273 files marked "subagent report, not re-run" | Yes |
| N344 | typecheck, build, format, docs, targeted 72 passed | "vitest related" marked subagent | Yes |
| N345 | typecheck, build, format, docs, vitest 66 passed | "find-it wizard: 6 passed (subagent report)" | Yes. Note the find-it that ran is the existing wizard test, so it does not cover the new labels and the burst find-it marker still stands |
| N346 | everything "ran locally on Node 22" | no subagent label | Evidence caveat: `package.json` engines is `>=24.15 <25` (read) and this machine's `node -v` is v22.23.4 (ran), so the claim is consistent but the engines range was not met |

## Stage 03: Cross-examination

Class key: valid, premature, wrong, avoidance, needs consent, blocked (external).

| Id | Strongest case against skipping | Check against the code | Class | Cheapest proof or fix, size |
| --- | --- | --- | --- | --- |
| a-1 | H-1 breaks a written network rule | read: `ProductPicker.tsx:16-19,56`; ADR-161 is implemented (`docs/adr-done/ADR-161-...`) and names the user's exception | needs consent | Decision: rule text or default. G-536 |
| a-2 | M-1 was approved, so print should also show Russian | read: `ro.ts:408`, `shopping.ts:162` print `materialName`; `src/core/i18n/print.ts:49-53` says names are never looked up, so changing print is a policy change | needs consent | Decide whether built-in names translate on print (M). G-537 |
| a-3 | L-2 was approved; leftover sites are only checked, not decided | read: `boxCentre` exists at `src/core/geometry.ts:16`; G-538 lists nine UI/viewer and six core sites | premature | Check each site's formula against `boxCentre`; move those that match (M). G-538 already records it |
| a-4 | Cheap in jsdom | the new untracked `tests/find-it/quick-count-limits.test.tsx` shows it was cheap (read: it finds `Decrease/Increase Plinth height`) | valid (burst rule) | Run it at catch-up (S) |
| a-5 | Cannot be checked before deploy | live site only | blocked (external) | Open the Pages URL after deploy (S) |
| a-6 | None | this report | valid | Paid |
| a-7 | Subagent claims are not proof (CLAUDE.md conduct rule 3) | cannot re-run now | valid (disclosed) | Re-run lint, fuzz, related at catch-up (S) |
| b-1 | Ten keys fixable by `@@context` (as N345 did) | G-539 says wording must be chosen by the user | needs consent | User picks wording |
| b-2 | The user approved all Medium items; G-540 asks again for consent under ADR-016 | read: `src/store/deviceValue.ts` and `tools/lib/harness.mjs` exist; the variants differ (`failed++`, `ok:!!ok`) | premature | Extract per variant behind the existing helper, one at a time (M). G-540 already records it |
| b-3 | L7 may be unified | read: `src/core/guards.ts` exists; boundary reasons (Deno, tools) are real | valid | None for B1/B3; L7 is S if wanted |
| b-4 | Cheap | helpers are tests themselves | valid (burst rule) | Run the find-it suite at 390 and 1280 px at catch-up (S) |
| b-5 | none | | blocked (external) | as a-5 |
| b-6 | none | | valid | Paid |
| c-1 | Medium security items | G-542 cites `src/persist/images.ts:128`, `src/core/backup.ts:211-219` | needs consent | Approve approach; ADR-011 touch (M) |
| c-2 | Auth confirmations off | G-543 cites `supabase/config.toml:227,183` | blocked (external) | A hosted dashboard change by the owner (S) |
| c-3 | L-4 is trivial | G-544 | needs consent | L-4 pinning is S; the rest M |
| c-4 | Cheap | read: `src/ui/shell/importFile.ts:12,28-31` has the message; `tests/find-it/import-too-large.test.tsx` now exists | valid (burst rule) | Run it (S) |
| c-5 | none | | blocked (external) | as a-5 |
| c-6 | none | | valid | Paid |
| d-1 | The approved list named vitest; only one test expectation fails | read: `package.json` pins `vitest 3.2.7`; ran: `pnpm audit` still shows 2 critical tinypool and 3 moderate vitest advisories under `.>vitest` | premature | Fix the BASE_URL expectation in `tests/find-it/seller-pictures.test.tsx` and retry vitest 4 (M). G-545 already records it |
| d-2 | Named major | read: `package.json` has `typescript 5.9.3` | valid | The failing site is the compiler API in a helper; a real port, L. Recorded in G-545 |
| d-3 | Named majors | read: `vite 7.3.7`, `@vitejs/plugin-react 5.2.0`; bundle boundary is an ADR-222 hard test | valid | L; plugin-react is missing from G-545's text, add it (S) |
| d-4 | The peer warning is real | ran: `pnpm ls three-mesh-bvh three` shows `three-mesh-bvh@0.9.16` and `three@0.187.0`; read: `pnpm-lock.yaml:2833-2838` shows `three-gpu-pathtracer@0.0.28` peer `three-mesh-bvh: '>=0.9.17'`; `package.json:48` pins `0.9.16`. The N343/G-545 claim is correct. Also `pnpm why` shows a second copy `0.8.3` via drei (`^0.8.3`) | needs consent | The bump is "not approved"; one pin plus a test of the path tracer (S to M) |
| d-5 | Two critical advisories remain | ran: `pnpm audit` now reports 5 (2 critical, 3 moderate) in `.>vitest>tinypool` and `@vitest/mocker`; the row says 6 with 1 high (picomatch). The high no longer shows | blocked (external) | Gone when vitest 4 lands (d-1); no advisory gap of its own exists. Counts differ from the row, likely advisory database changes; unverified |
| d-6 | The marker names no visible text and a peer warning has no UI | read: CLAUDE.md "Debt record" requires a find-it item to name its visible text; the other rows do | wrong | The real check is the install log or the lockfile line (S). Rewrite the marker as install-time, not find-it |
| d-7 | none | | valid | Paid |
| e-1 | Two limits for one name look like a bug | read: `src/core/design.ts:755,757` `MAX_SHELVES = 50`, `MAX_DRAWERS = 20`; `src/core/counts.ts:32-33` `12` and `10`. The row's claim matches the code | needs consent | Intent unconfirmed; G-546 asks it |
| e-2 | Cheap | wizard and sellers tests exist (`tests/find-it/wizard.test.tsx`, `sellers.test.tsx`) | valid (burst rule) | Run at catch-up (S) |
| e-3 | none | | blocked (external) | as a-5 |
| e-4 | none | | valid | Paid |
| f-1 | Stored labels | read: `src/core/wizard/registry.ts:131` tags `Wardrobe@@wizard`, `:136` default name `Wardrobe` is stored | needs consent | Stored data must not be rewritten (CLAUDE.md storage rule) |
| f-2 | Cheap | read: the six tags exist at `steps.ts:274,512,589,617,697` and `registry.ts:131`, `tr()` strips `@@` at `src/core/i18n/index.ts:88-91`; `tests/find-it/wizard-labels.test.tsx` now exists | valid (burst rule) | Run at catch-up (S) |
| f-3 | none | | blocked (external) | as a-5 |
| f-4 | none | | valid | Paid |
| g-1 | The ADR could be shipped in part | read: ADR-279 Done when item 5 is "`pnpm lint`, ... `docs:check` pass; CI and the Pages deploy pass". The first half ran locally (Node 22). "CI and the Pages deploy pass" can only be shown after the merge and deploy. Items 1-4, 6, 7, 8 look evidenced (read: `pnpm-workspace.yaml` lists `packages/*`; `packages/nesting/tests/nesting.test.ts`; `tests/core-boundary.test.ts:43,65,106-107`; CLAUDE.md line 41 and `docs/architecture.md:58,70`). The ADR file is still in `docs/adr/` with status Pending, and the README row (`docs/adr/README.md:343`) says Pending | valid | Item 5 is truly deploy-dependent, but only its second clause. Ship at catch-up once CI and Deploy runs are green (S). Note the tension: burst says do not look at main CI or deploy, and its ship-adr exception covers "needs the user's input", which a deploy wait is not |
| g-2 | none | | blocked (external) | Open the live URL, find "Sheets to buy" under Cut list > Sheets (S) |
| g-3 | The hubs block later packages | read: G-548 text and ADR-279 Scope place them out of scope | valid | Own ADR, M |
| g-4 | The user asked for multiple packages | read: ADR-279 Scope; G-549 lists the order | valid | One ADR per package, each M; planned |

Counts: valid 18 (a-4, a-6, a-7, b-3, b-4, b-6, c-4, c-6, d-2, d-3, d-7, e-2, e-4, f-2, f-4, g-1, g-3, g-4),
blocked (external) 8 (a-5, b-5, c-2, c-5, d-5, e-3, f-3, g-2), needs consent 8 (a-1, a-2, b-1, c-1, c-3, d-4, e-1,
f-1), premature 3 (a-3, b-2, d-1), wrong 1 (d-6), avoidance 0. Total 38.

### Other findings (not skips, but ledger accuracy)

| Row | Finding | Evidence |
| --- | --- | --- |
| N338 | The row says "quick-count +/- disabled at limits (`src/ui/controls.tsx:86,111`)". Those lines are the `MmField` size stepper (`disabled={disabled \|\| value - step < min}`), not the quick-count `Counter` (`controls.tsx:275` and following, `disabled={value <= min}`). The new find-it test uses `Plinth height`, so it follows the `MmField` reading. The row's "visible text to find" says quick-count stepper | read |
| N339 | G-541 lists L5 and B2, the row says L1-L7 built | read |
| N343 | Audit counts in the row (6, with 1 high) differ from the current `pnpm audit` (5, none high) | ran |
| N343 | The debt marker merges find-it and live-verify into one item and names no visible text | read |
| N344 | Row says "gap added this session" with no G id (G-546 exists) | read |
| N345 and G-539 | N345 resolved part of H1 by context keys, G-539 still lists the original ten conflicts unchanged; G-547 holds the leftovers | read |
| N346 | Local evidence is from Node 22, the repo targets Node 24 (`package.json` engines) | ran, read |
| All | The `.tmp/current` source reports are gone, so G-536, G-542 and N344 "see `.tmp/current/dead-code-report.md`" cannot be re-read | ran |

## Stage 04: Patterns

| Pattern | Skips that show it |
| --- | --- |
| 1. The same three burst items are copied onto every row (find-it, live-verify, stage 03) without checking whether the item can be done cheaply or applies at all. Result: a find-it item for an install-time warning, and a find-it for a wizard that already has a passing wizard find-it | a-4, b-4, c-4, d-6, e-2, f-2 |
| 2. Evidence is bundled in one cell, with subagent reports and orchestrator runs mixed, and some rows have no labels at all. Several "executed" claims cannot be told apart from reported ones | a-7, N339 and N342 evidence cells, N346 (Node 22) |
| 3. An approved item is closed after a partial fix and the rest handed to the user as a question, even where the user's earlier approval already answers it ("all Medium") | a-2, a-3, b-2, d-1 |
| 4. Gaps are recorded, but the pointer is lost: ids missing from row text, gap text not updated after a later fix, a gap with Missing text that omits an item named in the row | e-1, N339 (L5), G-539 after N345, d-3 (plugin-react), d-5 |
| 5. The ledger names a different thing than the code: quick-count against the size stepper; "debt" markers with no visible text | N338 citation, d-6 |
| 6. Deploy-dependent steps (live-verify, ship-adr) are parked by a rule that also forbids looking at the deploy, so nothing in a burst can ever unblock them without a catch-up | a-5, b-5, c-5, e-3, f-3, g-1, g-2 |

## Stage 05: Rules and re-plan

### Rules

The CLAUDE.md rules already cover much of this. New or sharper wording only:

| Proposed rule | Checked by | Against existing rules |
| --- | --- | --- |
| R-a. A debt marker is copied to a row only if it applies: a find-it names visible text that exists in the UI; an install-time or build-time change names its check (the lockfile line, the install log) instead | A reviewer greps each `burst-skipped: find-it` and finds quoted text in the app | Sharper than "Debt record" in CLAUDE.md, which only demands the visible text |
| R-b. In an evidence cell, every command carries one label (ran here, or subagent report), and an unlabelled command counts as unverified | Reviewer reads the cell; no unlabelled command | Sharper than conduct rule 3 ("Claims need evidence") |
| R-c. When an approved item is left partly built, the reply and the row say which part was approved and which not built, and the gap text quotes the approval | Reviewer matches each approved list item to a built change or a gap | New; related to R2 No avoidance |
| R-d. A row that cites a gap writes the id; when a later row changes the same gap's scope, it updates the gap text in the same change | Reviewer searches the id in GAPS.md after each row | Sharper than the "Gaps ledger" rule |
| R-e. A `burst-skipped: ship-adr` is allowed only when an unmet Done when item is named and each other item has evidence already listed in the row | Reviewer counts Done when items against evidence | Sharper than the burst note on ship-adr |

### Re-plan (dependency order)

Do now (low risk, no decision needed):

1. Pay find-it debt: run the three new find-it tests and the wizard, sellers and helper suites on the 390 and 1280 px
   setup (a-4, b-4, c-4, e-2, f-2) (S each).
2. Re-run lint, fuzz and related tests that were only subagent reports (a-7) (S).
3. Review `docs/backlog.md` row texts: add G-546 to N344, fix the N338 citation, rewrite the N343 marker (d-6),
   mention L5 on N339 (S).
4. Update G-545's Missing text to name plugin-react 6.3.0 (S), and G-539 to remove keys N345 fixed (S).
5. After CI and Deploy runs are green: ship ADR-279 (g-1) and live-verify "Sheets to buy" (g-2) (S).
6. Live-verify the other rows (a-5, b-5, c-5, e-3, f-3) in one visit (S).
7. a-3: check and move the matching `boxCentre` sites, one site at a time (M). b-2: extract the helper variants one at a
   time (M). d-1: fix the BASE_URL expectation, retry vitest 4, which also clears d-5's tinypool advisories (M).

Needs consent:

1. G-536 (a-1): keep pictures on and amend the rule, or default off (S).
2. G-537 (a-2): translate built-in names on print (M).
3. G-539 (b-1): Russian wording per key (S).
4. G-542 (c-1): validation approach (M); G-543 (c-2): hosted settings (S); G-544 (c-3): per item (S to M).
5. G-545 (d-4): the three-mesh-bvh bump, with a path-tracer check (S to M); typescript 7 and vite 8 order (d-2, d-3) (L).
6. G-546 (e-1): which limit each name means (S).
7. G-547 (f-1): stored labels vs display labels (M).
8. G-548, G-549 (g-3, g-4): one ADR each, in order.
