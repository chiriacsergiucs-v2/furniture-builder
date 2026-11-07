#!/usr/bin/env node
/**
 * What a gap and feature sync must still check (CLAUDE.md, user rule 2026-11-05: "future syncs only check unmarked
 * ones, not entire list"). Prints, from the feature tree (`src/ui/info/features.ts`, ADR-158) and the ADR folders:
 *
 *   - feature lines with no `checked` date;
 *   - feature lines whose `checked` date is older than the Implemented date of an ADR they cite;
 *   - feature lines citing an id that is neither an implemented ADR nor one pending in docs/adr;
 *   - implemented ADRs cited by no feature line and not in EXEMPT;
 *   - the number of open gaps in docs/adr/GAPS.md (Done gaps live in GAPS-archive.md and are never re-checked).
 *
 *   pnpm sync:pending        (node scripts/sync-pending.mjs)
 *
 * A sync verifies only what this lists and sets `checked` (YYYY-MM-DD) on the lines it verified. `pending()` is also
 * exported for tests.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Implemented ADRs that need no feature line: process, tooling, infrastructure and docs decisions (user 2026-11-05).
 * 001 clean break from the previous app; 013 stack; 015 verification; 016 process; 017 agent contracts; 050 reserv
 * ADR layout and skills; 053 pnpm, Prettier and Node 24; 066 light acceptance; 082 gaps ledger; 108 find-it in jsdom;
 * 114 one control height; 115 high-severity layout fixes; 116 heading scale and spacing; 120 lower-severity critique
 * fixes; 127 backend choice; 131 secure sessions and CSP; 150 delete the research tests; 183 feature-tree details; 197 faster CI;
 * 201 failing and missing acceptance checks.
 */
export const EXEMPT = [
  'ADR-001',
  'ADR-013',
  'ADR-015',
  'ADR-016',
  'ADR-017',
  'ADR-050',
  'ADR-053',
  'ADR-066',
  'ADR-082',
  'ADR-108',
  'ADR-114',
  'ADR-115',
  'ADR-116',
  'ADR-120',
  'ADR-127',
  'ADR-131',
  'ADR-150',
  'ADR-183',
  'ADR-197',
  'ADR-201',
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** { "ADR-012": "2026-10-21", ... } from the "- Implemented:" line of each Implemented docs/adr-done file. */
export function implementedDates(repo = REPO) {
  const out = {};
  const dir = join(repo, 'docs/adr-done');
  for (const f of readdirSync(dir)) {
    const m = /^(ADR-\d{3})-.*\.md$/.exec(f);
    if (!m) continue;
    const text = readFileSync(join(dir, f), 'utf8');
    // A Rejected ADR (ADR-217) also lives in docs/adr-done but built nothing.
    if (!/^- Status: Implemented\s*$/m.test(text)) continue;
    const d = /^- Implemented: (\d{4}-\d{2}-\d{2})/m.exec(text);
    out[m[1]] = d ? d[1] : '';
  }
  return out;
}

/** ADRs still pending in docs/adr (built in the open pull request, shipped with it): citing one is not an error. */
export function pendingAdrs(repo = REPO) {
  return new Set(
    readdirSync(join(repo, 'docs/adr'))
      .map((f) => /^(ADR-\d{3})-.*\.md$/.exec(f)?.[1])
      .filter(Boolean),
  );
}

/** Every feature line of the tree, with its domain path. */
export function featureLines(domains, path = []) {
  const out = [];
  for (const d of domains) {
    const here = [...path, d.name];
    for (const f of d.features ?? []) out.push({ path: here.join(' › '), feature: f });
    out.push(...featureLines(d.children ?? [], here));
  }
  return out;
}

/** The number of open gaps (Status: Open) in a GAPS.md text. */
export function openGaps(text) {
  return (text.match(/^- Status: Open\s*$/gm) ?? []).length;
}

/** What a sync must check: lists of strings, empty when nothing is pending. */
export function pending(domains, implemented, exempt = EXEMPT, inProgress = pendingAdrs()) {
  const unchecked = [];
  const stale = [];
  const unknown = [];
  const cited = new Set();
  for (const { path, feature: f } of featureLines(domains)) {
    const where = `${path} › ${f.name}`;
    for (const a of f.adrs) {
      cited.add(a);
      if (!implemented[a] && !inProgress.has(a))
        unknown.push(`${where}: ${a} is not an implemented or pending ADR`);
    }
    if (!f.checked || !DATE.test(f.checked)) {
      unchecked.push(f.checked ? `${where} (bad date "${f.checked}")` : where);
      continue;
    }
    const newer = f.adrs.filter((a) => implemented[a] && implemented[a] > f.checked);
    if (newer.length)
      stale.push(
        `${where}: checked ${f.checked}, ${newer.map((a) => `${a} ${implemented[a]}`).join(', ')}`,
      );
  }
  const uncited = Object.keys(implemented)
    .filter((a) => !cited.has(a) && !exempt.includes(a))
    .sort();
  return { unchecked, stale, unknown, uncited };
}

async function main() {
  const { FEATURES } = await import(pathToFileURL(join(REPO, 'src/ui/info/features.ts')).href);
  const p = pending(FEATURES, implementedDates());
  const sections = [
    ['Feature lines with no checked date', p.unchecked],
    ['Feature lines checked before a cited ADR was implemented', p.stale],
    ['Feature lines citing an id that is not an implemented or pending ADR', p.unknown],
    ['Implemented ADRs cited by no feature line (not exempt)', p.uncited],
  ];
  let any = false;
  for (const [title, items] of sections) {
    if (!items.length) continue;
    any = true;
    console.log(`${title} (${items.length}):`);
    for (const i of items) console.log(`  - ${i}`);
  }
  if (!any) console.log('Feature tree: nothing pending.');
  const gaps = openGaps(readFileSync(join(REPO, 'docs/adr/GAPS.md'), 'utf8'));
  console.log(`Open gaps in docs/adr/GAPS.md: ${gaps} (pnpm gaps list).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
