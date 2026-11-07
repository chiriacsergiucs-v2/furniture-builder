import {
  templateFromDesign,
  templateOrigin,
  templateProblemText,
  validateLocalTemplate,
  type LocalTemplate,
} from '../core/catalog/local';
import type { FunctionGroup, Room } from '../core/catalog/types';
import type { Design } from '../core/types';
import { useDesign } from './designStore';
import { useTemplates } from './templatesStore';
import { t } from '../core/i18n';

export interface CatalogMetaInput {
  name: string;
  room: Room;
  function: FunctionGroup;
}
export type SaveResult = { template: LocalTemplate } | { error: string };

/**
 * Save a design to the catalog as a new template on this device (ADR-107, ADR-195). The reason is returned, in the
 * user's words, when the template is not valid or cannot be stored.
 */
export async function saveDesignToCatalog(
  design: Design,
  meta: CatalogMetaInput,
): Promise<SaveResult> {
  const name = meta.name.trim();
  if (!name) return { error: t('Give the template a name.') };
  const tpl = templateFromDesign(design, { name, function: meta.function, rooms: [meta.room] });
  const errs = validateLocalTemplate(tpl);
  if (errs.length)
    return {
      error: t('This piece cannot be saved as a template. {why}', {
        why: templateProblemText(errs[0]),
      }),
    };
  if (!(await useTemplates.getState().save(tpl)))
    return { error: t('The template could not be saved in this browser’s storage.') };
  return { template: tpl };
}

/**
 * Save a project piece to the catalog (ADR-107): a new template from the piece's current design, stored on this
 * device, then the piece is linked to it (one undo step). Nothing is linked when the template is not valid or cannot
 * be stored; the reason is returned instead.
 */
export async function saveItemToCatalog(
  itemId: string,
  meta: CatalogMetaInput,
): Promise<SaveResult> {
  const item = useDesign.getState().project?.items.find((i) => i.id === itemId);
  if (!item) return { error: t('The piece is no longer in the project.') };
  const res = await saveDesignToCatalog(item.design, meta);
  if ('template' in res) useDesign.getState().linkTemplate(itemId, templateOrigin(res.template));
  return res;
}
