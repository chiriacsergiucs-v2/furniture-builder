import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { duplicateItem } from '../src/core/arrange';
import { templates } from '../src/core/design';
import { addLinkedCopy, linkCount, propagateLinks, pruneLinks } from '../src/core/linked';
import { makeItem, newProject, validateProject, type Project } from '../src/core/project';
import {
  projectFromTemplate,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import type { CabinetParams, Design, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const st = () => useDesign.getState();
const cab = (d: Design) => d.product.params as CabinetParams;
const firstOf = (s: Space, kind: Space['kind']): Space | undefined =>
  s.kind === kind
    ? s
    : s.kind === 'split'
      ? s.children.map((c) => firstOf(c, kind)).find(Boolean)
      : undefined;

/** A project with one chest and a linked copy of it, plus an unlinked third piece. */
function threePieces(): { p: Project; a: string; b: string; c: string } {
  const base = newProject();
  const a = makeItem(base, byTemplate('chest'));
  const c = makeItem(base, byTemplate('base-door'));
  const res = addLinkedCopy({ ...base, items: [a, c] }, a.id)!;
  return { p: res.project, a: a.id, b: res.id, c: c.id };
}
const withWidth = (p: Project, id: string, width: number): Project => ({
  ...p,
  items: p.items.map((i) =>
    i.id === id
      ? {
          ...i,
          design: {
            ...i.design,
            product: { ...i.design.product, params: { ...cab(i.design), width } },
          } as Design,
        }
      : i,
  ),
});
const item = (p: Project, id: string) => p.items.find((i) => i.id === id)!;

describe('linked copies (ADR-111)', () => {
  it('Add a linked copy gives both the same link; Duplicate makes an independent copy', () => {
    const { p, a, b } = threePieces();
    expect(item(p, a).linkId).toBeTruthy();
    expect(item(p, b).linkId).toBe(item(p, a).linkId);
    expect(item(p, b).design.id).not.toBe(item(p, a).design.id);
    expect(linkCount(p, a)).toBe(2);
    const dup = duplicateItem(p, a)!;
    expect(item(dup.project, dup.id).linkId).toBeUndefined();
    expect(linkCount(dup.project, a)).toBe(2);
  });

  it('switch on: a change to one copy reaches the other and nothing else', () => {
    const { p, a, b, c } = threePieces();
    const next = propagateLinks(p, withWidth(p, a, 1111), true);
    expect(cab(item(next, b).design).width).toBe(1111);
    expect(item(next, b).design.id).toBe(item(p, b).design.id);
    expect(item(next, b).position).toEqual(item(p, b).position);
    expect(item(next, c)).toBe(item(p, c));
  });

  it('switch off: only the changed copy changes and it leaves the group; a group of one loses its link', () => {
    const { p, a, b } = threePieces();
    const next = propagateLinks(p, withWidth(p, a, 1111), false);
    expect(cab(item(next, b).design).width).toBe(cab(item(p, b).design).width);
    expect(item(next, a).linkId).toBeUndefined();
    expect(item(next, b).linkId).toBeUndefined();
  });

  it('when every copy changed, nothing is carried; a removed copy unlinks the last one', () => {
    const { p, a, b } = threePieces();
    const both = withWidth(withWidth(p, a, 1111), b, 1222);
    const next = propagateLinks(p, both, true);
    expect(cab(item(next, a).design).width).toBe(1111);
    expect(cab(item(next, b).design).width).toBe(1222);
    const gone = pruneLinks({ ...p, items: p.items.filter((i) => i.id !== b) });
    expect(item(gone, a).linkId).toBeUndefined();
  });

  it('store: width, a drawer count and a shelf inside one copy reach the other; one undo reverts both', () => {
    const { p, a, b } = threePieces();
    st().openProject(p);
    st().setLinkAll(true);
    st().resizeItem(a, 'width', 1234);
    expect(cab(item(st().project!, b).design).width).toBe(1234);

    st().selectItem(a);
    const drawers = firstOf(cab(st().design).interior, 'drawers')!;
    st().updateSpace(drawers.id, (s) => (s.kind === 'drawers' ? { ...s, count: s.count + 1 } : s));
    const want = (
      firstOf(cab(item(st().project!, a).design).interior, 'drawers') as { count: number }
    ).count;
    expect(
      (firstOf(cab(item(st().project!, b).design).interior, 'drawers') as { count: number }).count,
    ).toBe(want);
    st().updateSpace(drawers.id, () => ({ id: drawers.id, kind: 'shelves', count: 2 }));
    expect(firstOf(cab(item(st().project!, b).design).interior, 'shelves')).toBeTruthy();

    st().undoProject();
    expect(firstOf(cab(item(st().project!, b).design).interior, 'drawers')).toBeTruthy();
    expect(firstOf(cab(item(st().project!, a).design).interior, 'drawers')).toBeTruthy();
  });

  it('store: a change in the piece editor reaches the other copy on Back to project', () => {
    const { p, a, b } = threePieces();
    st().openProject(p);
    st().editItem(a);
    st().resizePiece('width', 1300);
    st().backToProject();
    expect(cab(item(st().project!, b).design).width).toBe(1300);
    st().undoProject();
    expect(cab(item(st().project!, b).design).width).toBe(cab(item(p, b).design).width);
  });

  it('store: Add a linked copy is one undo step; with the switch off an edit unlinks', () => {
    const base = newProject();
    const a = makeItem(base, byTemplate('chest'));
    st().openProject({ ...base, items: [a] });
    st().addLinkedCopy(a.id);
    expect(st().project!.items).toHaveLength(2);
    expect(linkCount(st().project!, a.id)).toBe(2);
    st().setLinkAll(false);
    st().resizeItem(a.id, 'width', 999);
    const other = st().project!.items.find((i) => i.id !== a.id)!;
    expect(cab(other.design).width).not.toBe(999);
    expect(linkCount(st().project!, a.id)).toBe(1);
    st().setLinkAll(true);
    st().undoProject();
    st().undoProject();
    expect(st().project!.items).toHaveLength(1);
  });
});

describe('linked copies are saved (ADR-111)', () => {
  beforeEach(() => st().setLinkAll(true));
  it('schemaVersion 9 keeps the link; version 8 projects load unlinked; a link in a version 8 project is refused', () => {
    const { p } = threePieces();
    const saved = { ...p, schemaVersion: 9 as const };
    expect(validateProject(saved)).toEqual([]);
    expect(JSON.parse(JSON.stringify(saved)).items[0].linkId).toBe(p.items[0].linkId);
    const old = { ...newProject(), schemaVersion: 8 as const };
    expect(validateProject(old)).toEqual([]);
    expect(validateProject({ ...saved, schemaVersion: 8 })).toContain(
      'Linked copies need project schemaVersion 9',
    );
    expect(
      validateProject({
        ...saved,
        items: saved.items.map((i) => ({ ...i, linkId: 5 })),
      } as unknown),
    ).toContain('Invalid item link');
  });
  it('project templates keep the link in projects made from them', () => {
    const { p, a, b } = threePieces();
    const t = templateFromProject(p, 'Linked');
    expect(validateProjectTemplate(JSON.parse(JSON.stringify(t)))).toEqual([]);
    const made = projectFromTemplate(t);
    expect(validateProject(made)).toEqual([]);
    const ia = p.items.findIndex((i) => i.id === a);
    const ib = p.items.findIndex((i) => i.id === b);
    expect(made.items[ia].linkId).toBeTruthy();
    expect(made.items[ib].linkId).toBe(made.items[ia].linkId);
  });
});
