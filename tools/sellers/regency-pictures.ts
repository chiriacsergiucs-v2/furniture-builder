/**
 * ADR-162: downloads the pictures of Regency boards and worktops once, into `public/sellers/regency/<id>.<ext>`, so
 * a picked seller board can use the app's own copy for its decor (3D, front view) whatever the seller's site allows.
 * Pictures already there are skipped. Products whose file exists get `h: 1` in the catalog. Only https URLs on the
 * catalog's own picture base are fetched, a few at a time. Run by `.github/workflows/seller-pictures.yml`.
 *
 *   node tools/sellers/regency-pictures.ts [src/core/sellers/regency.json] [public/sellers/regency]
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

/** The pictures still to download: boards and worktops with a picture on the catalog's https picture base. */
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

export async function run(catalogPath: string, dir: string, fetchFn: Fetch): Promise<string> {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
  const plan = picturePlan(catalog, filesIn(dir));
  const r = await download(plan, dir, fetchFn);
  writeFileSync(
    catalogPath,
    JSON.stringify(markHosted(catalog, filesIn(dir), 'sellers/regency/')) + '\n',
  );
  return `${r.saved} pictures saved, ${r.failed.length} failed, ${plan.length - r.saved - r.failed.length} skipped`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [catalogPath = 'src/core/sellers/regency.json', dir = 'public/sellers/regency'] =
    process.argv.slice(2);
  run(catalogPath, dir, (url) => fetch(url)).then(
    (msg) => console.log(msg),
    (e: unknown) => {
      console.error(e);
      process.exit(1);
    },
  );
}
