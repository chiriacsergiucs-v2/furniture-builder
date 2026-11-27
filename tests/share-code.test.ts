import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { decodeCode, encodeCode } from '../src/core/shareCode';

// G-201 (user pick "Document-only"): a design code carries the document only. A board picture travels as its id
// reference; the picture itself (and any 3D model) stays on the device, and a project file carries it.
describe('design codes carry the document only (G-201)', () => {
  it('keeps a board picture as its id reference, with no picture data, and stays short', async () => {
    const d = templates.find((t) => t.id === 'chest')!.create();
    const withPicture = {
      ...d,
      materials: d.materials.map((m, i) =>
        i === 0
          ? { ...m, image: { id: 'img-1', name: 'oak.jpg', tileLength: 2800, tileWidth: 2070 } }
          : m,
      ),
    };
    const code = await encodeCode(withPicture);
    const back = await decodeCode(code);
    expect(back).toEqual({ ok: true, doc: withPicture });
    expect(JSON.stringify(back)).not.toMatch(/"pictures"|"models3d"|data:image/);
    expect(code.length).toBeLessThan(4000);
  });
});
