import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { t } from '../core/i18n';
import { floorRect, wallBands, type FloorFinish, type Room, type WallFinish } from '../core/room';
import { newPlanPicture, planPictureRect, planScale, type PlanPicture } from '../core/planPicture';
import { topBoard } from '../core/roomSurfaces';
import type { PlacedPiece } from '../core/project';
import type { Material } from '../core/types';
import { loadImage } from '../store/libraryStore';
import { importImage } from '../persist/images';
import { imageKey, useImageUrls } from './useImageUrls';
import { useDesign } from '../store/designStore';
import { MmField, Select, Toggle } from './controls';
import { askConfirm } from './Confirm';
import { Icon } from './icons';
import { pictureKey, useWallPictureUrls } from './wallPictures';

/**
 * Room surfaces on the plan (ADR-208): the plan picture to trace over (G-012), the floor background (G-274), the
 * walls' colour bands (G-273) and the pieces' board pictures (G-413), with their controls in Room. Every place and
 * size comes from the core (`planPicture.ts`, `room.ts`, `roomSurfaces.ts`); this file only draws them.
 */

/** A stored picture's pixel size, read once per id from this device; null while unknown or missing. */
export function usePictureSize(id: string | undefined): { w: number; h: number } | null {
  const [size, setSize] = useState<{ id: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    loadImage(id)
      .then((r) => live && r && setSize({ id, w: r.width, h: r.height }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id]);
  return size && size.id === id ? { w: size.w, h: size.h } : null;
}

/** Where the plan picture lies on the plan (room mm), or null without one, while hidden or not on this device. */
export function usePlanPictureRect(pp: PlanPicture | undefined) {
  const size = usePictureSize(pp?.id);
  return useMemo(
    () => (pp && size && planScale(pp) > 0 ? planPictureRect(pp, size.w, size.h) : null),
    [pp, size],
  );
}

/** The plan picture, under everything at half opacity (ADR-208); the first scale tap is marked. */
export function PlanPictureLayer({
  pp,
  rect,
  taps,
  fs,
}: {
  pp: PlanPicture;
  rect: { x: number; z: number; w: number; d: number } | null;
  taps: [number, number][] | null;
  fs: number;
}) {
  const urls = useImageUrls(pp.id);
  const url = urls.get(pp.id);
  const s = planScale(pp);
  return (
    <g className="plan-picture-layer" aria-hidden="true">
      {!pp.hidden && rect && url && url !== 'missing' && (
        <image
          className="plan-picture"
          role="img"
          aria-label={t('Plan picture on the plan')}
          href={url}
          x={rect.x}
          y={rect.z}
          width={rect.w}
          height={rect.d}
          opacity={0.5}
          preserveAspectRatio="none"
        />
      )}
      {taps?.map(([px, py], i) => (
        <circle
          key={i}
          className="scale-tap"
          cx={(px - pp.a[0]) * s}
          cy={(py - pp.a[1]) * s}
          r={fs * 0.4}
        />
      ))}
    </g>
  );
}

/** The floor's colour or picture inside the room outline, under the pieces (ADR-208). */
export function FloorFill({ room }: { room: Room }) {
  const f = room.floor;
  const finishes = useMemo<WallFinish[]>(() => (f ? [{ wall: 0, ...f }] : []), [f]);
  const urls = useWallPictureUrls(finishes);
  const clip = `${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-floor`;
  if (!f) return null;
  const points = room.outline.map((p) => p.join(',')).join(' ');
  const url = f.image ? urls.get(pictureKey(f.image)) : undefined;
  const r = f.image ? floorRect(room, f.image) : null;
  return (
    <g className="room-floor-finish" role="img" aria-label={t('Floor finish')} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <polygon points={points} />
        </clipPath>
      </defs>
      <polygon points={points} style={{ fill: f.colour }} />
      {r && url && url !== 'missing' && (
        <image
          href={url}
          x={r.x}
          y={r.z}
          width={r.w}
          height={r.d}
          clipPath={`url(#${clip})`}
          preserveAspectRatio="none"
        />
      )}
    </g>
  );
}

/** A 50 mm band inside each wall with a background, in its colour (ADR-208). */
export function WallBands({ room }: { room: Room }) {
  const bands = useMemo(() => wallBands(room), [room]);
  if (!bands.length) return null;
  return (
    <g className="wall-bands" role="img" aria-label={t('Wall background bands')} aria-hidden="true">
      {bands.map((b) => (
        <rect
          key={b.wall}
          className="wall-band"
          x={b.box.x}
          y={b.box.z}
          width={b.box.w}
          height={b.box.d}
          style={{ fill: b.colour }}
        />
      ))}
    </g>
  );
}

/**
 * The board pictures of the pieces seen from above (ADR-208): one pattern per board with a picture, at its tile size.
 * Returns the patterns and the fill of each piece (undefined = the plan's usual fill).
 */
export function useBoardFills(pieces: PlacedPiece[]) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tops = useMemo(
    () =>
      new Map(
        pieces.flatMap((pc) => {
          const m = topBoard(pc);
          return m?.image ? [[pc.item.id, m] as const] : [];
        }),
      ),
    [pieces],
  );
  const boards = useMemo(() => {
    const seen = new Map<string, Material>();
    for (const m of tops.values()) if (m.image) seen.set(m.image.id, m);
    return [...seen.values()];
  }, [tops]);
  const urls = useImageUrls(imageKey(boards));
  const patId = (imgId: string) => `${uid}-board-${imgId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const defs = (
    <defs>
      {boards.map((m) => {
        const url = urls.get(m.image!.id);
        if (!url || url === 'missing') return null;
        const { tileLength: L, tileWidth: W } = m.image!;
        return (
          <pattern
            key={m.image!.id}
            id={patId(m.image!.id)}
            patternUnits="userSpaceOnUse"
            width={L}
            height={W}
          >
            <image href={url} width={L} height={W} preserveAspectRatio="none" />
          </pattern>
        );
      })}
    </defs>
  );
  const fillOf = (id: string): string | undefined => {
    const m = tops.get(id);
    const url = m?.image ? urls.get(m.image.id) : undefined;
    return m?.image && url && url !== 'missing' ? `url(#${patId(m.image.id)})` : undefined;
  };
  return { defs, fillOf };
}

