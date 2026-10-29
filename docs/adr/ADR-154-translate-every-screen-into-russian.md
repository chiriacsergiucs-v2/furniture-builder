# ADR-154: Translate every screen into Russian

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-153
- Design: docs/ui-design.md
- Backlog: N156

## Context

Part of the user's request of 2026-10-29 ("translate all the existing content"), see
[ADR-153](ADR-153-switch-the-app-between-english-and-russian.md). Answer: scope "UI + diagnostics + print/CSV",
Russian "I translate, no review".

## Decision

- Every visible text in `src/ui` and `src/viewer` (labels, buttons, headings, hints, notices, confirm questions,
  `aria-label`, `title`, `placeholder`) goes through `t` or `tNode`; each gets its Russian entry in
  `src/core/i18n/ru/<area>.ts`.
- Text that is also an identifier (ids, file names, stored values, CSS classes) is not translated.
- Generated part names ("Left side", "Shelf") are shown through `tr`.
- English stays the default; with English chosen the app looks exactly as before.

## Alternatives considered

- **Translate only the main screens** — the user asked for all the existing content.

## Scope

- In scope: all of `src/ui` and `src/viewer`.
- Elsewhere: built-in data (ADR-155), problem messages (ADR-156), print and CSV (ADR-157).
- Out of scope: the Gaps page (user 2026-10-29: "Ignore gaps", G-303).

## Consequences

- Positive: a Russian speaker can use every screen.
- Negative / risks: longer Russian text may wrap more on phones.

## Done when

- [x] Every existing test still passes in English.
- [x] Find-it at 390 and 1280 px in Russian: "Проекты", "Каталог", "Редактор" and the More menu items are found by
      role and text (`tests/find-it/language.test.tsx`).

## Open questions

None. All answered by the user on 2026-10-29.
