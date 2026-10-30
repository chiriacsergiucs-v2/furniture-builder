/**
 * ADR-162: downloads the full pictures of Regency boards and worktops once, so a picked seller board can use the app's
 * own copy for its decor (3D, front view) whatever the seller's site allows. The full picture (`imageBase`) is used:
 * the seller's thumbnails (`thumbBase`, about 95 px) are too small for a board's decor and serve the lists only.
 * Only https URLs on the picture base are fetched, a few at a time.
 * Pictures already in the app's folder are skipped. The workflow (`.github/workflows/seller-pictures.yml`) crops and
 * resizes the new files, moves them into `public/sellers/regency/<id>.<ext>`, then marks them:
 *
 *   node tools/sellers/regency-pictures.ts download [catalog.json] [new dir] [public/sellers/regency]
 *   node tools/sellers/regency-pictures.ts mark [catalog.json] [public/sellers/regency]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Product {
  id: string;
  k: string;
  i?: string;
  h?: 1;
}
interface Catalog {
  imageBase: string;
  hostedBase?: string;
  products: Product[];
}

/** Boards and worktops only: the products whose picture becomes a board's decor. */
const BOARD_KINDS = new Set(['board', 'worktop']);

/** The picture's extension from its path (".jpg"), or ".jpg" when it has none we accept. */
export function pictureExt(path: string): string {
  const m = /\.(jpe?g|png|webp)$/i.exec(path);
  return m ? `.${m[1].toLowerCase()}` : '.jpg';
}

/**
 * The pictures still to download: boards and worktops with a picture on the catalog's https picture base. The file is
 * named after the picture's extension, as the app looks it up.
 */
export function picturePlan(
  catalog: Catalog,
  have: Set<string>,
): { id: string; url: string; file: string }[] {
  if (!catalog.imageBase.startsWith('https://')) return [];
  const base = new URL(catalog.imageBase);
  const out: { id: string; url: string; file: string }[] = [];
  for (const p of catalog.products) {
    if (!BOARD_KINDS.has(p.k) || !p.i || !/^[\w.-]+$/.test(p.id)) continue;
    const url = new URL(p.i, catalog.imageBase);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) continue;
    const file = `${p.id}${pictureExt(p.i)}`;
    if (!have.has(file)) out.push({ id: p.id, url: url.href, file });
  }
  return out;
}

/** Marks with `h: 1` each board or worktop whose picture file exists, and clears it on every other product. */
export function markHosted(catalog: Catalog, have: Set<string>, hostedBase: string): Catalog {
  return {
    ...catalog,
    hostedBase,
    products: catalog.products.map((p) => {
      const { h: _old, ...rest } = p;
      void _old;
      return BOARD_KINDS.has(p.k) && p.i && have.has(`${p.id}${pictureExt(p.i)}`)
        ? { ...rest, h: 1 as const }
        : rest;
    }),
  };
}

type Fetch = (url: string) => Promise<{
  ok: boolean;
  headers: { get(n: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

/** Downloads the plan, `parallel` at a time. A failed or non-picture answer is skipped and counted. */
export async function download(
  plan: { url: string; file: string }[],
  dir: string,
  fetchFn: Fetch,
  parallel = 4,
): Promise<{ saved: number; failed: string[] }> {
  mkdirSync(dir, { recursive: true });
  let saved = 0;
  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < plan.length) {
      const job = plan[next++];
      try {
        const r = await fetchFn(job.url);
        const type = r.headers.get('content-type') ?? '';
        if (!r.ok || !type.startsWith('image/')) throw new Error(type);
        writeFileSync(join(dir, job.file), new Uint8Array(await r.arrayBuffer()));
        saved++;
      } catch {
        failed.push(job.url);
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  return { saved, failed };
}

const filesIn = (dir: string) => new Set(existsSync(dir) ? readdirSync(dir) : []);

/** Downloads the boards' pictures not yet in `dir` into `newDir`. */
export async function downloadNew(
  catalogPath: string,
  newDir: string,
  dir: string,
  fetchFn: Fetch,
): Promise<string> {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
  const plan = picturePlan(catalog, filesIn(dir));
  const r = await download(plan, newDir, fetchFn);
  return `${r.saved} pictures saved, ${r.failed.length} failed`;
}

/** Marks the catalog with the pictures now in `dir`. */
export function mark(catalogPath: string, dir: string): string {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
  const next = markHosted(catalog, filesIn(dir), 'sellers/regency/');
  writeFileSync(catalogPath, JSON.stringify(next) + '\n');
  return `${next.products.filter((p) => p.h).length} products have the app's own picture`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, catalogPath = 'src/core/sellers/regency.json', a, b] = process.argv.slice(2);
  const done =
    cmd === 'download'
      ? downloadNew(catalogPath, a ?? '.pictures-new', b ?? 'public/sellers/regency', (url) =>
          fetch(url),
        )
      : cmd === 'mark'
        ? Promise.resolve(mark(catalogPath, a ?? 'public/sellers/regency'))
        : Promise.reject(new Error('usage: regency-pictures.ts download|mark [catalog] [dirs]'));
  done.then(
    (msg) => console.log(msg),
    (e: unknown) => {
      console.error(e);
      process.exit(1);
    },
  );
}
