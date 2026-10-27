import { create } from 'zustand';
import { canonical, defaultMark, storedOf, type StoredBundle } from '../core/research/catalog';
import { SHIPPED_RESEARCH } from '../core/research';
import type { ResearchBundle, ResearchMark } from '../core/research/types';
import {
  listResearchBundles,
  listResearchMarks,
  saveResearchBundle,
  saveResearchMarks,
} from '../persist/db';

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
const shipped = (): StoredBundle[] =>
  SHIPPED_RESEARCH.map((b) => storedOf(b, '2026-10-23T00:00:00.000Z'));

/** Shipped editions win over a stored copy of the same edition (research records are never edited by the user). */
export function seedShipped(
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

export const useResearch = create<ResearchState>((set, get) => ({
  stored: shipped(),
  marks: {},
  loaded: false,
  error: null,
  init: async () => {
    if (get().loaded) return;
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
        error:
          'Browser storage is unavailable: the shipped research is shown, but decisions and imports will not be kept.',
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
    try {
      await saveResearchMarks(next);
    } catch {
      set({ error: 'Your decision could not be saved on this device.' });
    }
  },
}));
