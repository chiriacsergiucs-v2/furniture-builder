import { create } from 'zustand';
import { canonical, defaultMark, storedOf, type StoredBundle } from '../core/research/catalog';
import type { ResearchBundle, ResearchMark } from '../core/research/types';
import {
  listResearchBundles,
  listResearchMarks,
  saveResearchBundle,
  saveResearchMarks,
} from '../persist/db';
import { t } from '../core/i18n';

export type MarkPatch = Partial<Omit<ResearchMark, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Research papers and the user's decisions on them (ADR-043), kept in step with IndexedDB. Shipped papers are
 * seeded on first use; a newer shipped edition is stored beside the old one. Decisions are only ever written by the
 * user's own actions.
 */
interface ResearchState {
  stored: StoredBundle[];
  marks: Record<string, ResearchMark>;
  loaded: boolean;
  error: string | null;
  init: () => Promise<void>;
  setMarks: (ids: string[], patch: MarkPatch) => Promise<void>;
}

const now = () => new Date().toISOString();
const shipped = (bundles: ResearchBundle[]): StoredBundle[] =>
  bundles.map((b) => storedOf(b, '2026-10-23T00:00:00.000Z'));

/** Shipped editions win over a stored copy of the same edition (research records are never edited by the user). */
function seedShipped(
  stored: StoredBundle[],
  bundles: ResearchBundle[],
  at: string,
): StoredBundle[] {
  const out: StoredBundle[] = [];
  for (const b of bundles) {
    const cur = stored.find((s) => s.key === `${b.document.id}@${b.document.version}`);
    if (!cur || canonical(cur.bundle) !== canonical(b))
      out.push(storedOf(b, cur?.importedAt ?? at));
  }
  return out;
}

/** Research marks whose last save failed (ADR-266). */
const unsaved = new Set<string>();
const SAVE_FAILED = () => t('Your decision could not be saved on this device.');

export const useResearch = create<ResearchState>((set, get) => ({
  // Empty until `init` loads the shipped papers: they are a chunk of their own, loaded on first use (ADR-222).
  stored: [],
  marks: {},
  loaded: false,
  error: null,
  init: async () => {
    if (get().loaded) return;
    const { SHIPPED_RESEARCH } = await import('../core/research');
    // The shipped papers show at once; storage adds the user's imports and decisions.
    if (!get().stored.length) set({ stored: shipped(SHIPPED_RESEARCH) });
    try {
      const rows = await listResearchBundles();
      const seed = seedShipped(rows, SHIPPED_RESEARCH, now());
      for (const s of seed) await saveResearchBundle(s);
      const stored = [...rows.filter((r) => !seed.some((s) => s.key === r.key)), ...seed];
      const marks = Object.fromEntries((await listResearchMarks()).map((m) => [m.id, m]));
      set({ stored, marks, loaded: true, error: null });
    } catch {
      set({
        loaded: true,
        error: t(
          'Browser storage is unavailable: the shipped research is shown, but decisions and imports will not be kept.',
        ),
      });
    }
  },
  setMarks: async (ids, patch) => {
    const at = now();
    const next = ids.map((id) => ({
      ...(get().marks[id] ?? defaultMark(id, at)),
      ...patch,
      // The user's own implementation status wins over the app's record from now on (ADR-092).
      ...('implementation' in patch && !('implementationSetAt' in patch)
        ? { implementationSetAt: at }
        : {}),
      id,
      updatedAt: at,
    }));
    set({ marks: { ...get().marks, ...Object.fromEntries(next.map((m) => [m.id, m])) } });
    // Marks whose save failed are written again with the next save; the banner goes only once they are saved, and a
    // failure for another mark keeps it (ADR-266).
    const all = [
      ...next,
      ...[...unsaved].filter((id) => !ids.includes(id)).flatMap((id) => {
        const m = get().marks[id];
        return m ? [m] : [];
      }),
    ];
    try {
      await saveResearchMarks(all);
      for (const m of all) unsaved.delete(m.id);
      if (!unsaved.size && get().error === SAVE_FAILED()) set({ error: null });
    } catch {
      for (const m of all) unsaved.add(m.id);
      set({ error: SAVE_FAILED() });
    }
  },
}));
