/**
 * Locked sizes (ADR-122, user answer 2026-10-27 "Accept default": a separate Lock size, apart from the placement lock
 * of ADR-095). A size-locked piece keeps its width, height and depth: the size fields are off, and any change that
 * would resize it — an edit, a linked copy's change (ADR-111), Replace (ADR-098) — is refused with the piece's name.
 * Its boards, insides and place can still change. Pure; sizes come from the built model (ADR-004).
 */
import { t } from './i18n';
import { buildModel } from './build';
import {
  carriedBy,
  isLocked,
  isTurnLocked,
  pieceName,
  SIZE_AXES,
  type Project,
  type ProjectItem,
  type SizeAxis,
} from './project';
import type { Design } from './types';

/** The hint shown where a size-locked piece's size would be changed. */
export const SIZE_LOCKED_HINT = t('Size locked — unlock to change');

export const isSizeLocked = (item: Pick<ProjectItem, 'sizeLocked'> | undefined): boolean =>
  !!item?.sizeLocked;

/** The outside sizes a piece keeps (ADR-122, ADR-171): all three when size-locked, else the ones locked one by one. */
export function lockedAxes(
  item: Pick<ProjectItem, 'sizeLocked' | 'sizeLocks'> | undefined,
): SizeAxis[] {
  if (!item) return [];
  if (item.sizeLocked) return [...SIZE_AXES];
  return item.sizeLocks ? [...item.sizeLocks] : [];
}
/**
 * The piece has any lock (ADR-180, user 2026-11-05 "Any lock"): placement (ADR-095), turn or size (ADR-122, ADR-171,
 * all sizes or any one).
 */
export const hasAnyLock = (
  item: Pick<ProjectItem, 'locked' | 'turnLocked' | 'sizeLocked' | 'sizeLocks'> | undefined,
): boolean => isLocked(item) || isTurnLocked(item) || lockedAxes(item).length > 0;
export const isAxisLocked = (
  item: Pick<ProjectItem, 'sizeLocked' | 'sizeLocks'> | undefined,
  axis: SizeAxis,
): boolean => lockedAxes(item).includes(axis);

/** Lock or unlock one outside size (ADR-171); the list is absent when empty. The same project when nothing changes. */
export function setAxisLocked(project: Project, id: string, axis: SizeAxis, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it) return project;
  const have = it.sizeLocks ?? [];
  if (have.includes(axis) === on) return project;
  const list = on
    ? SIZE_AXES.filter((a) => a === axis || have.includes(a))
    : have.filter((a) => a !== axis);
  const { sizeLocks: _s, ...rest } = it;
  void _s;
  const next: ProjectItem = list.length ? { ...rest, sizeLocks: list } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

const AXIS_LABEL: Record<SizeAxis, string> = {
  width: t('width'),
  height: t('height'),
  depth: t('depth'),
};
/** "width", "width and depth", "width, height and depth". */
export function axesText(axes: readonly SizeAxis[]): string {
  const names = axes.map((a) => AXIS_LABEL[a]);
  if (names.length <= 1) return names[0] ?? '';
  return t('{list} and {last}', {
    list: names.slice(0, -1).join(', '),
    last: names[names.length - 1],
  });
}

/** Lock or unlock a piece's size; the flag is absent when unlocked. The same project when nothing changes. */
export function setSizeLocked(project: Project, id: string, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || isSizeLocked(it) === on) return project;
  const { sizeLocked: _s, ...rest } = it;
  void _s;
  const next: ProjectItem = on ? { ...rest, sizeLocked: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/** The outside size of a design (mm), from its built model. */
export function outerSize(design: Design): { w: number; h: number; d: number } {
  const b = buildModel(design).bounds;
  return { w: b.w, h: b.h, d: b.d };
}

/** Whether two designs have the same outside size, on `axes` (default all three). */
export function sameSize(a: Design, b: Design, axes: readonly SizeAxis[] = SIZE_AXES): boolean {
  if (a === b || !axes.length) return true;
  const x = outerSize(a),
    y = outerSize(b);
  return (
    (!axes.includes('width') || x.w === y.w) &&
    (!axes.includes('height') || x.h === y.h) &&
    (!axes.includes('depth') || x.d === y.d)
  );
}

/**
 * Why piece `id` may not take `next` as its design, or null: it is size-locked (ADR-122), or a locked piece sits on it
 * and the change would resize it (ADR-203, G-106, as `moveBlocked` refuses a move); unlocked pieces on it still follow.
 */
export function resizeBlocked(project: Project, id: string, next: Design): string | null {
  const it = project.items.find((i) => i.id === id);
  if (!it || it.design === next) return null;
  const axes = lockedAxes(it);
  if (axes.length && !sameSize(it.design, next, axes)) {
    if (isSizeLocked(it))
      return t('{name} has its size locked — unlock its size to change it.', {
        name: pieceName(project, id),
      });
    return t('{name} has its {axes} locked — unlock it to change it.', {
      name: pieceName(project, id),
      axes: axesText(axes),
    });
  }
  const held = carriedBy(project, id, (c) => !!c.locked).find((c) => c.locked);
  if (held && !sameSize(it.design, next))
    return t('{name} sits on {base} and is locked — unlock it to resize {base}.', {
      name: pieceName(project, held.id),
      base: pieceName(project, id),
    });
  return null;
}

/**
 * Why the change from `before` to `after` is refused (ADR-122, ADR-203), or null: a piece that was size-locked before,
 * or that carries a locked piece, would come out a different outside size. Only those pieces whose design changed are
 * built.
 */
export function sizeLockBlocked(before: Project | null, after: Project): string | null {
  if (!before) return null;
  const was = new Map(before.items.map((i) => [i.id, i]));
  for (const it of after.items) {
    const old = was.get(it.id);
    if (!old || old.design === it.design) continue;
    const why = resizeBlocked(before, it.id, it.design);
    if (why) return why;
  }
  return null;
}
