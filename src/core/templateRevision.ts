/**
 * Which template revision a piece was taken from, and whether that template has moved on since (ADR-096). Pieces keep
 * their own copy (ADR-022, ADR-028): nothing here changes a piece; it only tells the user, who decides per piece.
 *
 * A piece records `catalog.origin.revision` when it is taken: the shipped family's `catalogVersion`, or the revision of
 * the template as edited on this device (ADR-034, `localRevision`, counted on from the shipped version it was taken
 * from). The template's revision now is the edited one when this device has one for that family, else the shipped
 * `catalogVersion`. A device edit that is deleted again falls back to the shipped version: pieces taken from the edit
 * then count as up to date (their revision is not lower).
 */
import { t } from './i18n';
import type { CatalogFamily } from './catalog/types';
import { localRevision, type LocalTemplate } from './catalog/local';
import type { Design } from './types';

export type TemplateStatus =
  /** No catalog origin: the user's own design. */
  | { kind: 'own' }
  /** The template is no longer in the catalog or on this device. */
  | { kind: 'gone'; name: string; revision: number }
  /** Up to date, or the newer revision was dismissed with Keep mine (`kept`). */
  | { kind: 'current'; name: string; revision: number; latest: number; kept: boolean }
  /** The template has a newer revision than the piece. */
  | { kind: 'newer'; name: string; revision: number; latest: number };

/** The template's revision now: edited on this device, else shipped; null when it is in neither. */
export function latestRevision(
  catalogId: string,
  families: readonly Pick<CatalogFamily, 'id' | 'catalogVersion'>[],
  locals: readonly LocalTemplate[],
): number | null {
  const local = locals.find((t) => t.family.id === catalogId);
  if (local) return localRevision(local);
  return families.find((f) => f.id === catalogId)?.catalogVersion ?? null;
}

/**
 * The notice for a project piece or a saved design (ADR-096): its template and revision, and whether a newer one
 * exists. `templateSeen` is the revision the user kept their piece at (Keep mine): the notice stays hidden until the
 * template moves past it.
 */
export function templateStatus(
  item: { design: Design; templateSeen?: number },
  families: readonly Pick<CatalogFamily, 'id' | 'catalogVersion'>[],
  locals: readonly LocalTemplate[],
): TemplateStatus {
  const o = item.design.catalog?.origin;
  if (!o) return { kind: 'own' };
  const name = o.brand ? `${o.brand} ${o.productName}` : o.productName;
  const latest = latestRevision(o.catalogId, families, locals);
  if (latest === null) return { kind: 'gone', name, revision: o.revision };
  if (latest <= o.revision)
    return { kind: 'current', name, revision: o.revision, latest, kept: false };
  if (item.templateSeen !== undefined && latest <= item.templateSeen)
    return { kind: 'current', name, revision: o.revision, latest, kept: true };
  return { kind: 'newer', name, revision: o.revision, latest };
}

/** "2 pieces have a newer template" (ADR-096); empty for none. */
export const newerText = (n: number): string =>
  n ? t('{n|# piece has|# pieces have} a newer template', { n }) : '';

/** How many of these pieces have a newer template (the project panel's count). */
export const newerCount = (
  items: readonly { design: Design; templateSeen?: number }[],
  families: readonly Pick<CatalogFamily, 'id' | 'catalogVersion'>[],
  locals: readonly LocalTemplate[],
): number => items.filter((i) => templateStatus(i, families, locals).kind === 'newer').length;
