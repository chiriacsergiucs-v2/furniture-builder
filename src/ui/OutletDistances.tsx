/**
 * The outlet distances the user sets on the room (ADR-299): how far an outlet must stay from a sink, a hob or a pipe,
 * by their own rule. Each field may stay empty (no check); the app has no built-in distance and quotes no regulation
 * (ADR-010). A whole number of 1 mm or more is saved; anything else is marked at the field and not saved (ADR-008).
 */
import { useId, useState } from 'react';
import { t } from '@furniture-builder/i18n';
import type { OutletDistances, Room } from '../core/room';

function DistanceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const id = useId();
  const shown = value === undefined ? '' : String(value);
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  // Changed from outside (undo): show it. Adjusting state during render, as MmField does.
  if (seen !== shown) {
    setSeen(shown);
    setText(shown);
  }
  const trimmed = text.trim();
  const parsed = Number(trimmed);
  const valid = trimmed === '' || (Number.isInteger(parsed) && parsed >= 1);
  const commit = () => {
    const next = trimmed === '' ? undefined : parsed;
    if (valid && next !== value) onChange(next);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm ${valid ? '' : 'invalid'}`}>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          placeholder={t('No check')}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : `${id}-err`}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,-]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setText(shown);
          }}
        />
        <span className="unit">{t('mm')}</span>
      </div>
      {!valid && (
        <p className="field-error" id={`${id}-err`}>
          {t('A whole number of 1 mm or more, or empty for no check.')}
        </p>
      )}
    </div>
  );
}

export function OutletDistanceFields({
  room,
  onChange,
}: {
  room: Room;
  onChange: (room: Room) => void;
}) {
  const rule = room.outletDistances ?? {};
  const set = (k: keyof OutletDistances, v: number | undefined) => {
    const next: OutletDistances = { ...rule };
    if (v === undefined) delete next[k];
    else next[k] = v;
    const { outletDistances: _old, ...rest } = room;
    void _old;
    onChange(Object.keys(next).length ? { ...rest, outletDistances: next } : rest);
  };
  return (
    <>
      <h4 className="list-head">{t('Outlet distances (your rule)')}</h4>
      <p className="hint">
        {t(
          'Your own rule: an outlet nearer than this gives a warning. Empty = no check; the app has no built-in distances.',
        )}
      </p>
      <DistanceField
        label={t('Outlet to a sink')}
        value={rule.sink}
        onChange={(v) => set('sink', v)}
      />
      <DistanceField
        label={t('Outlet to a hob')}
        value={rule.hob}
        onChange={(v) => set('hob', v)}
      />
      <DistanceField
        label={t('Outlet to a pipe')}
        value={rule.pipe}
        onChange={(v) => set('pipe', v)}
      />
    </>
  );
}
