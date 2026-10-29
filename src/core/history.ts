/**
 * Named undo steps (ADR-123, research "command/transaction log"): every project step in the undo history carries a
 * name. An action may name its step; otherwise the name is derived here from what changed between the two project
 * states. Pure: compares documents only.
 */
import type { Project, ProjectItem } from './project';
import { t } from './i18n';

const pieces = (n: number) => t('{n|# piece|# pieces}', { n });
/** "Base 600" for one piece, "3 pieces" for more. */
const what = (list: ProjectItem[]) =>
  list.length === 1 ? list[0].design.name : pieces(list.length);

const samePos = (a: ProjectItem, b: ProjectItem) =>
  a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z;

/** A short name for the step from `prev` to `next`, e.g. "Move Base 600", "Add 2 pieces", "Group 3 pieces". */
export function describeChange(prev: Project, next: Project): string {
  const before = new Map(prev.items.map((i) => [i.id, i]));
  const after = new Map(next.items.map((i) => [i.id, i]));
  const added = next.items.filter((i) => !before.has(i.id));
  const removed = prev.items.filter((i) => !after.has(i.id));
  if (added.length && !removed.length) return t('Add {what}', { what: what(added) });
  if (removed.length && !added.length) return t('Remove {what}', { what: what(removed) });
  if (added.length && removed.length)
    return t('Change {what}', { what: pieces(added.length + removed.length) });
  const changed = next.items.filter((i) => before.get(i.id) !== i);
  if (changed.length) {
    const was = (i: ProjectItem) => before.get(i.id)!;
    const only = (test: (a: ProjectItem, b: ProjectItem) => boolean) =>
      changed.every((i) => test(was(i), i));
    const designs = changed.filter((i) => was(i).design !== i.design);
    if (!designs.length) {
      if (only((a, b) => a.rotationY !== b.rotationY))
        return t('Turn {what}', { what: what(changed) });
      if (only((a, b) => !!a.locked !== !!b.locked))
        return t(changed[0].locked ? 'Lock {what}' : 'Unlock {what}', { what: what(changed) });
      if (only((a, b) => a.quantity !== b.quantity && samePos(a, b)))
        return t('Change how many: {what}', { what: what(changed) });
      if (only((a, b) => a.rotationY === b.rotationY && a.quantity === b.quantity))
        return t('Move {what}', { what: what(changed) });
    }
    return t('Edit {what}', { what: what(designs.length ? designs : changed) });
  }
  if ((prev.groups ?? []).length !== (next.groups ?? []).length)
    return (next.groups ?? []).length > (prev.groups ?? []).length
      ? t('Group pieces')
      : t('Ungroup');
  if (prev.room !== next.room) return t('Change the room');
  if (prev.models !== next.models) return t('Change 3D models');
  if (
    prev.runParts !== next.runParts ||
    prev.runSettings !== next.runSettings ||
    prev.runRequests !== next.runRequests
  )
    return t('Change run parts');
  if (prev.cutting !== next.cutting) return t('Change the saw cut');
  if (prev.name !== next.name) return t('Rename the project');
  return t('Change the project');
}
