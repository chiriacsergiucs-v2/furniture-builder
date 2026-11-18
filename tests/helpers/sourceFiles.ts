import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every `.ts` and `.tsx` file under `dir`, recursively (the boundary tests scan the source with it). */
export const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

/** Each source file under `<root>/src` as a repo-relative path with forward slashes, and its text. */
export const sourceTexts = (root: string) =>
  files(join(root, 'src')).map((f) => ({
    file: relative(root, f).split(/[\\/]/).join('/'),
    text: readFileSync(f, 'utf8'),
  }));
