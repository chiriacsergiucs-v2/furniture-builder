/**
 * Brand products added by the catalog feed (ADR-029): one `<catalogId>.json` design per product, with its
 * `<catalogId>.evidence.json` beside it. Shipped with the app; listed on the Catalog page under *Brands* (ADR-027).
 * Entries that do not validate are skipped, never shown half-built.
 */
import { validateDesign } from '../../design';
import type { Design } from '../../types';

const files = import.meta.glob<Design>(['./*.json', '!./*.evidence.json'], {
  eager: true,
  import: 'default',
});

export interface BrandEntry {
  catalogId: string;
  design: Design;
}

export const brandEntries: BrandEntry[] = Object.entries(files)
  .map(([path, design]) => ({ catalogId: path.replace(/^\.\/|\.json$/g, ''), design }))
  .filter((e) => validateDesign(e.design).length === 0 && !!e.design.catalog?.brand)
  .sort((a, b) =>
    (a.design.catalog!.brand! + a.design.name).localeCompare(
      b.design.catalog!.brand! + b.design.name,
    ),
  );

/** A copy of a brand entry for the editor: new id, origin recorded (ADR-028); the shipped entry never changes. */
export function copyBrandEntry(
  e: BrandEntry,
  newId: string,
  now = new Date().toISOString(),
  revision = 1,
): Design {
  const d = structuredClone(e.design);
  const c = d.catalog!;
  return {
    ...d,
    id: newId,
    createdAt: now,
    updatedAt: now,
    catalog: {
      ...c,
      origin: {
        catalogId: e.catalogId,
        revision,
        brand: c.brand,
        productName: c.productName ?? d.name,
        ...(c.origin?.sourceUrl ? { sourceUrl: c.origin.sourceUrl } : {}),
        takenAt: now,
      },
    },
  };
}
