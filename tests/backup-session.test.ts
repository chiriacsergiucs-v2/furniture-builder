// ADR-235: the autosave path reads the backup folder and the persist-asked flag once per visit, and a folder backup
// after a save reads only the rows saved since. Each test starts a fresh visit (fresh modules and storage).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * An in-memory folder with the File System Access calls the backup uses. A class, so the handle can be stored in
 * IndexedDB as a real one is (its methods are not copied).
 */
class MemDir {
  readonly kind = 'directory';
  dirs = new Map<string, MemDir>();
  files = new Map<string, string>();
  constructor(readonly name = 'backup') {}
  async getDirectoryHandle(n: string): Promise<MemDir> {
    if (!this.dirs.has(n)) this.dirs.set(n, new MemDir(n));
    return this.dirs.get(n)!;
  }
  async getFileHandle(n: string) {
    const files = this.files;
    return {
      kind: 'file',
      name: n,
      async createWritable() {
        let text = '';
        return {
          async write(d: string) {
            text = d;
          },
          async close() {
            files.set(n, text);
          },
        };
      },
    };
  }
  async removeEntry(n: string) {
    this.files.delete(n);
  }
  async *values() {
    for (const d of this.dirs.values()) yield d;
    for (const n of [...this.files.keys()]) yield { kind: 'file', name: n };
  }
  async queryPermission() {
    return 'granted' as const;
  }
}
const memDir = () => new MemDir();
const folderFiles = (root: MemDir) =>
  Object.fromEntries(
    [...root.dirs.values()].flatMap((d) =>
      [...d.files.entries()].map(([n, text]) => [`${d.name}/${n}`, text]),
    ),
  );

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function freshVisit() {
  vi.resetModules();
  const dbm = await import('../src/persist/db');
  const backup = await import('../src/persist/backup');
  const { templates } = await import('../src/core/design');
  const { newProject } = await import('../src/core/project');
  const { planBackup } = await import('../src/core/backup');
  // Dexie keeps the IndexedDB it found first: start from an empty database.
  await dbm.db.delete();
  await dbm.db.open();
  return { dbm, backup, templates, newProject, planBackup };
}

describe('autosave path (ADR-235)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('three saves read the backup folder and the persist-asked flag once; with no folder, too', async () => {
    const { dbm, backup, templates } = await freshVisit();
    const get = vi.spyOn(dbm.db.settings, 'get');
    const off = backup.startAutoBackup(0);
    try {
      for (let i = 0; i < 3; i++) {
        await dbm.saveDesign(templates[0].create());
        await flush();
      }
    } finally {
      off();
    }
    const reads = (key: string) => get.mock.calls.filter(([k]) => (k as unknown) === key).length;
    expect(reads('backup-folder')).toBe(1);
    expect(reads('persist-asked')).toBe(1);
    expect(await dbm.getSetting('persist-asked')).toBe(true);
  });

  it('with a folder: after saving one project, a backup reads no models or images and matches a full backup', async () => {
    const { dbm, backup, templates, newProject, planBackup } = await freshVisit();
    const root = memDir();
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });
    expect(await backup.chooseFolder()).toEqual({ name: 'backup', permission: 'granted' });
    await dbm.saveDesign(templates[0].create());
    await dbm.saveImage({
      id: 'img1',
      name: 'img1',
      type: 'image/png',
      width: 1,
      height: 1,
      bytes: new Uint8Array([1, 2, 3]).buffer,
      createdAt: '2026',
    });
    await dbm.saveModel({
      id: 'model1',
      name: 'model1',
      format: 'glb',
      bytes: new Uint8Array([4, 5]).buffer,
      size: { w: 1, h: 1, d: 1 },
      triangles: 1,
      createdAt: '2026',
    } as never);
    const old = newProject('Old');
    await dbm.saveProject(old);
    expect((await backup.backupNow()).error).toBeUndefined(); // the first backup of a visit reads everything

    // Spied on the tables' shared prototype: `db.table(name)` and `db.models` are not the same object in Dexie 4.
    const read: string[] = [];
    const proto = Object.getPrototypeOf(dbm.db.table('models')) as {
      toArray: () => Promise<unknown[]>;
    };
    const toArray = proto.toArray;
    vi.spyOn(proto, 'toArray').mockImplementation(function (this: { name: string }) {
      read.push(this.name);
      return toArray.call(this);
    });
    await dbm.saveProject(newProject('Kitchen'));
    await dbm.deleteProject(old.id);
    const status = await backup.backupNow();
    expect(status.error).toBeUndefined();
    expect(read).not.toContain('models');
    expect(read).not.toContain('images');
    vi.restoreAllMocks();

    const full = planBackup(await backup.readTables());
    expect(status.items).toBe(full.length);
    expect(folderFiles(root)).toEqual(Object.fromEntries(full.map((f) => [f.path, f.text])));
  });

  it('a file of its own missing from the folder is written again', async () => {
    const { dbm, backup, templates, planBackup } = await freshVisit();
    const root = memDir();
    vi.stubGlobal('window', { showDirectoryPicker: async () => root });
    await backup.chooseFolder();
    const d = templates[0].create();
    await dbm.saveDesign(d);
    await backup.backupNow();
    root.dirs.get('designs')!.files.clear();
    await backup.backupNow();
    const full = planBackup(await backup.readTables());
    expect(folderFiles(root)).toEqual(Object.fromEntries(full.map((f) => [f.path, f.text])));
  });
});
