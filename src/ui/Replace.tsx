import { useMemo, useState } from 'react';
import { insertVariant } from '../core/catalog';
import type { ViewFamily } from '../core/catalog/local';
import type { ProjectItem } from '../core/project';
import {
  designEdited,
  ownWidth,
  placeKind,
  replaceOptions,
  type ReplaceOption,
} from '../core/replace';
import { useDesign } from '../store/designStore';
import { ItemPicture, useCatalog } from './Catalog';
import { askConfirm } from './Confirm';
import { Toggle } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { useProblem } from './problemStore';
import { useUi } from './shell/uiStore';

/**
 * "Replace…" on the selected piece (ADR-098): the catalog items that stand the same way and have the same width;
 * "Show other widths" adds the rest. Picking one puts a fresh copy in the piece's place in one undo step and says
 * what changed; a new problem opens with its repairs (ADR-071).
 */
export function ReplaceButton({ item }: { item: ProjectItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn outline" onClick={() => setOpen(true)}>
        <Icon name="catalog" className="sm" />
        Replace…
      </button>
      {open && <ReplaceDialog item={item} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReplaceDialog({ item, onClose }: { item: ProjectItem; onClose: () => void }) {
  const families = useCatalog();
  const width = useMemo(() => ownWidth(item.design), [item.design]);
  // A stacked piece gets same-width items only, so it has no "Show other widths" switch (G-102).
  const stacked = placeKind(item) === 'above';
  const [others, setOthers] = useState(false);
  // Built once per open dialog (ADR-004: sizes come from the built models).
  const options = useMemo(() => replaceOptions(item, families), [item, families]);
  const same = options.filter((o) => o.sameWidth);
  const shown = others ? options : same;
  const pick = async (o: ReplaceOption<ViewFamily>) => {
    onClose();
    const name = `${o.family.name}: ${o.variant.name}`;
    if (
      designEdited(item.design, families) &&
      !(await askConfirm(
        `“${item.design.name}” was edited after it was added. Replacing it with ${name} replaces those edits; position, turn, quantity, placement, zones and boards stay.`,
        { confirmLabel: 'Replace' },
      ))
    )
      return;
    const d = insertVariant(o.family, o.variant);
    if (!d) return;
    const report = useDesign.getState().replaceItem(item.id, d);
    if (!report) return;
    useUi.getState().setNotice({ ok: !report.problems.length, text: report.text });
    const project = useDesign.getState().project;
    if (report.problems[0] && project) useProblem.getState().show(report.problems[0], project.id);
  };
  return (
    <Dialog open onClose={onClose} title={`Replace ${item.design.name}`}>
      <p className="hint">
        Items that stand the same way
        {others ? '' : ` and are ${width} mm wide`}. The piece keeps its place, turn, quantity,
        placement, zones and boards; undo puts it back.
      </p>
      {!stacked && <Toggle label="Show other widths" checked={others} onChange={setOthers} />}
      {shown.length === 0 ? (
        <p className="empty center">
          <Icon name="info" />
          {others
            ? 'No catalog item stands the same way.'
            : stacked
              ? 'No catalog item has the same width.'
              : 'No catalog item has the same width. Switch on “Show other widths” to see the rest.'}
        </p>
      ) : (
        <ul className="template-list replace-list" aria-label="Alternatives">
          {shown.map((o) => (
            <li key={`${o.family.id}:${o.variant.id}`}>
              <button type="button" className="row-btn" onClick={() => void pick(o)}>
                <ItemPicture
                  f={o.family}
                  v={o.variant}
                  className="thumb"
                  width={64}
                  height={44}
                  alt=""
                />
                <span>
                  <strong>
                    {o.family.name}: {o.variant.name}
                  </strong>
                  <span className="sub num">
                    {o.w} × {o.h} × {o.d} mm
                  </span>
                  {!o.sameWidth && <span className="sub">Neighbours may need moving.</span>}
                </span>
                <Icon name="chevron-right" className="chev sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
