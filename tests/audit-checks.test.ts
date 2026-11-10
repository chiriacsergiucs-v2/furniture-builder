// ADR-258 (UI audit, Checks and problems): a piece's own warnings reach the project's diagnostics, named by the piece,
// with the item and its panel ids, and never block (they stay warnings).
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { buildModel } from '../src/core/build';
import { resizeProduct } from '../src/core/pieceSize';
import { buildProjectModel, makeItem, newProject } from '../src/core/project';
import type { Design } from '../src/core/types';

/** The first built-in piece (widened if needed) that has a warning of its own. */
function pieceWithWarning(): Design {
  for (const tpl of templates) {
    const base = tpl.create();
    for (const by of [0, 300, 600]) {
      const w = (base.product.params as unknown as { width?: number }).width;
      const d =
        w === undefined || by === 0
          ? base
          : { ...base, product: resizeProduct(base.product, 'width', w + by) };
      if (buildModel(d).diagnostics.some((x) => x.severity === 'warning')) return d;
    }
  }
  throw new Error('no built-in piece has a warning');
}

describe('ADR-258 piece guidance in project checks', () => {
  it('each piece warning is listed in the project, named by the piece, as a warning', () => {
    const d = pieceWithWarning();
    const own = buildModel(d).diagnostics.filter((x) => x.severity === 'warning');
    let p = newProject('P');
    const item = makeItem(p, d);
    p = { ...p, items: [item] };
    const pd = buildProjectModel(p).diagnostics;
    for (const w of own) {
      const found = pd.find((x) => x.code === w.code && x.itemIds?.includes(item.id));
      expect(found?.severity).toBe('warning');
      expect(found?.message).toBe(`${d.name}: ${w.message}`);
      if (w.panelIds?.length) expect(found?.panelIds?.[0]).toBe(`${item.id}:${w.panelIds[0]}`);
    }
  });
});
