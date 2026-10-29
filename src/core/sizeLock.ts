/**
 * Locked sizes (ADR-122, user answer 2026-10-27 "Accept default": a separate Lock size, apart from the placement lock
 * of ADR-095). A size-locked piece keeps its width, height and depth: the size fields are off, and any change that
 * would resize it — an edit, a linked copy's change (ADR-111), Replace (ADR-098) — is refused with the piece's name.
 * Its boards, insides and place can still change. Pure; sizes come from the built model (ADR-004).
 */
import { t } from './i18n';
import { buildModel } from './build';
import { pieceName, type Project, type ProjectItem } from './project';
import type { Design } from './types';

/** The hint shown where a size-locked piece's size would be changed. */
export const SIZE_LOCKED_HINT = t('Size locked — unlock to change');

export const isSizeLocked = (item: Pick<ProjectItem, 'sizeLocked'> | undefined): boolean =>
  !!item?.sizeLocked;

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

/** Whether two designs have the same outside size. */
export function sameSize(a: Design, b: Design): boolean {
  if (a === b) return true;
  const x = outerSize(a),
    y = outerSize(b);
  return x.w === y.w && x.h === y.h && x.d === y.d;
}

/** Why a size-locked piece may not take `next` as its design, or null. */
export function resizeBlocked(project: Project, id: string, next: Design): string | null {
  const it = project.items.find((i) => i.id === id);
  if (!it || !isSizeLocked(it) || sameSize(it.design, next)) return null;
  return t('{name} has its size locked — unlock its size to change it.', {
    name: pieceName(project, id),
  });
}

/**
 * Why the change from `before` to `after` is refused (ADR-122), or null: a piece that was size-locked before would
 * come out a different outside size. Only pieces whose design changed are built.
 */
export function sizeLockBlocked(before: Project | null, after: Project): string | null {
  if (!before) return null;
  const was = new Map(before.items.map((i) => [i.id, i]));
  for (const it of after.items) {
    const old = was.get(it.id);
    if (!old || !isSizeLocked(old) || old.design === it.design) continue;
    if (!sameSize(old.design, it.design)) return resizeBlocked(before, it.id, it.design);
  }
  return null;
}
