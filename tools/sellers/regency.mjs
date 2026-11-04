#!/usr/bin/env node
/**
 * ADR-161: converts the Regency Company product export (JSON, schema_version 3.0) into the seller-agnostic catalog
 * the app bundles (`src/core/sellers/regency.json`). Each further seller gets its own converter writing the same
 * shape (`SellerCatalog` in `src/core/sellers/types.ts`). Only the seller's own values are kept; nothing is guessed:
 * a size the export does not state is left out.
 *
 *   node tools/sellers/regency.mjs <export.json> [src/core/sellers/regency.json] [thumbnails.json] [previous catalog]
 *
 * previous catalog (ADR-172, optional): the catalog shipped now; its thumbnail paths (`ti`) and picture marks (`h`)
 * are kept per product id, so a refresh from a new export loses no picture. `convert()` is also exported for tests.
 *
 * thumbnails.json (ADR-162, optional): the seller's thumbnail link per product id. The thumbnails live under one cache
 * folder (`thumbBase`) with the same path as the picture; a thumbnail on another path is kept as `ti` ('' = none).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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
const kindOf = (cats, ids) => {
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

const IMG =
  'https://regencycompany.ro/media/catalog/product/cache/11d468b3a483182c4cfa53921f4334ce/';
const THUMB =
  'https://regencycompany.ro/media/catalog/product/cache/6cfb8bf111a554b9d0e1ad8c3a66618f/';
const ORIGIN = 'https://regencycompany.ro';
/** The app's catalog from a Regency export; see the header. Pure: never reads or writes files. */
export function convert(data, thumbs = null, previous = null) {
  if (data.schema_version !== '3.0')
    throw new Error(`unknown schema_version ${data.schema_version}`);
  const cats = new Map(data.categories.map((c) => [c.id, c]));
  const kept = new Map((previous?.products ?? []).map((o) => [o.id, o]));
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
    const kind = kindOf(cats, p.category_ids);
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
    // The thumbnail (ADR-162): the picture's path under THUMB unless the file says otherwise; '' for none.
    const th = thumbs?.[p.id];
    const tp = typeof th === 'string' && th.startsWith(THUMB) ? th.slice(THUMB.length) : '';
    if (thumbs && tp !== (o.i ?? '')) o.ti = tp;
    if (p.extracted_at_utc > extracted) extracted = p.extracted_at_utc;
    products.push(o);
  }
  // A refresh keeps the shipped thumbnail paths and picture marks (ADR-162, ADR-172) of products still sold.
  for (const o of products) {
    const was = kept.get(o.id);
    if (!was) continue;
    if (!thumbs && was.ti !== undefined) o.ti = was.ti;
    if (was.h) o.h = was.h;
  }
  return {
    id: 'regency',
    name: 'Regency Company',
    origin: ORIGIN,
    imageBase: IMG,
    ...(thumbs || previous?.thumbBase ? { thumbBase: THUMB } : {}),
    currency: 'RON',
    priceNote: 'VAT included',
    extracted: extracted.slice(0, 10),
    products,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [src, out = 'src/core/sellers/regency.json', thumbsPath, previousPath] =
    process.argv.slice(2);
  if (!src) {
    console.error(
      'usage: node tools/sellers/regency.mjs <export.json> [out.json] [thumbnails.json] [previous catalog]',
    );
    process.exit(1);
  }
  const read = (f) => (f && f !== '-' ? JSON.parse(readFileSync(f, 'utf8')) : null);
  const catalog = convert(read(src), read(thumbsPath), read(previousPath));
  writeFileSync(out, JSON.stringify(catalog) + '\n');
  console.log(`${catalog.products.length} products → ${out}`);
}
