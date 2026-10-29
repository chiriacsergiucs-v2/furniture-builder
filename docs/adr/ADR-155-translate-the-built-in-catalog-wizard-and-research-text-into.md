# ADR-155: Translate the built-in catalog, wizard and research text into Russian

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-153
- Design: n/a
- Backlog: N157

## Context

Part of the user's request of 2026-10-29 ("translate all the existing content"), see
[ADR-153](ADR-153-switch-the-app-between-english-and-russian.md). Asked whether built-in data text (about 20k words
of Feature Research and 8k words of catalog and wizard text) is translated too: "Everything, research too".

## Decision

- Catalog items (names, descriptions, categories), project templates and samples, the New-piece wizard (steps,
  questions, options, hints) and Feature Research (features, assessments, citation summaries) are shown through
  `tr`, with their Russian text in `src/core/i18n/ru/data-*.ts`.
- The data files themselves stay English: ids, saved names and tests do not change. A design saved while Russian is
  chosen keeps the name the user sees (it is the user's own text from then on).
- Quotes from English sources are shown translated; the source link and title stay as published.

## Alternatives considered

- **Russian fields in each data record** — changes the data types and every reader; a lookup keeps the data as is.

## Scope

- In scope: catalog, templates, samples, wizard, research data.
- Out of scope: names the user typed.

## Consequences

- Positive: the catalog and wizard read in Russian.
- Negative / risks: a data text changed in English loses its Russian until the entry is updated; the coverage test
  catches it.

## Done when

- [ ] A test walks every catalog, wizard and research text and finds a Russian entry for each
      (`tests/i18n-data.test.ts`).

## Open questions

None. All answered by the user on 2026-10-29.