/** Starting floor colour: the plan's light floor grey. */
const FLOOR_GREY = '#d9dcd6';

/** Room → Floor background (ADR-208): None, Colour or Picture, as a wall's (ADR-145). */
export function FloorBackground({ room }: { room: Room }) {
  const setRoom = useDesign((s) => s.setRoom);
  const f = room.floor;
  const img = f?.image;
  const urls = useImageUrls(img?.id ?? '');
  const url = img ? urls.get(img.id) : undefined;
  const [wantPicture, setWantPicture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const op = useRef(0);
  const kind = img || wantPicture ? 'picture' : f ? 'colour' : 'none';
  /** Applied to the room as it is now, never one captured before a picture was prepared. */
  const apply = (next: FloorFinish | undefined) => {
    const now = useDesign.getState().project?.room;
    if (!now) return;
    const { floor: _f, ...rest } = now;
    void _f;
    setRoom(next ? { ...rest, floor: next } : rest);
  };
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const token = ++op.current;
    setBusy(true);
    setProblem(null);
    const r = await importImage(file);
    if (token !== op.current) return;
    setBusy(false);
    if (!r.ok) return setProblem(r.problem);
    apply({ colour: r.color, image: { id: r.image.id, name: r.image.name } });
  };
  return (
    <div className="wall-bg floor-bg">
      <Select
        label={t('Floor background')}
        value={kind}
        options={[
          { value: 'none', label: t('None') },
          { value: 'colour', label: t('Colour') },
          { value: 'picture', label: t('Picture') },
        ]}
        onChange={(v) => {
          op.current++;
          setBusy(false);
          setProblem(null);
          setWantPicture(v === 'picture');
          if (v === 'none') apply(undefined);
          else if (v === 'colour') apply({ colour: f?.colour ?? FLOOR_GREY });
        }}
      />
      {kind === 'colour' && f && (
        <label className="wall-colour">
          <span>{t('Colour')}</span>
          <input
            type="color"
            aria-label={t('Floor colour')}
            value={f.colour}
            onChange={(e) => apply({ colour: e.target.value })}
          />
        </label>
      )}
      {kind === 'picture' && (
        <div className="mat-picture-row">
          {img && url && url !== 'missing' && (
            <img className="mat-thumb" src={url} alt={t('Picture on the floor')} />
          )}
          <label className={`btn sm outline file-btn${busy ? ' disabled' : ''}`}>
            <Icon name="upload" className="sm" />
            {busy ? t('Preparing picture…') : img ? t('Replace picture') : t('Add a picture')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              aria-label={t('Add a picture for the floor')}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {img && <span className="hint">{img.name}</span>}
        </div>
      )}
      {problem && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{problem}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Room → Plan picture (ADR-208, G-012): add a picture of the floor plan, set its scale from two taps and a known
 * length, show or hide it, remove it. The picture stays in the `images` table; the project keeps the reference.
 */
export function PlanPictureSection() {
  const pp = useDesign((s) => s.project?.planPicture);
  const updateProject = useDesign((s) => s.updateProject);
  const startScale = useDesign((s) => s.startScalePlan);
  const scaling = useDesign((s) => !!s.scalingPlan);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (next: PlanPicture | undefined) =>
    updateProject((p) => {
      const { planPicture: _pp, ...rest } = p;
      void _pp;
      return next ? { ...rest, planPicture: next } : rest;
    });
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await importImage(file);
    setBusy(false);
    if (!r.ok) return setProblem(r.problem);
    const row = await loadImage(r.image.id).catch(() => undefined);
    set(newPlanPicture(r.image.id, r.image.name, row?.width ?? 1000));
  };
  return (
    <section className="plan-picture-section" aria-label={t('Plan picture')}>
      <h4 className="list-head">{t('Plan picture')}</h4>
      {!pp ? (
        <label className={`btn outline file-btn${busy ? ' disabled' : ''}`}>
          <Icon name="upload" className="sm" />
          {busy ? t('Preparing picture…') : t('Add a plan picture')}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            aria-label={t('Add a plan picture')}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <>
          <p className="hint">{pp.name}</p>
          <button
            type="button"
            className="btn outline sm"
            aria-pressed={scaling}
            onClick={startScale}
          >
            {t('Set the scale')}
          </button>
          <p className="hint">
            {t('Tap a corner of the plan, then the other end of a wall you know.')}
          </p>
          <MmField
            label={t('Known length')}
            value={pp.length}
            min={1}
            max={100000}
            step={1}
            onChange={(v) => set({ ...pp, length: v })}
          />
          <Toggle
            label={t('Show the plan picture')}
            checked={!pp.hidden}
            onChange={(on) => {
              const { hidden: _h, ...rest } = pp;
              void _h;
              set(on ? rest : { ...rest, hidden: true });
            }}
          />
          <button
            type="button"
            className="danger-link"
            onClick={async () => {
              if (
                await askConfirm(t('Remove the plan picture? The room stays.'), {
                  confirmLabel: t('Remove'),
                  danger: true,
                })
              )
                set(undefined);
            }}
          >
            {t('Remove the plan picture')}
          </button>
        </>
      )}
      {problem && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{problem}</span>
        </p>
      )}
    </section>
  );
}
