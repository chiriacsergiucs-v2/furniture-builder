#!/usr/bin/env node
/**
 * ADR-160: converts the Regency Company product export (JSON, schema_version 3.0) into the seller-agnostic catalog
 * the app bundles (`src/core/sellers/regency.json`). Each further seller gets its own converter writing the same
 * shape (`SellerCatalog` in `src/core/sellers/types.ts`). Only the seller's own values are kept; nothing is guessed:
 * a size the export does not state is left out.
 *
 *   node tools/sellers/regency.mjs <export.json> [src/core/sellers/regency.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out = 'src/core/sellers/regency.json'] = process.argv.slice(2);
if (!src) {
  console.error('usage: node tools/sellers/regency.mjs <export.json> [out.json]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(src, 'utf8'));
if (data.schema_version !== '3.0') throw new Error(`unknown schema_version ${data.schema_version}`);
const cats = new Map(data.categories.map((c) => [c.id, c]));

/** Seller category id → product kind of the app (src/core/sellers/types.ts). The first match up the tree wins. */
const KIND = {
  338: 'board', // PAL
  330: 'board', // MDF
  370: 'board', // HDF
  337: 'board', // OSB
  325: 'board', // decorative boards
  568: 'board', // compact laminate
  323: 'worktop', // kitchen worktops
  324: 'worktop', // table tops
  '5217fda1f6b5998c542cfa81': 'worktop',
  240: 'edge-band',
  243: 'hinge',
  251: 'runner',
  253: 'runner',
  250: 'runner',
  254: 'runner',
  315: 'push-latch',
  255: 'flap-stay',
  303: 'shelf-pin',
  305: 'wall-bracket',
  270: 'handle',
  244: 'leg',
};
const kindOf = (ids) => {
  for (const id of [...ids].reverse()) {
    for (let c = cats.get(id); c; c = cats.get(c.parent_id)) if (KIND[c.id]) return KIND[c.id];
  }
  return 'other';
};
const BAND = { 241: 'abs', 316: 'pvc', 317: 'melamine' };
const bandKind = (ids) => ids.map((id) => BAND[id]).find(Boolean) ?? 'other';
const UNIT = {
  'Pret / bucata (TVA inclus)': 'piece',
  'Pret / buc (TVA inclus)': 'piece',
  'Pret / ml (TVA inclus)': 'm',
  'Pret / m² (TVA inclus)': 'm2',
  'Pret / pachet (TVA inclus)': 'pack',
  'Pret / set (TVA inclus)': 'set',
};
const STOCK = {
  'In stoc': 'in',
  'Stoc epuizat': 'out',
  'Disponibil la comanda': 'order',
  Precomanda: 'preorder',
  'Disponibil online': 'online',
};
/** "18 mm", "0,8 mm" → millimetres as a number; anything else → undefined. */
const mm = (v) => {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*mm\s*$/i.exec(v ?? '');
  return m ? Number(m[1].replace(',', '.')) : undefined;
};
const whole = (v) => (v !== undefined && Number.isInteger(v) ? v : undefined);

const IMG = 'https://regencycompany.ro/media/catalog/product/cache/11d468b3a483182c4cfa53921f4334ce/';
const ORIGIN = 'https://regencycompany.ro';
const seen = new Set();
const products = [];
let extracted = '';
for (const p of data.products) {
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  const price = p.prices.find((x) => x.type === 'finalPrice') ?? p.prices[0];
  const unit = UNIT[p.price_basis];
  if (!price || !unit || p.currency !== 'RON') continue;
  const spec = Object.fromEntries(p.specifications.map((s) => [s.name, s.value]));
  const kind = kindOf(p.category_ids);
  const leaf = cats.get(p.category_ids.at(-1))?.name ?? '';
  const o = { id: p.id, n: p.name, k: kind, c: leaf, p: Math.round(price.amount * 100), u: unit };
  if (p.sku) o.code = p.sku;
  if (spec['Producator']) o.m = spec['Producator'];
  o.s = STOCK[p.availability] ?? 'other';
  const t = mm(spec['Grosime']);
  if (kind === 'edge-band') {
    o.b = bandKind(p.category_ids);
    if (t !== undefined && Number.isInteger(t * 10)) o.t = Math.round(t * 10);
  } else if (whole(t) !== undefined) o.t = t;
  if (whole(mm(spec['Lățime'])) !== undefined) o.w = mm(spec['Lățime']);
  if (whole(mm(spec['Lungime'])) !== undefined) o.l = mm(spec['Lungime']);
  if (whole(mm(spec['Lungime nominală'])) !== undefined) o.L = mm(spec['Lungime nominală']);
  o.x = p.specifications
    .filter((s) => s.name !== 'Producator')
    .map((s) => `${s.name}: ${s.value}`)
    .join(' · ');
  if (p.link.startsWith(ORIGIN)) o.a = p.link.slice(ORIGIN.length);
  if (p.image.startsWith(IMG)) o.i = p.image.slice(IMG.length);
  if (p.extracted_at_utc > extracted) extracted = p.extracted_at_utc;
  products.push(o);
}
const catalog = {
  id: 'regency',
  name: 'Regency Company',
  origin: ORIGIN,
  imageBase: IMG,
  currency: 'RON',
  priceNote: 'VAT included',
  extracted: extracted.slice(0, 10),
  products,
};
writeFileSync(out, JSON.stringify(catalog) + '\n');
console.log(`${products.length} products → ${out}`);
