/**
 * A piece's name on the printed sheets (ADR-202, G-353). While a catalog piece keeps the default name of the variant
 * it came from, it prints in the print language: Romanian `{nameRo} — {VARIANT_RO}`, Russian its `ru/data-catalog.ts`
 * entry (read directly, whatever the UI language), English the name. A renamed piece prints as typed (G-304).
 */
import { getPrintLang } from '../i18n/print';
import { data_catalog } from '../i18n/ru/data-catalog';
import type { Design } from '../types';
import { findFamily } from './index';
import { VARIANT_RO } from './ro';

/** Default design names by `catalogId/variantId`, built once per variant. */
const defaults = new Map<string, string | null>();

function defaultName(catalogId: string, variantId: string): string | null {
  const key = `${catalogId}/${variantId}`;
  const known = defaults.get(key);
  if (known !== undefined) return known;
  const v = findFamily(catalogId)?.variants.find((x) => x.id === variantId);
  let name: string | null;
  try {
    name = v?.create?.().name ?? null;
  } catch {
    name = null;
  }
  defaults.set(key, name);
  return name;
}

export function printPieceName(design: Pick<Design, 'name' | 'catalog'>): string {
  const o = design.catalog?.origin;
  if (!o?.variantId) return design.name;
  const family = findFamily(o.catalogId);
  if (!family || defaultName(o.catalogId, o.variantId) !== design.name) return design.name;
  const lang = getPrintLang();
  if (lang === 'ro') {
    const v = VARIANT_RO[o.variantId];
    return v ? `${family.nameRo} — ${v}` : family.nameRo;
  }
  if (lang === 'ru') return data_catalog[design.name] ?? design.name;
  return design.name;
}
