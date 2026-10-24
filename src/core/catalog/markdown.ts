import { buildModel } from '../build';
import { catalogFamilies, insertVariant } from './index';
import {
  FUNCTION_LABEL,
  FUNCTIONS,
  insertable,
  type CatalogFamily,
  type CatalogVariant,
} from './types';

const SUPPORT = {
  ready: '✅ ready',
  'needs-construction': '🔧 needs construction',
  safety: '🛡 waits for safety values',
  reference: '📖 reference',
} as const;

const variantCell = (v: CatalogVariant) => {
  const kind = v.kind === 'interior' ? 'I' : 'C';
  const req = v.requires.length ? ` [${v.requires.join(', ')}]` : '';
  return `${v.name} **${kind}**${req}${insertable(v) ? '' : ' ⏳'}`;
};

function defaultSize(f: CatalogFamily): string {
  const v = f.variants.find(insertable);
  if (!v) return '—';
  const b = buildModel(insertVariant(f, v)!).bounds;
  return `${b.w} × ${b.h} × ${b.d}`;
}

/** The family tables of `docs/catalog.md`, generated from the code catalog so the two cannot drift (ADR-032). */
export function catalogMarkdown(families: CatalogFamily[] = catalogFamilies): string {
  const out: string[] = [];
  for (const fn of FUNCTIONS) {
    const list = families.filter((f) => f.function === fn);
    const n = list.reduce((k, f) => k + f.variants.length, 0);
    out.push(
      `### ${FUNCTION_LABEL[fn]} (${list.length} families, ${n} variants)`,
      '',
      '| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |',
      '|---|---|---|---|---|---|---|',
    );
    for (const f of list) {
      out.push(
        `| ${f.name} | ${f.rooms.join(', ')} | ${f.root} · ${SUPPORT[f.support]} | ${defaultSize(f)} | ${f.structure} | ${f.configurations.join('; ')} | ${f.variants.map(variantCell).join(' · ')} |`,
      );
    }
    out.push('');
  }
  const all = families.flatMap((f) => f.variants);
  out.push(
    `**Totals:** ${families.length} families, ${all.length} variants; ${all.filter((v) => v.kind === 'interior').length} interior-only, ` +
      `${all.filter(insertable).length} can be inserted today, ${all.filter((v) => !insertable(v)).length} wait (⏳) for a construction or for safety values.`,
  );
  return out.join('\n');
}

export const CATALOG_BEGIN =
  '<!-- catalog:begin (generated from src/core/catalog by `npm run catalog:docs`; do not edit by hand) -->';
export const CATALOG_END = '<!-- catalog:end -->';
