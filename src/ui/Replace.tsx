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
import { InfoTip, Toggle } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { useProblem } from './problemStore';
import { useUi } from './shell/uiStore';
import { t, tr } from '../core/i18n';

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
        {t('Replace…')}
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
    const name = `${tr(o.family.name)}: ${tr(o.variant.name)}`;
    if (
      designEdited(item.design, families) &&
      !(await askConfirm(
        t(
          '“{name}” was edited after it was added. Its own changes go onto {target} where it has the same setting; the result lists what was kept and what was not. Position, turn, quantity, placement, zones and boards stay.',
          { name: item.design.name, target: name },
        ),
        { confirmLabel: t('Replace') },
      ))
    )
      return;
    const d = insertVariant(o.family, o.variant);
    if (!d) return;
    const report = useDesign.getState().replaceItem(item.id, d, { families });
    // Refused (a size-locked piece, ADR-122): say why.
    const why = useDesign.getState().notice;
    if (!report) return void (why && useUi.getState().setNotice({ ok: false, text: why }));
    useUi.getState().setNotice({ ok: !report.problems.length, text: report.text });
    const project = useDesign.getState().project;
    if (report.problems[0] && project) useProblem.getState().show(report.problems[0], project.id);
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('Replace {name}', { name: item.design.name })}
      info={
        <InfoTip label={t('About replacing a piece')} align="start">
          {t(
            'The piece keeps its place, turn, quantity, placement, zones and boards; undo puts it back.',
          )}
        </InfoTip>
      }
    >
      <p className="hint">
        {others
          ? t('Items that stand the same way.')
          : t('Items that stand the same way and are {width} mm wide.', { width })}
      </p>
      {!stacked && <Toggle label={t('Show other widths')} checked={others} onChange={setOthers} />}
      {shown.length === 0 ? (
        <p className="empty center">
          <Icon name="info" />
          {others
            ? t('No catalog item stands the same way.')
            : stacked
              ? t('No catalog item has the same width.')
              : t(
                  'No catalog item has the same width. Switch on “Show other widths” to see the rest.',
                )}
        </p>
      ) : (
        <ul className="template-list replace-list" aria-label={t('Alternatives')}>
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
                    {tr(o.family.name)}: {tr(o.variant.name)}
                  </strong>
                  <span className="sub num">
                    {t('{w} × {h} × {d} mm', { w: o.w, h: o.h, d: o.d })}
                  </span>
                  {!o.sameWidth && <span className="sub">{t('Neighbours may need moving.')}</span>}
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
