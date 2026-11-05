// ADR-172: the Regency converter as the Seller prices workflow runs it — the export's own date, dropped products,
// and the shipped thumbnail paths and picture marks kept from the previous catalog.
import { describe, expect, it } from 'vitest';
import { convert } from '../tools/sellers/regency.mjs';
import type { SellerCatalog } from '../src/core/sellers/types';

const IMG =
  'https://regencycompany.ro/media/catalog/product/cache/11d468b3a483182c4cfa53921f4334ce/';
function product(id: string, date: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: `Board ${id}`,
    sku: `SKU-${id}`,
    prices: [{ type: 'finalPrice', amount: 123.45 }],
    price_basis: 'Pret / bucata (TVA inclus)',
    currency: 'RON',
    availability: 'In stoc',
    category_ids: [1, 338],
    specifications: [
      { name: 'Grosime', value: '18 mm' },
      { name: 'Producator', value: 'Egger' },
    ],
    link: `https://regencycompany.ro/p/${id}`,
    image: `${IMG}b/${id}.jpg`,
    extracted_at_utc: date,
    ...extra,
  };
}
const exportOf = (...products: ReturnType<typeof product>[]) => ({
  schema_version: '3.0',
  categories: [
    { id: 1, name: 'Boards', parent_id: null },
    { id: 338, name: 'PAL', parent_id: 1 },
  ],
  products,
});

describe('the Regency converter for a refresh (ADR-172)', () => {
  it('takes the latest extraction date, drops products no longer exported, keeps ti and h of those still sold', () => {
    const first = convert(
      exportOf(product('a', '2026-10-29T10:00:00Z'), product('b', '2026-10-29T10:00:00Z')),
    );
    expect(first.extracted).toBe('2026-10-29');
    expect(first.products.map((p) => p.id)).toEqual(['a', 'b']);
    expect(first.products[0].p).toBe(12345);
    expect(first.products[0].t).toBe(18);
    const previous: SellerCatalog = {
      ...first,
      thumbBase:
        'https://regencycompany.ro/media/catalog/product/cache/6cfb8bf111a554b9d0e1ad8c3a66618f/',
      products: first.products.map((p) => (p.id === 'a' ? { ...p, ti: 'thumbs/a.jpg', h: 1 } : p)),
    };
    const next = convert(
      exportOf(
        product('a', '2026-11-03T08:00:00Z', { prices: [{ type: 'finalPrice', amount: 130 }] }),
        product('c', '2026-11-04T09:30:00Z'),
      ),
      null,
      previous,
    );
    expect(next.extracted).toBe('2026-11-04');
    expect(next.products.map((p) => p.id)).toEqual(['a', 'c']);
    const a = next.products.find((p) => p.id === 'a')!;
    expect(a.p).toBe(13000);
    expect(a.ti).toBe('thumbs/a.jpg');
    expect(a.h).toBe(1);
    expect(next.products.find((p) => p.id === 'c')!.h).toBeUndefined();
    expect(next.thumbBase).toBe(previous.thumbBase);
  });
  it('refuses another schema version', () => {
    expect(() => convert({ schema_version: '2.0', categories: [], products: [] })).toThrow(
      /schema_version/,
    );
  });
});
