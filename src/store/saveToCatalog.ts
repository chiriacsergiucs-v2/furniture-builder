import {
  templateFromDesign,
  templateOrigin,
  validateLocalTemplate,
  type LocalTemplate,
} from '../core/catalog/local';
import type { FunctionGroup, Room } from '../core/catalog/types';
import { useDesign } from './designStore';
import { useTemplates } from './templatesStore';

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
  if (!item) return { error: 'The piece is no longer in the project.' };
  const name = meta.name.trim();
  if (!name) return { error: 'Give the template a name.' };
  const t = templateFromDesign(item.design, { name, function: meta.function, rooms: [meta.room] });
  const errs = validateLocalTemplate(t);
  if (errs.length) return { error: `This piece cannot be saved as a template: ${errs[0]}.` };
  try {
    await useTemplates.getState().save(t);
  } catch {
    return { error: 'The template could not be saved in this browser’s storage.' };
  }
  useDesign.getState().linkTemplate(itemId, templateOrigin(t));
  return { template: t };
}
