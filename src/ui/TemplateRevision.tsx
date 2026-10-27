import { useMemo } from 'react';
import { catalogFamilies, insertable, insertVariant } from '../core/catalog';
import type { ViewFamily } from '../core/catalog/local';
import type { ProjectItem } from '../core/project';
import { designEdited } from '../core/replace';
import {
  newerCount,
  newerText,
  templateStatus,
  type TemplateStatus,
} from '../core/templateRevision';
import type { Design } from '../core/types';
import { useDesign } from '../store/designStore';
import { useCatalog, useLocalTemplates } from './Catalog';
import { askConfirm } from './Confirm';
import { Icon } from './icons';
import { useUi } from './shell/uiStore';

/**
 * The template status of a piece or saved design against the catalog and this device's templates (ADR-096); null until
 * this device's templates are read, so the notice never shows a shipped-only answer first.
 */
export function useTemplateStatus(item: {
  design: Design;
  templateSeen?: number;
}): TemplateStatus | null {
  const locals = useLocalTemplates();
  return useMemo(
    () => (locals ? templateStatus(item, catalogFamilies, locals) : null),
    [item, locals],
  );
}

/** "Template updated (revision 3 → 4)" — the notice text (ADR-096). */
export const updatedText = (s: { revision: number; latest: number }) =>
  `Template updated (revision ${s.revision} → ${s.latest})`;

/** The variant a piece was taken from, in the catalog as this device shows it; null when it cannot be built. */
function originVariant(families: ViewFamily[], d: Design) {
  const o = d.catalog?.origin;
  const family = o && families.find((f) => f.id === o.catalogId);
  const variant = family?.variants.find((v) => v.id === o?.variantId);
  return family && variant && insertable(variant) ? { family, variant } : null;
}

/**
 * The selected piece's template line (ADR-096): "From <template>, revision N", "Your own design", or the
 * newer-revision notice with Keep mine and Replace with the new revision (the replace of ADR-098).
 */
export function TemplateNotice({ item }: { item: ProjectItem }) {
  const status = useTemplateStatus(item);
  const families = useCatalog();
  const keep = useDesign((s) => s.keepTemplate);
  if (!status) return null;
  if (status.kind === 'own')
    return (
      <p className="hint template-line">
        <Icon name="pencil" className="sm" /> Your own design
      </p>
    );
  const from = (
    <>
      From <em>{status.name}</em>, revision {status.revision}
    </>
  );
  if (status.kind === 'gone')
    return (
      <p className="hint template-line">
        <Icon name="catalog" className="sm" /> {from} (the template is no longer in the catalog)
      </p>
    );
  if (status.kind === 'current')
    return (
      <p className="hint template-line">
        <Icon name="catalog" className="sm" /> {from}
        {status.kept ? ` (kept; the template is at revision ${status.latest})` : ''}
      </p>
    );
  const source = originVariant(families, item.design);
  const replace = async () => {
    if (!source) return;
    // By its stamp only: against the newer template every piece would differ, edited or not.
    if (
      designEdited(item.design) &&
      !(await askConfirm(
        `“${item.design.name}” was edited after it was added. Its own changes go onto revision ${status.latest} where it has the same setting; the result lists what was kept and what was not. Position, turn, quantity, placement, zones and boards stay.`,
        { confirmLabel: 'Replace' },
      ))
    )
      return;
    const d = insertVariant(source.family, source.variant);
    if (!d) return;
    const report = useDesign.getState().replaceItem(item.id, d, { families, keepSize: true });
    if (report) useUi.getState().setNotice({ ok: !report.problems.length, text: report.text });
  };
  return (
    <div className="alert info template-notice" role="status">
      <Icon name="info" className="sm" />
      <span>
        <strong>{updatedText(status)}</strong>. {from}; nothing changes unless you choose.
      </span>
      <div className="split-actions">
        <button type="button" className="btn sm" onClick={() => keep(item.id, status.latest)}>
          Keep mine
        </button>
        {source && (
          <button type="button" className="btn sm" onClick={() => void replace()}>
            Replace with the new revision
          </button>
        )}
      </div>
      {!source && (
        <p className="hint">
          The item it was taken from is no longer in the template; use Replace… to choose another.
        </p>
      )}
    </div>
  );
}

/** "2 pieces have a newer template" in the project panel (ADR-096); nothing when none has. */
export function NewerTemplates({ items }: { items: ProjectItem[] }) {
  const locals = useLocalTemplates();
  const n = useMemo(
    () => (locals ? newerCount(items, catalogFamilies, locals) : 0),
    [items, locals],
  );
  if (!n) return null;
  return (
    <p className="hint template-count" role="status">
      <Icon name="info" className="sm" /> {newerText(n)}. Select one to keep it or replace it.
    </p>
  );
}
