# ADR-153: Switch the app between English and Russian

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-002, ADR-020
- Design: docs/ui-design.md (More menu)
- Backlog: N155

## Context

User 2026-10-29: "add support for Russian language, have it toggle, also translate all the existing content, also
add a page where you list all the features that the app currently supports, grouped by domain(moving, composition,
aligning, creating and so on, you make the tree-like domain with whall features we have), add a implementation
rule/constraint to also add translation on any text added/modified/deleted."

Answers the same day: scope "UI + diagnostics + print/CSV"; toggle "EN/RU switch, default EN"; rule "CLAUDE.md +
type check"; delivery "One PR, several ADRs"; Russian "I translate, no review"; data text "Everything, research
too"; switching "Reload on switch"; font "Add a local Cyrillic font". The request is split into ADR-153 (this base),
[ADR-154](ADR-154-translate-every-screen-into-russian.md) (screens),
[ADR-155](ADR-155-translate-the-built-in-catalog-wizard-and-research-text-into.md) (built-in data),
[ADR-156](ADR-156-translate-the-problem-messages-into-russian.md) (problem messages),
[ADR-157](ADR-157-choose-the-language-of-printed-sheets-and-the-parts-csv.md) (print and CSV) and
[ADR-158](ADR-158-add-an-information-and-guides-page-with-the-feature-tree.md) (Information and guides).

The CLAUDE.md line "the app UI is in English" (ADR-020) becomes "English by default, Russian on request".

## Decision

- `src/core/i18n/` (pure TypeScript): `Lang = 'en' | 'ru'`, `setLang`, `getLang`, `t(key, params?)`. The key is
  the English text itself; the Russian dictionary maps each English text to its Russian text. `t` only accepts
  keys of the dictionary, so a text without a Russian entry fails `pnpm typecheck` (the user's rule).
- Placeholders `{name}`; plurals `{n|part|parts}` in English and `{n|деталь|детали|деталей}` in Russian.
- `tr(text)`: a lookup for text that comes from data (catalog, wizard, research, generated part names); it falls
  back to the English text. Tests check that every built-in data text has a Russian entry.
- `src/ui/i18n.tsx`: `tNode` for a sentence with elements inside.
- The language is kept on the device (`localStorage` `fb:lang`, like the theme), read before the app loads
  (`src/langInit.ts`, first import of `main.tsx`), and sets `<html lang>`. Default English.
- Toggle: More menu → **Language** → English / Русский. Switching saves the choice and reloads the page; designs are
  autosaved, the undo history and open dialogs are cleared (the user's choice).
- Font: Barlow has no Cyrillic, so `@fontsource/fira-sans` and `@fontsource/fira-sans-condensed` (OFL-1.1, no
  telemetry) are bundled for the Cyrillic range only; works offline.
- CLAUDE.md rule: every text added, changed or deleted in the app updates its Russian entry in the same change.

## Alternatives considered

- **Generated keys (`inspector.addShelf`)** — every find-it test and every source line would lose the English
  text; English-as-key keeps the code readable and the tests unchanged.
- **i18next** — a dependency for what a 100-line module does; no type check of missing keys without extra tooling.
- **Live switch without reload** — the user chose reload (+40 % work avoided).

## Scope

- In scope: the module, the toggle, the reload, the font, the CLAUDE.md rule, tests of `t`.
- Out of scope: a third UI language (not asked, G-301); a hardcoded-string lint (the user chose type check only,
  G-302).

## Consequences

- Positive: one place for every text; a missing Russian text fails CI.
- Negative / risks: the dictionary is large; a text left outside `t` stays English (no lint, by the user's choice).
- Harder to change later: English-as-key means changing an English text also changes its key.

## Done when

- [ ] `t` fills placeholders and picks English and Russian plural forms (`tests/i18n.test.ts`).
- [ ] A key without a Russian entry fails `pnpm typecheck` (`@ts-expect-error` in `tests/i18n.test.ts`).
- [ ] Find-it at 390 and 1280 px: More → "Language" → "Русский" saves `ru` and reloads
      (`tests/find-it/language.test.tsx`).
- [ ] CLAUDE.md has the translation rule.

## Open questions

None. All answered by the user on 2026-10-29 (see Context).
