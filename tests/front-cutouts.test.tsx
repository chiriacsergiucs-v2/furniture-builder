// @vitest-environment jsdom
// G-438 (N393): sink and hob cut-outs are marked on the worktop in the room front view. The x range comes from the
// core (`cutoutFrontLines`, over `cutoutOutlines`); the front view draws it as a dashed line with a title.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  cutoutFrontLines,
  cutoutOutlines,
  makeItem,
  newProject,
  placeItem,
  resolvePlacements,
  suggestRunParts,
  type Project,
} from '../src/core/project';
import { FrontCutoutMarks } from '../src/ui/RunRequests';

function kitchen(): Project {
  let p = newProject('Run');
  const base = templates.find((x) => x.id === 'base-door')!;
  for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, base.create())] };
  p = { ...p, runParts: suggestRunParts(p) };
  const [a, b] = p.items;
  return {
    ...p,
    sinks: [{ id: 's1', baseId: b.id, w: 500, d: 400 }],
    hobs: [{ id: 'h1', baseId: a.id, w: 560, d: 490, x: 10 }],
  };
}
const pieces = (p: Project) => resolvePlacements(p).items.map((i) => placeItem(i));

describe('cutoutFrontLines (G-438)', () => {
  it('gives each cut-out its x range and the worktop top height, from the outlines', () => {
    const p = kitchen();
    const outs = cutoutOutlines(p, pieces(p));
    const lines = cutoutFrontLines(outs);
    expect(lines).toHaveLength(2);
    lines.forEach((l, i) => {
      expect(l).toMatchObject({ id: outs[i].id, kind: outs[i].kind, w: outs[i].w });
      expect(l.x1).toBe(outs[i].box.x);
      expect(l.x2 - l.x1).toBe(outs[i].w);
      expect(l.y).toBe(outs[i].box.y + outs[i].box.h);
    });
    expect(lines.map((l) => l.kind)).toEqual(['sink', 'hob']);
  });

  it('is empty without cut-outs', () => {
    expect(cutoutFrontLines([])).toEqual([]);
  });
});

describe('front view cut-out marks (G-438)', () => {
  it('draws one dashed line per cut-out at its width, titled', () => {
    const p = kitchen();
    const lines = cutoutFrontLines(cutoutOutlines(p, pieces(p)));
    const { container } = render(
      <svg>
        <FrontCutoutMarks project={p} pieces={pieces(p)} />
      </svg>,
    );
    const drawn = [...container.querySelectorAll('line.front-cutout')];
    expect(drawn).toHaveLength(2);
    drawn.forEach((el, i) => {
      expect(Number(el.getAttribute('x1'))).toBe(lines[i].x1);
      expect(Number(el.getAttribute('x2'))).toBe(lines[i].x2);
      expect(Number(el.getAttribute('y1'))).toBe(-lines[i].y);
    });
    expect(drawn[0].querySelector('title')?.textContent).toBe('Sink cut-out 500 mm wide');
    expect(drawn[1].querySelector('title')?.textContent).toBe('Hob cut-out 560 mm wide');
  });

  it('draws nothing without cut-outs', () => {
    const p = { ...kitchen(), sinks: undefined, hobs: undefined };
    const { container } = render(
      <svg>
        <FrontCutoutMarks project={p} pieces={pieces(p)} />
      </svg>,
    );
    expect(container.querySelector('.front-cutouts')).toBeNull();
  });
});
