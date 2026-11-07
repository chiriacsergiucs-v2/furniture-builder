/**
 * Brands from the user's decor list (ADR-210, G-044): one brand per manufacturer of the imported decor list
 * (ADR-049), an `other` row by the maker written in the file, with its decors; and whether a saved piece has a board of
 * that maker. Offline: the decor list is on the device, nothing is fetched (ADR-002). Pure.
 */
import { makerName, type Decor } from '../materials';
import type { Design, MaterialMaker } from '../types';

interface DecorBrand {
  /** `egger`, or `other:<written maker>` for an `other` row. */
  key: string;
  /** "Egger", or the maker as written in the file. */
  label: string;
  maker: MaterialMaker;
  decors: Decor[];
}

const keyOf = (d: Pick<Decor, 'maker' | 'makerText'>) =>
  d.maker === 'other' ? `other:${d.makerText.trim().toLowerCase()}` : d.maker;

/** The decor list's manufacturers, by name, each with its decors by code. */
export function decorBrands(decors: readonly Decor[]): DecorBrand[] {
  const out = new Map<string, DecorBrand>();
  for (const d of decors) {
    const key = keyOf(d);
    const had = out.get(key);
    if (had) had.decors.push(d);
    else
      out.set(key, {
        key,
        label:
          d.maker === 'other'
            ? d.makerText.trim() || (makerName('other') ?? '')
            : (makerName(d.maker) ?? d.maker),
        maker: d.maker,
        decors: [d],
      });
  }
  for (const b of out.values())
    b.decors.sort((a, c) => a.code.localeCompare(c.code) || a.thickness - c.thickness);
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Whether a saved piece has a board of `brand`: a board labelled with its maker; for an `other` maker, a board taken
 * from one of its decors (the written maker is not kept on the board).
 */
export function usesBrand(d: Pick<Design, 'materials'>, brand: DecorBrand): boolean {
  const codes = new Set(brand.decors.map((x) => x.code));
  return d.materials.some(
    (m) =>
      m.maker === brand.maker &&
      (brand.maker !== 'other' || (!!m.decor && codes.has(m.decor.code))),
  );
}
