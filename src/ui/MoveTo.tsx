import { useEffect, useMemo, useRef, useState } from 'react';
import { t, tr } from '../core/i18n';
import { MOVE_TO_ACTIONS, MOVE_TO_LABELS, moveToOptions, type MoveToAction } from '../core/moveTo';
import { useDesign } from '../store/designStore';

/**
 * The one-tap Move to buttons for a project piece (ADR-147), or for several selected pieces moved as one block
 * (ADR-182, `id` a list), in the side panel and over the 3D view in Move mode. An action that cannot move the piece
 * stays tappable but marked off: a tap says why (phones have no hover), and the reason is its title too. Each tap that moves the piece is one undo step. In the side panel (`onlyWorking`, ADR-160)
 * only the actions that work now are buttons; the others fold under "N more are off" with their reasons.
 */
export function MoveToButtons({
  id,
  className = '',
  onlyWorking = false,
}: {
  id: string | readonly string[];
  className?: string;
  onlyWorking?: boolean;
}) {
  const project = useDesign((s) => s.project);
  const moveItemTo = useDesign((s) => s.moveItemTo);
  const options = useMemo(() => (project ? moveToOptions(project, id) : null), [project, id]);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const key = typeof id === 'string' ? id : id.join(',');
  // After a tap the tapped button may leave the list (it no longer works): focus stays in the group, on its first
  // button or else on the group itself, never on the page body (ADR-250).
  const box = useRef<HTMLDivElement>(null);
  const [tapped, setTapped] = useState(0);
  useEffect(() => {
    if (!tapped) return;
    const el = box.current;
    if (!el || el.contains(document.activeElement)) return;
    (el.querySelector<HTMLElement>('.move-to-buttons button') ?? el).focus();
  }, [tapped]);
  if (!options) return null;
  const off = MOVE_TO_ACTIONS.filter((a) => options[a]);
  const tap = (a: MoveToAction) => {
    const off = options[a];
    const text = off ?? moveItemTo(id, a);
    setMsg(text ? { id: key, text: `${tr(MOVE_TO_LABELS[a].label)}: ${tr(text)}` } : null);
    setTapped((n) => n + 1);
  };
  return (
    <div
      ref={box}
      tabIndex={-1}
      className={`move-to ${className}`}
      role="group"
      aria-label={t('Move to')}
    >
      <div className="move-to-buttons">
        {(onlyWorking ? MOVE_TO_ACTIONS.filter((a) => !options[a]) : MOVE_TO_ACTIONS).map((a) => {
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
      {onlyWorking && off.length > 0 && (
        <details className="move-to-off">
          <summary>{t('{n|# more is off|# more are off}', { n: off.length })}</summary>
          <ul>
            {off.map((a) => (
              <li key={a}>
                <strong>{tr(MOVE_TO_LABELS[a].label)}</strong>: {tr(options[a]!)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {msg?.id === key && (
        <p className="hint" role="status">
          {msg.text}
        </p>
      )}
    </div>
  );
}
