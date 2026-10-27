import { useMemo } from 'react';
import { buildModel } from '../core/build';
import { cutDimensions } from '../core/geometry';
import type { Design } from '../core/types';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';

/**
 * Leave out parts (N124): any part of a piece, its frame too, can be taken off the parts list and sheets (cut from
 * leftovers, or decided later). A confirmation with the warning first; afterwards a warning stays in Checks.
 * `itemId`: a project piece; absent = the open design. The part last tapped in 3D is offered first.
 */
export function LeaveOutParts({ design, itemId }: { design: Design; itemId?: string }) {
  const leaveOut = useDesign((s) => s.leaveOut);
  const tapped = useDesign((s) => s.tappedPanelId);
  // Every part as built with nothing left out, so a left-out part can be put back.
  const all = useMemo(() => {
    const { omit: _o, ...whole } = design;
    void _o;
    const d = whole as Design;
    return buildModel(d).panels.map((p) => {
      const m = d.materials.find((x) => x.id === p.materialId);
      const c = cutDimensions(p, m?.grain ?? false);
      return { id: p.id, label: p.label, size: `${c.length} × ${c.width} × ${c.thickness}` };
    });
  }, [design]);
  const out = new Set(design.omit ?? []);
  const local =
    tapped && itemId
      ? tapped.startsWith(`${itemId}:`)
        ? tapped.slice(itemId.length + 1)
        : null
      : tapped;
  const tappedPart = local ? all.find((p) => p.id === local) : undefined;
  const drop = async (p: { id: string; label: string }) => {
    if (
      !(await askConfirm(
        `Leave out “${p.label}”? It comes off the parts list and sheets, even if it is part of the frame: cut it from leftovers or decide later. Hardware is unchanged, and a warning stays in Checks until you put it back.`,
        { confirmLabel: 'Leave out' },
      ))
    )
      return;
    leaveOut([p.id], true, itemId);
  };
  const row = (p: (typeof all)[number]) => (
    <li key={p.id} className="leave-out-row">
      <span>
        <strong>{p.label}</strong> <span className="sub num">{p.size} mm</span>
      </span>
      {out.has(p.id) ? (
        <button type="button" className="btn sm" onClick={() => leaveOut([p.id], false, itemId)}>
          Put back
        </button>
      ) : (
        <button
          type="button"
          className="btn sm outline"
          aria-label={`Leave out ${p.label}`}
          onClick={() => void drop(p)}
        >
          Leave out
        </button>
      )}
    </li>
  );
  const left = all.filter((p) => out.has(p.id));
  return (
    <div className="leave-out">
      {tappedPart && (
        <>
          <h4>Tapped in 3D</h4>
          <ul className="leave-out-list">{row(tappedPart)}</ul>
        </>
      )}
      {left.length > 0 && (
        <>
          <h4>Left out ({left.length})</h4>
          <ul className="leave-out-list">{left.map(row)}</ul>
        </>
      )}
      <details>
        <summary>All parts ({all.length - left.length})</summary>
        <ul className="leave-out-list">{all.filter((p) => !out.has(p.id)).map(row)}</ul>
      </details>
      <p className="hint">Tap a part in 3D to find it here.</p>
    </div>
  );
}
