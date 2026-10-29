import { useMemo, useState } from 'react';
import { groupSizeFields, type WidthSplit } from '../core/groupSize';
import { t, tr } from '../core/i18n';
import { pieceName, type Project } from '../core/project';
import { groupOf, sameIds, type Group } from '../core/selection';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip, MmField, Segmented } from './controls';
import { Icon } from './icons';

/**
 * Several pieces selected (ADR-097): what acts on the whole selection — Delete, Duplicate, Turn about its centre,
 * Group or Ungroup. Each is one undo step; the main piece's card follows below for what is one piece's.
 */
export function SelectionCard() {
  const ids = useDesign((s) => s.selectedItemIds);
  const project = useDesign((s) => s.project);
  const del = useDesign((s) => s.deleteSelection);
  const dup = useDesign((s) => s.duplicateSelection);
  const turn = useDesign((s) => s.turnSelectionBy);
  const mirror = useDesign((s) => s.mirrorSelection);
  const group = useDesign((s) => s.groupSelection);
  const ungroup = useDesign((s) => s.ungroup);
  const clear = useDesign((s) => s.selectItem);
  const align = useDesign((s) => s.alignSelection);
  const distribute = useDesign((s) => s.distributeSelection);
  const [msg, setMsg] = useState<{ for: string; text: string | null }>({ for: '', text: null });
  if (!project || ids.length < 2) return null;
  const key = ids.join(',');
  // Align and distribute act on the pieces (3D models are display only, ADR-076), to the first selected piece.
  const pieceIds = ids.filter((id) => project.items.some((i) => i.id === id));
  const g = groupOf(project, ids[0]);
  const isGroup = !!g && sameIds(g.itemIds, ids);
  const say = (text: string | null) => setMsg({ for: key, text });
  return (
    <section
      className="selection-card section"
      aria-label={`${t('{n} pieces selected', { n: ids.length })}${isGroup ? `: ${g!.name}` : ''}`}
    >
      <div className="card-title">
        <span className="info-row">
          <span>{isGroup ? g!.name : t('Selected pieces')}</span>
          <InfoTip label={t('About the selected pieces')} align="start">
            {t('These act on all {n}; drag any of them on the plan to move them together.', {
              n: ids.length,
            })}
            {isGroup &&
              t(' The pieces of a group always move together; ungroup to move one alone.')}
          </InfoTip>
        </span>
        <span className="chip">{t('{n} pieces', { n: ids.length })}</span>
      </div>
      <div className="arrange-actions">
        <button
          type="button"
          className="btn outline sm"
          onClick={() => {
            say(null);
            dup();
          }}
        >
          {t('Duplicate')}
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-label={t('Turn the selection 90° anticlockwise about its centre')}
          onClick={() => say(turn(1))}
        >
          {t('Turn 90° ↺')}
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-label={t('Turn the selection 90° clockwise about its centre')}
          onClick={() => say(turn(-1))}
        >
          {t('Turn 90° ↻')}
        </button>
        {/* Mirror left–right about the selection's centre (ADR-121); one undo step. */}
        {pieceIds.length >= 2 && (
          <button
            type="button"
            className="btn outline sm"
            aria-label={t('Mirror the selection left to right')}
            onClick={() => say(mirror() || null)}
          >
            {t('Mirror')}
          </button>
        )}
        {isGroup ? (
          <button type="button" className="btn outline sm" onClick={() => ungroup(g!.id)}>
            {t('Ungroup')}
          </button>
        ) : (
          <button type="button" className="btn outline sm" onClick={() => group()}>
            {t('Group')}
          </button>
        )}
        <button
          type="button"
          className="btn outline sm danger"
          onClick={async () => {
            if (
              await askConfirm(t('Delete these {n} pieces from this project?', { n: ids.length }), {
                confirmLabel: t('Delete'),
                danger: true,
              })
            )
              del();
          }}
        >
          {t('Delete')}
        </button>
        <button type="button" className="btn ghost sm" onClick={() => clear(null)}>
          {t('Clear selection')}
        </button>
      </div>
      {/* Align to the first selected piece and distribute along the wall (ADR-099); each is one undo step. */}
      {pieceIds.length >= 2 && (
        <div
          className="align-actions"
          role="group"
          aria-label={t('Align to the first selected piece')}
        >
          <span className="hint">
            {t('Align to {name}:', { name: tr(pieceName(project, pieceIds[0])) })}
          </span>
          {(
            [
              ['left', t('Left'), t('Align left')],
              ['centre', t('Centre'), t('Align centre')],
              ['right', t('Right'), t('Align right')],
              ['back', t('Back@@side'), t('Align back')],
              ['front', t('Front@@side'), t('Align front')],
              ['top', t('Top@@side'), t('Align top')],
              ['bottom', t('Bottom'), t('Align bottom')],
            ] as const
          ).map(([how, label, name]) => (
            <button
              key={how}
              type="button"
              className="btn outline sm"
              aria-label={name}
              onClick={() => say(align(how) || null)}
            >
              {label}
            </button>
          ))}
          {pieceIds.length >= 3 && (
            <button
              type="button"
              className="btn outline sm"
              onClick={() => say(distribute() || null)}
            >
              {t('Distribute evenly')}
            </button>
          )}
        </div>
      )}
      {isGroup && <GroupSize project={project} group={g!} say={say} />}
      {msg.for === key && msg.text && (
        <p className="hint" role="status">
          {msg.text}
        </p>
      )}
    </section>
  );
}

