---
name: babysit
description: Watch a pull request Claude opened in this repo and drive it to merged — CI failures, merge conflicts, review comments and bot findings — then ship its ADR and merge once it is green. Use when the user says "babysit", "watch the PR", "drive it to green", "autofix CI", or right after Claude opens a pull request and the user agrees to have it watched.
---

# Babysit a pull request

Drives a pull request **Claude opened** to merged (user rules 2026-10-29). For a pull request
the user only asked to watch, report each event and ask before pushing anything.

Project: **Furniture Builder** — offline PWA. CI (`.github/workflows/ci.yml`) is the source of
truth; `deploy.yml` publishes `main` to GitHub Pages.

## Start

1. Subscribe to the pull request's activity, then end the turn. Events wake the session; never
   poll with `sleep`.
2. On every event, look at the whole pull request on its current head: merge state, CI on the
   latest commit, open review threads. Act on every open item, in the order below.

## Each event, in order

1. **Merge conflict** → merge `main` into the branch (never rebase or force-push a pushed
   branch), resolve, regenerate `pnpm-lock.yaml` with `pnpm install` and `docs/catalog.md` with
   `pnpm catalog:docs`, never by hand. ADR, F/N/D and G ids that collide with `main` are
   renumbered on **this** branch only (never renumber an id already on `main`).
2. **CI red** → read the job log, reproduce the failing check locally, fix the cause, run the
   `verify` skill, push. Never skip, disable or loosen a test, lint rule or check; never push an
   empty commit to re-run CI. A check also red on `main` is not this pull request's: say so once
   on the pull request and port the fix if one exists.
3. **Review comments**
   - Blocking findings and a human reviewer's small asks: fix and push, reply on the thread
     naming the commit, resolve it.
   - Optional findings (nit, suggestion, style): reply once in one line and resolve; plainly
     correct ones ride the **next push that already changes this pull request's files** — never a
     push for a nit alone.
   - Larger asks (several files, model or storage shape, a new decision): ask the user. A changed
     decision gets a new ADR (`new-adr`), never an edit to an implemented one.
   - A finding that would invent a hardware or supplier fact (ADR-010): ask the user.
4. **Visible change in a push** → the snapshot rule of `CLAUDE.md` still holds: show the
   screenshots last in the reply, above the questions, and wait for confirmation before the
   next tests.
5. **Ledger** → each push that changes behaviour updates the backlog row with the evidence
   that ran (command output or CI run id), and `docs/adr/GAPS.md` for anything not built.

## Before every push

Run the `verify` skill and, where it applies, the fuzz run and the find-it test (jsdom, or the
browser script for `Acceptance: browser`). Re-read the diff for what CI would reject. Push only
when everything is clean.

## When green — merge and ship (user rule 2026-10-29)

Green = CI passes on the latest commit, no merge conflict, no review thread waiting on Claude,
every `Done when` item has evidence, and the user confirmed the screenshots.

1. Run the `ship-adr` skill for the pull request's ADR **on the branch** and push the ship
   commit (`Ship ADR-NNN: <short title> — mark implemented`) after `pnpm docs:check` and
   `pnpm format:check` pass locally. Do not wait for CI on the ship commit (user rule 2026-10-29).
2. Merge the pull request into `main` (merge commit; never force-push `main`).
3. Wait for the `Deploy GitHub Pages` run on `main` and cite its run id. Say "deployed", not
   "live-verified", unless the published URL was opened and checked.
4. Unsubscribe, cancel any pending check-in, and report: where to click, merged, deployed run
   id, the backlog table and **Skipped this iteration**.

A pull request with no ADR (docs or rules only) skips step 1.

## Quiet periods

While the pull request only waits on CI or reviewers, keep one safety-net check-in: about 50
minutes after the last activity, then about every 4 hours. If nothing changed, re-arm silently.
Stop after 3 check-ins in a row with nothing new, or when the pull request is merged or closed,
and say once that check-ins stopped.

## Stop

Stop and ask when a fix needs the network (ADR-002), a saved-design or storage change without
an ADR, or a decision only the user can make. The user saying "stop" ends babysitting:
unsubscribe and push nothing more.
