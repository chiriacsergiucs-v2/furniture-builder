import { create } from 'zustand';
import type { LocalTemplate } from '../core/catalog/local';
import { deleteTemplate, listTemplates, saveTemplate } from '../persist/db';
import { t } from '../core/i18n';

/** Templates edited on this device (ADR-034), loaded once and kept in step with IndexedDB. */
interface TemplatesState {
  locals: LocalTemplate[];
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  save: (t: LocalTemplate) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTemplates = create<TemplatesState>((set, get) => ({
  locals: [],
  loaded: false,
  error: null,
  refresh: async () => {
    try {
      set({ locals: await listTemplates(), loaded: true, error: null });
    } catch {
      set({ loaded: true, error: t('Templates saved on this device could not be read.') });
    }
  },
  save: async (tpl) => {
    await saveTemplate(tpl);
    set({ locals: [tpl, ...get().locals.filter((x) => x.id !== tpl.id)] });
  },
  remove: async (id) => {
    await deleteTemplate(id);
    set({ locals: get().locals.filter((x) => x.id !== id) });
  },
}));
