import { create } from 'zustand';
import { validateLocalTemplate, type LocalTemplate } from '../core/catalog/local';
import { deleteTemplate, listTemplates, saveTemplate } from '../persist/db';
import { t } from '../core/i18n';
import { useDesign } from './designStore';

/** Templates edited on this device (ADR-034), loaded once and kept in step with IndexedDB. */
interface TemplatesState {
  locals: LocalTemplate[];
  loaded: boolean;
  /** The last storage failure (ADR-195): shown on the Catalog page until dismissed. */
  error: string | null;
  /**
   * A template editor draft for the Catalog page to reopen (ADR-195): after Cancel in template mode, or when the
   * template-mode Save could not store it. Nothing is saved until the user saves it.
   */
  draft: LocalTemplate | null;
  refresh: () => Promise<void>;
  /** Store one template; false (and `error` set) when the browser's storage refused it. Never throws. */
  save: (t: LocalTemplate) => Promise<boolean>;
  /** Remove one template; false (and `error` set) when the browser's storage refused it. Never throws. */
  remove: (id: string) => Promise<boolean>;
  clearError: () => void;
  setDraft: (t: LocalTemplate | null) => void;
}

export const useTemplates = create<TemplatesState>((set, get) => ({
  locals: [],
  loaded: false,
  error: null,
  draft: null,
  refresh: async () => {
    try {
      set({ locals: await listTemplates(), loaded: true, error: null });
    } catch {
      set({ loaded: true, error: t('Templates saved on this device could not be read.') });
    }
  },
  save: async (tpl) => {
    try {
      await saveTemplate(tpl);
    } catch {
      set({ error: t('The template could not be saved in this browser’s storage.') });
      return false;
    }
    set({ locals: [tpl, ...get().locals.filter((x) => x.id !== tpl.id)] });
    return true;
  },
  remove: async (id) => {
    try {
      await deleteTemplate(id);
    } catch {
      set({ error: t('The template could not be removed from this browser’s storage.') });
      return false;
    }
    set({ locals: get().locals.filter((x) => x.id !== id) });
    return true;
  },
  clearError: () => set({ error: null }),
  setDraft: (draft) => set({ draft }),
}));

/** Save a template editor draft as the template's next revision: one save, one revision (ADR-096, ADR-195). */
export async function saveRevision(draft: LocalTemplate): Promise<LocalTemplate | null> {
  const stamped = { ...draft, revision: draft.revision + 1, updatedAt: new Date().toISOString() };
  return (await useTemplates.getState().save(stamped)) ? stamped : null;
}

/**
 * "Save to template" in template mode (ADR-195): the draft with the edited design is saved once, as one revision.
 * When it is not valid or cannot be stored, the draft (edited design included) waits on the Catalog page instead.
 */
export async function saveTemplateEdit(): Promise<boolean> {
  const te = useDesign.getState().templateEdit;
  const next = useDesign.getState().finishTemplateEdit(true);
  if (!te || !next) return false;
  if (!validateLocalTemplate(next).length && (await useTemplates.getState().save(next)))
    return true;
  useTemplates.getState().setDraft({ ...next, revision: te.template.revision });
  return false;
}

/** "Cancel" in template mode (ADR-195): nothing is saved; the unsaved draft opens again on the Catalog page. */
export function cancelTemplateEdit(): void {
  const te = useDesign.getState().templateEdit;
  useDesign.getState().finishTemplateEdit(false);
  if (te) useTemplates.getState().setDraft(te.template);
}
