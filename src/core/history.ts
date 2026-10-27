/**
 * Named undo steps (ADR-123, research "command/transaction log"): every project step in the undo history carries a
 * name. An action may name its step; otherwise the name is derived here from what changed between the two project
 * states. Pure: compares documents only.
 */
import type { Project, ProjectItem } from './project';

const pieces = (n: number) => `${n} pieces`;
/** "Base 600" for one piece, "3 pieces" for more. */
const what = (list: ProjectItem[]) => (list.length === 1 ? list[0].design.name : pieces(list.length));

const samePos = (a: ProjectItem, b: ProjectItem) =>
  a.position.x === b.position.x && a.position.y === b.position.y && a.position.z === b.position.z;

/** A short name for the step from `prev` to `next`, e.g. "Move Base 600", "Add 2 pieces", "Group 3 pieces". */
export function describeChange(prev: Project, next: Project): string {
  const before = new Map(prev.items.map((i) => [i.id, i]));
  const after = new Map(next.items.map((i) => [i.id, i]));
  const added = next.items.filter((i) => !before.has(i.id));
  const removed = prev.items.filter((i) => !after.has(i.id));
  if (added.length && !removed.length) return `Add ${what(added)}`;
  if (removed.length && !added.length) return `Remove ${what(removed)}`;
  if (added.length && removed.length) return `Change ${pieces(added.length + removed.length)}`;
  const changed = next.items.filter((i) => before.get(i.id) !== i);
  if (changed.length) {
    const was = (i: ProjectItem) => before.get(i.id)!;
    const only = (test: (a: ProjectItem, b: ProjectItem) => boolean) =>
      changed.every((i) => test(was(i), i));
    const designs = changed.filter((i) => was(i).design !== i.design);
    if (!designs.length) {
      if (only((a, b) => a.rotationY !== b.rotationY)) return `Turn ${what(changed)}`;
      if (only((a, b) => !!a.locked !== !!b.locked))
        return `${changed[0].locked ? 'Lock' : 'Unlock'} ${what(changed)}`;
      if (only((a, b) => a.quantity !== b.quantity && samePos(a, b)))
        return `Change how many: ${what(changed)}`;
      if (only((a, b) => a.rotationY === b.rotationY && a.quantity === b.quantity))
        return `Move ${what(changed)}`;
    }
    return `Edit ${what(designs.length ? designs : changed)}`;
  }
  if ((prev.groups ?? []).length !== (next.groups ?? []).length)
    return (next.groups ?? []).length > (prev.groups ?? []).length ? 'Group pieces' : 'Ungroup';
  if (prev.room !== next.room) return 'Change the room';
  if (prev.models !== next.models) return 'Change 3D models';
  if (
    prev.runParts !== next.runParts ||
    prev.runSettings !== next.runSettings ||
    prev.runRequests !== next.runRequests
  )
    return 'Change run parts';
  if (prev.cutting !== next.cutting) return 'Change the saw cut';
  if (prev.name !== next.name) return 'Rename the project';
  return 'Change the project';
}
