import { useMemo, useState } from 'react';
import { t, tr } from '../core/i18n';
import { MOVE_TO_ACTIONS, MOVE_TO_LABELS, moveToOptions, type MoveToAction } from '../core/moveTo';
import { useDesign } from '../store/designStore';

/**
 * The one-tap Move to buttons for a project piece (ADR-147), in the piece panel and over the 3D view in Move mode. An
 * action that cannot move the piece stays tappable but marked off: a tap says why (phones have no hover), and the
 * reason is its title too. Each tap that moves the piece is one undo step.
 */
export function MoveToButtons({ id, className = '' }: { id: string; className?: string }) {
  const project = useDesign((s) => s.project);
  const moveItemTo = useDesign((s) => s.moveItemTo);
  const options = useMemo(() => (project ? moveToOptions(project, id) : null), [project, id]);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  if (!options) return null;
  const tap = (a: MoveToAction) => {
    const off = options[a];
    const text = off ?? moveItemTo(id, a);
    setMsg(text ? { id, text: `${tr(MOVE_TO_LABELS[a].label)}: ${tr(text)}` } : null);
  };
  return (
    <div className={`move-to ${className}`} role="group" aria-label={t('Move to')}>
      <div className="move-to-buttons">
        {MOVE_TO_ACTIONS.map((a) => {
          const off = options[a];
          return (
            <button
              key={a}
              type="button"
              className="btn sm outline"
              aria-disabled={off ? true : undefined}
              title={off ? tr(off) : tr(MOVE_TO_LABELS[a].title)}
              onClick={() => tap(a)}
            >
              {tr(MOVE_TO_LABELS[a].label)}
            </button>
          );
        })}
      </div>
      {msg?.id === id && (
        <p className="hint" role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
