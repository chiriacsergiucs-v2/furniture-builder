import {
  templateFromDesign,
  templateOrigin,
  validateLocalTemplate,
  type LocalTemplate,
} from '../core/catalog/local';
import type { FunctionGroup, Room } from '../core/catalog/types';
import { useDesign } from './designStore';
import { useTemplates } from './templatesStore';
import { t } from '../core/i18n';

/**
 * Save a project piece to the catalog (ADR-107): a new template from the piece's current design, stored on this
 * device, then the piece is linked to it (one undo step). Nothing is linked when the template is not valid or cannot
 * be stored; the reason is returned instead.
 */
export async function saveItemToCatalog(
  itemId: string,
  meta: { name: string; room: Room; function: FunctionGroup },
): Promise<{ template: LocalTemplate } | { error: string }> {
  const item = useDesign.getState().project?.items.find((i) => i.id === itemId);
  if (!item) return { error: t('The piece is no longer in the project.') };
  const name = meta.name.trim();
  if (!name) return { error: t('Give the template a name.') };
  const tpl = templateFromDesign(item.design, {
    name,
    function: meta.function,
    rooms: [meta.room],
  });
  const errs = validateLocalTemplate(tpl);
  if (errs.length)
    return { error: t('This piece cannot be saved as a template: {why}.', { why: errs[0] }) };
  try {
    await useTemplates.getState().save(tpl);
  } catch {
    return { error: t('The template could not be saved in this browser’s storage.') };
  }
  useDesign.getState().linkTemplate(itemId, templateOrigin(tpl));
  return { template: tpl };
}
