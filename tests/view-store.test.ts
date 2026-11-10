import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { useViewStore } from '../src/store/viewStore';

// ADR-230: the 3D view and the page share seams, lit parts and the fit request through the view store, not through
// `document.body.dataset` or a window event.
describe('view store (ADR-230)', () => {
  it('starts with nothing drawn and no fit request', () => {
    const s = useViewStore.getState();
    expect([s.seams, s.lit, s.fitRequest]).toEqual([null, null, 0]);
  });

  it('setting seams, lit and the fit request changes the fields the viewer reads', () => {
    const s = useViewStore.getState();
    s.setSeams(3);
    s.setLit(7);
    s.requestFit();
    s.requestFit();
    expect(useViewStore.getState()).toMatchObject({ seams: 3, lit: 7, fitRequest: 2 });
    s.setSeams(null);
    s.setLit(null);
    expect(useViewStore.getState()).toMatchObject({ seams: null, lit: null, fitRequest: 2 });
  });

  it('no DOM side channel is left in the viewer or the ui', () => {
    const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    // The viewer's code is Viewer3D.tsx and the scene parts moved out of it (cleanup audit 2026-11-09, item 13).
    const viewer = src('viewer/Viewer3D.tsx') + src('viewer/ViewerScene.tsx');
    const app = src('ui/App.tsx');
    for (const text of [viewer, app]) {
      expect(text).not.toMatch(/document\.body\.dataset/);
      expect(text).not.toMatch(/fb:fit/);
      expect(text).not.toMatch(/getElementById\('count-dock'\)/);
    }
    // The viewer reads and writes the store fields instead.
    expect(viewer).toMatch(/useViewStore/);
    expect(app).toMatch(/requestFit/);
  });
});
