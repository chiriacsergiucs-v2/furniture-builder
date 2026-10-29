# ADR-157: Choose the language of printed sheets and the parts CSV

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-020, ADR-153
- Design: docs/ui-design.md (More menu)
- Backlog: N159

## Context

Part of the user's request of 2026-10-29, see [ADR-153](ADR-153-switch-the-app-between-english-and-russian.md).
Answers: scope "UI + diagnostics + print/CSV"; with the UI in English, print and CSV use "Own setting: RO/RU/EN".

This changes [ADR-020](../adr-done/ADR-020-printing-and-drawings-svg-from-the-model-plus-a-print-styles.md):
"printed sheets and the parts CSV are in Romanian" becomes "in Romanian by default, or Russian or English when the
user chooses".

## Decision

- Print language `ro | ru | en`, kept on the device (`localStorage` `fb:print-lang`), default Romanian.
- More menu → **Print language** → Română / Русский / English. No reload needed: sheets and CSV are made when asked.
- `src/core/ro.ts` and the print sheet take their words from one table per language; Romanian output stays
  byte-identical to today.
- Applies to printed sheets, drawings' labels, the parts CSV and the review pack.

## Alternatives considered

- **Follow the UI language** — the user chose an own setting so Romanian stays the default for the panel shop.

## Scope

- In scope: print sheets, CSV, review pack text.

## Consequences

- Positive: a Russian or English panel shop gets sheets it can read.
- Negative / risks: three tables to keep in step; a test checks every Romanian entry has Russian and English.

## Done when

- [ ] Romanian CSV and sheet text are unchanged (`tests/ro.test.ts` passes unchanged).
- [ ] With print language `ru` and `en` the CSV header and part names are Russian and English
      (`tests/i18n-print.test.ts`).
- [ ] Find-it at 390 and 1280 px: More → "Print language" → "English" is kept (`tests/find-it/language.test.tsx`).

## Open questions

None. All answered by the user on 2026-10-29.
