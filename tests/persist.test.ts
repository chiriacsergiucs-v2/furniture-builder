import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { db, deleteDesign, listDesigns, loadDesign, saveDesign } from '../src/persist/db';

describe('local storage', () => {
  it('saves, lists newest first, loads and deletes designs', async () => {
    const a = { ...templates[0].create(), updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...templates[1].create(), updatedAt: '2026-02-01T00:00:00.000Z' };
    await saveDesign(a);
    await saveDesign(b);
    expect((await listDesigns()).map((r) => r.id)).toEqual([b.id, a.id]);
    expect(await loadDesign(a.id)).toEqual(a);
    await saveDesign({ ...a, name: 'Renamed' });
    expect((await loadDesign(a.id))?.name).toBe('Renamed');
    await deleteDesign(a.id);
    expect(await loadDesign(a.id)).toBeUndefined();
  });
  it('skips a corrupt stored row instead of loading it', async () => {
    const d = templates[0].create();
    await db.designs.put({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      design: { ...d, schemaVersion: 99 } as never,
    });
    expect(await loadDesign(d.id)).toBeUndefined();
    expect(await db.designs.get(d.id)).toBeDefined(); // never deleted
  });
});
