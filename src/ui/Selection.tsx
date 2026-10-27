import { useState } from 'react';
import { pieceName } from '../core/project';
import { groupOf, sameIds } from '../core/selection';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip } from './controls';
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
      aria-label={`${ids.length} pieces selected${isGroup ? `: ${g!.name}` : ''}`}
    >
      <div className="card-title">
        <span className="info-row">
          <span>{isGroup ? g!.name : 'Selected pieces'}</span>
          <InfoTip label="About the selected pieces" align="start">
            These act on all {ids.length}; drag any of them on the plan to move them together.
          </InfoTip>
        </span>
        <span className="chip">{ids.length} pieces</span>
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
          Duplicate
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-label="Turn the selection 90° anticlockwise about its centre"
          onClick={() => say(turn(1))}
        >
          Turn 90° ↺
        </button>
        <button
          type="button"
          className="btn outline sm"
          aria-label="Turn the selection 90° clockwise about its centre"
          onClick={() => say(turn(-1))}
        >
          Turn 90° ↻
        </button>
        {/* Mirror left–right about the selection's centre (ADR-121); one undo step. */}
        {pieceIds.length >= 2 && (
          <button
            type="button"
            className="btn outline sm"
            aria-label="Mirror the selection left to right"
            onClick={() => say(mirror() || null)}
          >
            Mirror
          </button>
        )}
        {isGroup ? (
          <button type="button" className="btn outline sm" onClick={() => ungroup(g!.id)}>
            Ungroup
          </button>
        ) : (
          <button type="button" className="btn outline sm" onClick={() => group()}>
            Group
          </button>
        )}
        <button
          type="button"
          className="btn outline sm danger"
          onClick={async () => {
            if (
              await askConfirm(`Delete these ${ids.length} pieces from this project?`, {
                confirmLabel: 'Delete',
                danger: true,
              })
            )
              del();
          }}
        >
          Delete
        </button>
        <button type="button" className="btn ghost sm" onClick={() => clear(null)}>
          Clear selection
        </button>
      </div>
      {/* Align to the first selected piece and distribute along the wall (ADR-099); each is one undo step. */}
      {pieceIds.length >= 2 && (
        <div className="align-actions" role="group" aria-label="Align to the first selected piece">
          <span className="hint">Align to {pieceName(project, pieceIds[0])}:</span>
          {(
            [
              ['left', 'Left'],
              ['centre', 'Centre'],
              ['right', 'Right'],
              ['back', 'Back'],
              ['front', 'Front'],
            ] as const
          ).map(([how, label]) => (
            <button
              key={how}
              type="button"
              className="btn outline sm"
              aria-label={`Align ${label.toLowerCase()}`}
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
              Distribute evenly
            </button>
          )}
        </div>
      )}
      {msg.for === key && msg.text && (
        <p className="hint" role="status">
          {msg.text}
        </p>
      )}
    </section>
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
    <section className="groups section" aria-label="Groups">
      <div className="card-title">
        <span>Groups</span>
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
                  <span className="sub">
                    {g.itemIds.length} {g.itemIds.length === 1 ? 'piece' : 'pieces'}
                  </span>
                </span>
                <Icon name="chevron-right" className="chev sm" />
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={`Ungroup ${g.name}`}
                onClick={() => ungroup(g.id)}
              >
                Ungroup
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
