#!/usr/bin/env node
/**
 * ADR-206 (G-340): a price change summary between two seller catalogs in the app's shape (`SellerCatalog`,
 * `src/core/sellers/types.ts`), as Markdown for the Seller prices workflow's pull request body: counts of changed
 * prices, new and dropped products, then up to 50 changed lines (old → new, %), "… and N more". Pure apart from the
 * command line; the app makes no request (ADR-002).
 *
 *   node tools/sellers/price-changes.mjs <previous catalog> <new catalog> [out.md]
 *
 * `priceChanges()` is also exported for tests.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** At most this many changed lines are listed. */
export const MAX_LINES = 50;

const UNIT = { piece: 'piece', m: 'm', m2: 'm²', pack: 'pack', set: 'set' };

/** "1234" minor units → "12.34". */
const money = (minor) => (minor / 100).toFixed(2);

/** Markdown table cells: no pipes or line breaks from product names. */
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/**
 * The summary of what changed from `previous` to `next`: a price or its unit changed, products new in `next`, and
 * products of `previous` no longer in `next`. Changed lines are listed largest change first.
 */
export function priceChanges(previous, next, max = MAX_LINES) {
  const before = new Map((previous?.products ?? []).map((p) => [p.id, p]));
  const after = new Map((next?.products ?? []).map((p) => [p.id, p]));
  const changed = [];
  let added = 0;
  for (const [id, p] of after) {
    const was = before.get(id);
    if (!was) {
      added++;
      continue;
    }
    if (was.p !== p.p || was.u !== p.u)
      changed.push({
        p,
        was,
        pct: was.p > 0 && was.u === p.u ? ((p.p - was.p) / was.p) * 100 : null,
      });
  }
  let dropped = 0;
  for (const id of before.keys()) if (!after.has(id)) dropped++;
  changed.sort(
    (a, b) =>
      Math.abs(b.pct ?? Infinity) - Math.abs(a.pct ?? Infinity) || a.p.n.localeCompare(b.p.n),
  );
  const currency = next?.currency ?? previous?.currency ?? '';
  const name = next?.name ?? previous?.name ?? 'Seller';
  const out = [
    `### ${name}: price changes`,
    '',
    `Export ${previous?.extracted ?? '?'} → ${next?.extracted ?? '?'} (${currency}).`,
    '',
    `- Changed prices: ${changed.length}`,
    `- New products: ${added}`,
    `- Dropped products: ${dropped}`,
  ];
  if (changed.length) {
    out.push('', '| Product | Code | Old | New | Change |', '| --- | --- | ---: | ---: | ---: |');
    for (const c of changed.slice(0, max)) {
      const unit = (u) => UNIT[u] ?? u;
      const pct = c.pct === null ? 'unit changed' : `${c.pct > 0 ? '+' : ''}${c.pct.toFixed(1)} %`;
      out.push(
        `| ${cell(c.p.n)} | ${cell(c.p.code ?? '')} | ${money(c.was.p)} / ${unit(c.was.u)} | ${money(c.p.p)} / ${unit(c.p.u)} | ${pct} |`,
      );
    }
    if (changed.length > max) out.push('', `… and ${changed.length - max} more`);
  }
  return out.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [prevPath, nextPath, outPath] = process.argv.slice(2);
  if (!prevPath || !nextPath) {
    console.error('usage: node tools/sellers/price-changes.mjs <previous> <new> [out.md]');
    process.exit(1);
  }
  const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
  const md = priceChanges(read(prevPath), read(nextPath));
  if (outPath) writeFileSync(outPath, md);
  else process.stdout.write(md);
}