/**
 * The size of a whole group (ADR-148): Width along the wall, shared by the columns Proportionally or Equally; Height
 * and Depth set on every piece. Each change is one undo step; why nothing changed, or which pieces kept their size,
 * goes to the card's message.
 */
function GroupSize({
  project,
  group,
  say,
}: {
  project: Project;
  group: Group;
  say: (text: string | null) => void;
}) {
  const resize = useDesign((s) => s.resizeGroup);
  const [split, setSplit] = useState<WidthSplit>('proportional');
  const fields = useMemo(() => groupSizeFields(project, group.itemIds), [project, group.itemIds]);
  return (
    <div className="group-size" role="group" aria-label={t('Size of the group')}>
      <span className="field-label">{t('Size of the group')}</span>
      <div className={fields.length === 3 ? 'dims3' : 'dims2'}>
        {fields.map((f) => (
          <MmField
            key={f.key}
            label={tr(f.label)}
            value={f.value}
            min={1}
            max={20000}
            hint={f.differs ? t('Pieces differ') : undefined}
            onChange={(v) => say(resize(group.id, f.key, v, split) || null)}
          />
        ))}
      </div>
      <Segmented<WidthSplit>
        label={t('Split width')}
        value={split}
        options={[
          {
            value: 'proportional',
            label: t('Proportionally'),
            title: t('Each column by its share of the width'),
          },
          { value: 'equal', label: t('Equally'), title: t('The same for each column') },
        ]}
        onChange={setSplit}
      />
    </div>
  );
}

/** The project's groups (ADR-097): select one, or ungroup it. */
export function GroupList() {
  const groups = useDesign((s) => s.project?.groups);
  const ids = useDesign((s) => s.selectedItemIds);
  const selectItems = useDesign((s) => s.selectItems);
  const ungroup = useDesign((s) => s.ungroup);
  if (!groups?.length) return null;
  return (
    <section className="groups section" aria-label={t('Groups')}>
      <div className="card-title">
        <span>{t('Groups')}</span>
      </div>
      <ul className="pieces">
        {groups.map((g) => {
          const on = sameIds(ids, g.itemIds);
          return (
            <li key={g.id} className="group-row">
              <button
                type="button"
                className={`row-btn ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => selectItems(g.itemIds)}
              >
                <span>
                  <strong>{g.name}</strong>
                  <span className="sub">{t('{n|# piece|# pieces}', { n: g.itemIds.length })}</span>
                </span>
                <Icon name="chevron-right" className="chev sm" />
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={t('Ungroup {name}', { name: g.name })}
                onClick={() => ungroup(g.id)}
              >
                {t('Ungroup')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
