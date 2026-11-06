/**
 * The user's seller choices in a design (ADR-161): products for hardware lines and items added to the shopping list.
 * Pure updates of the design document; a project's choices are gathered from its pieces.
 */
import { SCHEMA_VERSION } from '../design';
import { PROJECT_SCHEMA } from '../project';
import type { Project } from '../project';
import type { Design, HardwareProduct, SellerItem } from '../types';

/** Links a seller product to a hardware line, or removes the link (undefined). */
export function withHardwareProduct(
  d: Design,
  key: string,
  hp: HardwareProduct | undefined,
): Design {
  const next = { ...d.hardwareProducts };
  if (hp) next[key] = hp;
  else delete next[key];
  return {
    ...d,
    schemaVersion: SCHEMA_VERSION,
    hardwareProducts: Object.keys(next).length ? next : undefined,
  };
}

/** Adds a seller item; the same product again adds to its quantity. */
export function withSellerItem(d: Design, it: SellerItem): Design {
  const items = d.sellerItems ?? [];
  const i = items.findIndex((x) => x.seller === it.seller && x.id === it.id);
  const next =
    i < 0
      ? [...items, it]
      : items.map((x, j) =>
          j === i ? { ...x, quantity: Math.min(9999, x.quantity + it.quantity) } : x,
        );
  return { ...d, schemaVersion: SCHEMA_VERSION, sellerItems: next };
}

/** Sets an added item's quantity; 0 removes it. */
export function withSellerItemQuantity(d: Design, index: number, quantity: number): Design {
  const items = d.sellerItems ?? [];
  if (!items[index]) return d;
  const next =
    quantity > 0
      ? items.map((x, j) => (j === index ? { ...x, quantity: Math.min(9999, quantity) } : x))
      : items.filter((_, j) => j !== index);
  return { ...d, schemaVersion: SCHEMA_VERSION, sellerItems: next.length ? next : undefined };
}

/**
 * A project's choices: the first piece's link for each hardware line, and every piece's added items times its
 * number of copies, then the project's own items (ADR-210), the same product combined.
 */
export function projectSellerChoices(p: Project): {
  hardwareProducts: Record<string, HardwareProduct>;
  sellerItems: SellerItem[];
} {
  const hardwareProducts: Record<string, HardwareProduct> = {};
  const items = new Map<string, SellerItem>();
  for (const it of p.items) {
    for (const [k, v] of Object.entries(it.design.hardwareProducts ?? {}))
      hardwareProducts[k] ??= v;
    for (const s of it.design.sellerItems ?? []) {
      const key = `${s.seller}:${s.id}`;
      const had = items.get(key);
      items.set(key, { ...s, quantity: (had?.quantity ?? 0) + s.quantity * it.quantity });
    }
  }
  // The project's own items (ADR-210), once, after the pieces' items.
  for (const s of p.sellerItems ?? []) {
    const key = `${s.seller}:${s.id}`;
    const had = items.get(key);
    items.set(key, { ...s, quantity: (had?.quantity ?? 0) + s.quantity });
  }
  return { hardwareProducts, sellerItems: [...items.values()] };
}

/** Adds a seller item to the project's own list (ADR-210); the same product again adds to its quantity. */
export function projectWithSellerItem(p: Project, it: SellerItem): Project {
  const items = p.sellerItems ?? [];
  const i = items.findIndex((x) => x.seller === it.seller && x.id === it.id);
  const next =
    i < 0
      ? [...items, it]
      : items.map((x, j) =>
          j === i ? { ...x, quantity: Math.min(9999, x.quantity + it.quantity) } : x,
        );
  return { ...p, schemaVersion: PROJECT_SCHEMA, sellerItems: next };
}

/** Sets a project item's quantity (ADR-210), by seller and product id; 0 removes it. */
export function projectSellerItemQuantity(
  p: Project,
  seller: string,
  id: string,
  quantity: number,
): Project {
  const items = p.sellerItems ?? [];
  const i = items.findIndex((x) => x.seller === seller && x.id === id);
  if (i < 0) return p;
  const next =
    quantity > 0
      ? items.map((x, j) => (j === i ? { ...x, quantity: Math.min(9999, quantity) } : x))
      : items.filter((_, j) => j !== i);
  return { ...p, sellerItems: next.length ? next : undefined };
}

/** Links a hardware line's product in every piece of a project (ADR-161): the project's line covers them all. */
export const projectWithHardwareProduct = (
  p: Project,
  key: string,
  hp: HardwareProduct | undefined,
): Project => ({
  ...p,
  items: p.items.map((i) => ({ ...i, design: withHardwareProduct(i.design, key, hp) })),
});
