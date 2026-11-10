/**
 * A room's doors, windows, obstacles, pipes and outlets (ADR-058, ADR-072): the list with their sizes and the Add
 * buttons. One component for the project's Room section and Fill the room's Room step (ADR-204), so both stay in step
 * and translated once.
 */
import { newId } from '../core/design';
import { t, tr } from '../core/i18n';
import { DEFAULT_OUTLET_ZONE, DEFAULT_PIPE_ZONE, type Room, type RoomFeature } from '../core/room';
import { MmField, Select } from './controls';

/** Default labels of new room features: stored in the project, so kept in English. */
const FEATURE_KIND: Record<RoomFeature['kind'], string> = {
  door: 'Door',
  window: 'Window',
  obstacle: 'Obstacle',
  pipe: 'Pipe',
  outlet: 'Outlet',
};
const REMOVE_FEATURE: Record<RoomFeature['kind'], string> = {
  door: t('Remove door'),
  window: t('Remove window'),
  obstacle: t('Remove obstacle'),
  pipe: t('Remove pipe'),
  outlet: t('Remove outlet'),
};

/** A new feature of `kind` on `room`, with the starting sizes the room editor has always used. */
export function newFeature(room: Room, kind: RoomFeature['kind']): RoomFeature {
  // The lowest number its kind does not use yet, so no two features share a name (ADR-257).
  const used = new Set(room.features.map((f) => f.label));
  let n = 1;
  while (used.has(`${FEATURE_KIND[kind]} ${n}`)) n++;
  if (kind === 'door')
    return {
      id: newId(),
      kind,
      wall: room.outline.length - 1,
      from: 100,
      width: 800,
      sill: 0,
      height: 2000,
      depth: 0,
      label: `Door ${n}`,
    };
  if (kind === 'window')
    return {
      id: newId(),
      kind,
      wall: 0,
      from: 500,
      width: 1000,
      sill: 900,
      height: 1200,
      depth: 0,
      label: `Window ${n}`,
    };
  if (kind === 'pipe' || kind === 'outlet')
    return {
      // A zone on the wall (ADR-072); default sizes are the ADR's open question, edited here.
      id: newId(),
      kind,
      wall: 0,
      from: kind === 'pipe' ? 200 : 400,
      width: kind === 'pipe' ? DEFAULT_PIPE_ZONE : DEFAULT_OUTLET_ZONE,
      sill: 300,
      height: kind === 'pipe' ? DEFAULT_PIPE_ZONE : DEFAULT_OUTLET_ZONE,
      depth: 0,
      label: `${FEATURE_KIND[kind]} ${n}`,
    };
  return {
    id: newId(),
    kind,
    wall: 0,
    from: 0,
    width: 600,
    sill: 100,
    height: 600,
    depth: 100,
    label: `Obstacle ${n}`,
  };
}

export function RoomFeatures({ room, onChange }: { room: Room; onChange: (room: Room) => void }) {
  const walls = room.outline.map((_, i) => i);
  const addFeature = (kind: RoomFeature['kind']) =>
    onChange({ ...room, features: [...room.features, newFeature(room, kind)] });
  const setFeature = (id: string, patch: Partial<RoomFeature>) =>
    onChange({
      ...room,
      features: room.features.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  return (
    <>
      <h4 className="list-head">{t('Doors, windows, obstacles, pipes and outlets')}</h4>
      {room.features.length === 0 && <p className="hint">{t('None yet.')}</p>}
      {room.features.map((f) => (
        <fieldset key={f.id} className="room-feature" aria-label={tr(f.label)}>
          <legend>{tr(f.label)}</legend>
          <Select
            label={t('On')}
            value={f.wall === null ? 'floor' : String(f.wall)}
            options={[
              ...walls.map((i) => ({
                value: String(i),
                label: t('Wall {n}', { n: i + 1 }),
              })),
              ...(f.kind === 'obstacle' ? [{ value: 'floor', label: t('Free-standing') }] : []),
            ]}
            onChange={(v) =>
              setFeature(f.id, v === 'floor' ? { wall: null, x: 0, z: 0 } : { wall: Number(v) })
            }
          />
          {f.wall === null ? (
            <>
              <MmField
                label={t('From left')}
                value={f.x ?? 0}
                min={-30000}
                max={30000}
                onChange={(v) => setFeature(f.id, { x: v })}
              />
              <MmField
                label={t('From back')}
                value={f.z ?? 0}
                min={-30000}
                max={30000}
                onChange={(v) => setFeature(f.id, { z: v })}
              />
            </>
          ) : (
            <MmField
              label={t("From the wall's start")}
              value={f.from}
              min={0}
              max={30000}
              onChange={(v) => setFeature(f.id, { from: v })}
            />
          )}
          <MmField
            label={t('Width')}
            value={f.width}
            min={10}
            max={30000}
            onChange={(v) => setFeature(f.id, { width: v })}
          />
          {f.kind !== 'door' && (
            <MmField
              label={f.kind === 'window' ? t('Sill height') : t('Bottom above floor')}
              value={f.sill}
              min={0}
              max={10000}
              onChange={(v) => setFeature(f.id, { sill: v })}
            />
          )}
          <MmField
            label={t('Height')}
            value={f.height}
            min={10}
            max={10000}
            onChange={(v) => setFeature(f.id, { height: v })}
          />
          {f.kind === 'obstacle' && (
            <MmField
              label={t('Comes out')}
              value={f.depth}
              min={1}
              max={30000}
              onChange={(v) => setFeature(f.id, { depth: v })}
            />
          )}
          <button
            type="button"
            className="danger-link"
            onClick={() =>
              onChange({ ...room, features: room.features.filter((x) => x.id !== f.id) })
            }
          >
            {REMOVE_FEATURE[f.kind]}
          </button>
        </fieldset>
      ))}
      <div className="split-actions">
        <button type="button" className="btn outline sm" onClick={() => addFeature('door')}>
          {t('Add door')}
        </button>
        <button type="button" className="btn outline sm" onClick={() => addFeature('window')}>
          {t('Add window')}
        </button>
        <button type="button" className="btn outline sm" onClick={() => addFeature('obstacle')}>
          {t('Add obstacle')}
        </button>
        <button type="button" className="btn outline sm" onClick={() => addFeature('pipe')}>
          {t('Add pipe')}
        </button>
        <button type="button" className="btn outline sm" onClick={() => addFeature('outlet')}>
          {t('Add outlet')}
        </button>
      </div>
    </>
  );
}
