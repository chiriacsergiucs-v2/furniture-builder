import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  makeModelItem,
  modelYaw,
  MODEL_SIDE_MAX,
  resizeModel,
  type ModelFront,
  type ModelItem,
  type ModelTurn,
} from '../core/model3d';
import { newId } from '../core/design';
import { frontEdge } from '../core/geometry';
import { t, tr } from '../core/i18n';
import { PROJECT_SCHEMA, type ProjectModel } from '../core/project';
import type { Box } from '../core/types';
import { deleteModelIfUnused, listModels, loadModel, type StoredModel } from '../persist/db';
import { forgetModelScene, importModelFile } from '../persist/models';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip, MmField, Segmented, Select, Toggle } from './controls';
import { useKeepProportions } from './keepProportions';
import { Icon } from './icons';
import {
  arrowMove,
  movePointer,
  pressPiece,
  releasePointer,
  type DragGesture,
  type PointerAt,
} from './planDrag';
import { useSnap } from './useSnap';
import { modelDrop } from '../core/modelPlace';
import { placementBases } from '../core/project';
import type { ModelPlacement } from '../core/model3d';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Display-only 3D models in a project (ADR-076): the library under Add a piece → My 3D models, the selected model's
 * fields, and its labelled box on the plan and in the front view. Boxes come from `buildProjectModel` (ADR-004).
 */

const FRONTS: { value: ModelFront; label: string }[] = [
  { value: 'front', label: t('Front@@side') },
  { value: 'right', label: t('Right') },
  // 'Back' is also the back panel and the Back button; the side of a model needs its own word in Russian.
  { value: 'back', label: t('Back@@side') },
  { value: 'left', label: t('Left') },
];

/** Change one model item of the open project (one undo step). */
function usePatchModel() {
  const updateProject = useDesign((s) => s.updateProject);
  return (id: string, patch: Partial<ModelItem>) =>
    updateProject((p) => ({
      ...p,
      models: (p.models ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
}

/** The selected model's fields in Compose. */
export function ModelFields({ item }: { item: ModelItem }) {
  const patch = usePatchModel();
  const updateProject = useDesign((s) => s.updateProject);
  const select = useDesign((s) => s.selectItem);
  const [missing, setMissing] = useState(false);
  // The stored model's own size, for Reset size (ADR-102).
  const [natural, setNatural] = useState<StoredModel['size'] | null>(null);
  const [keep, setKeep] = useKeepProportions(item.id);
  useEffect(() => {
    let live = true;
    loadModel(item.modelId)
      .then((r) => {
        if (!live) return;
        setMissing(!r);
        setNatural(r?.size ?? null);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
  }, [item.modelId]);
  const pos = item.position;
  return (
    <section
      className="piece-edit section"
      aria-label={t('Selected 3D model: {name}', { name: item.name })}
    >
      <div className="card-title">
        <span className="info-row">
          <span>{t('Selected 3D model')}</span>
          <InfoTip label={t('About 3D models')} align="start">
            {t(
              'Display only: never in the parts list, sheets, costs or shopping list. Its box is checked against the pieces and the room.',
            )}
          </InfoTip>
        </span>
      </div>
      <h3>{item.name}</h3>
      {missing && (
        <p className="hint" role="status">
          {t('This 3D model is not on this device; it is drawn as a box.')}
        </p>
      )}
      <div className="dims3">
        {(
          [
            ['w', t('Width')],
            ['h', t('Height')],
            ['d', t('Depth')],
          ] as const
        ).map(([side, label]) => (
          <MmField
            key={side}
            label={label}
            value={item.size[side]}
            min={1}
            max={MODEL_SIDE_MAX}
            onChange={(v) => patch(item.id, { size: resizeModel(item.size, side, v, keep) })}
          />
        ))}
      </div>
      <Toggle
        label={t('Keep proportions')}
        checked={keep}
        onChange={setKeep}
        info={
          <InfoTip label={t('About keep proportions')} align="start">
            {keep
              ? t('Changing one side scales the other two with it.')
              : t('Each side changes on its own; the model stretches to fill its box.')}
          </InfoTip>
        }
      />
      {natural &&
        (natural.w !== item.size.w || natural.h !== item.size.h || natural.d !== item.size.d) && (
          <button
            type="button"
            className="btn sm outline"
            onClick={() => patch(item.id, { size: { ...natural } })}
          >
            {t('Reset size')}
          </button>
        )}
      <Segmented<ModelTurn>
        label={t('Turn')}
        value={item.rotationY}
        options={[
          { value: 0, label: '0°' },
          { value: 90, label: '90°' },
          { value: 180, label: '180°' },
          { value: 270, label: '270°' },
        ]}
        onChange={(v) => patch(item.id, { rotationY: v })}
      />
      <Segmented<ModelFront>
        label={t('Front faces')}
        value={item.front ?? 'front'}
        options={FRONTS}
        onChange={(v) => patch(item.id, v === 'front' ? { front: undefined } : { front: v })}
        info={
          <InfoTip label={t('About front faces')} align="start">
            {t('The side of the model that is its front, if it came in facing the wrong way.')}
          </InfoTip>
        }
      />
      <ModelPlacementFields item={item} />
      <div className="dims3">
        <MmField
          label={t('From left')}
          value={pos.x}
          min={-20000}
          max={20000}
          onChange={(v) => patch(item.id, { position: { ...pos, x: v } })}
        />
        <MmField
          label={t('From back')}
          value={pos.z}
          min={-20000}
          max={20000}
          onChange={(v) => patch(item.id, { position: { ...pos, z: v } })}
        />
        {!item.placement && (
          <MmField
            label={t('Height above floor')}
            value={pos.y}
            min={0}
            max={5000}
            onChange={(v) => patch(item.id, { position: { ...pos, y: v } })}
          />
        )}
      </div>
      <button
        type="button"
        className="danger-link"
        onClick={async () => {
          if (
            await askConfirm(t('Remove “{name}” from this project?', { name: item.name }), {
              confirmLabel: t('Remove'),
              danger: true,
            })
          ) {
            select(null);
            updateProject((p) => ({
              ...p,
              models: (p.models ?? []).filter((m) => m.id !== item.id),
            }));
          }
        }}
      >
        {t('Remove from project')}
      </button>
    </section>
  );
}

type ModelPlacementKind = ModelPlacement['kind'] | 'free';

/**
 * A model's placement (ADR-208), the same control as a piece's (ADR-031): on the floor, on the wall at a height, on a
 * piece (never on another model), or anywhere. `resolvePlacements` keeps its height in line.
 */
function ModelPlacementFields({ item }: { item: ModelItem }) {
  const project = useDesign((s) => s.project)!;
  const patch = usePatchModel();
  // Every piece can carry a model; a model is never a base (ADR-208).
  const bases = useMemo(() => placementBases(project, ''), [project]);
  const pl = item.placement;
  const set = (placement: ModelPlacement | undefined) => {
    const { placement: _p, ...rest } = item;
    void _p;
    patch(item.id, placement ? { ...rest, placement } : { ...rest, placement: undefined });
  };
  const choose = (k: ModelPlacementKind) => {
    if (k === 'free') set(undefined);
    else if (k === 'floor') set({ kind: 'floor' });
    else if (k === 'wall')
      set({ kind: 'wall', height: item.position.y > 0 ? item.position.y : 1450 });
    else if (bases.length) set({ kind: 'above', baseId: bases[0].id, gap: 0, offsetX: 0 });
  };
  return (
    <>
      <Segmented<ModelPlacementKind>
        label={t('Placed')}
        value={pl?.kind ?? 'free'}
        onChange={choose}
        options={[
          { value: 'floor', label: t('Floor'), title: t('Stands on the floor') },
          { value: 'wall', label: t('Wall'), title: t('Hung on the wall at a height') },
          ...(bases.length
            ? [
                {
                  value: 'above' as const,
                  label: t('On a piece'),
                  title: t('Stands on, or hangs above, another piece and follows it'),
                },
              ]
            : []),
          { value: 'free', label: t('Anywhere'), title: t('Set all three distances yourself') },
        ]}
      />
      {pl?.kind === 'wall' && (
        <MmField
          label={t('Underside above the floor')}
          value={pl.height}
          min={0}
          max={5000}
          onChange={(v) => set({ ...pl, height: v })}
        />
      )}
      {pl?.kind === 'above' && (
        <>
          <Select
            label={t('On or above')}
            value={pl.baseId}
            options={bases.map((b) => ({ value: b.id, label: tr(b.design.name) }))}
            onChange={(v) => set({ ...pl, baseId: v })}
          />
          <div className="dims2">
            <MmField
              label={t('Gap above it')}
              value={pl.gap}
              min={0}
              max={3000}
              onChange={(v) => set({ ...pl, gap: v })}
              hint={t('0 = stands on it')}
            />
            <MmField
              label={t('From its left edge')}
              value={pl.offsetX}
              min={-5000}
              max={5000}
              onChange={(v) => set({ ...pl, offsetX: v })}
            />
          </div>
        </>
      )}
    </>
  );
}

/** The project's 3D models, listed under its pieces. */
export function ModelList({ pm }: { pm: ProjectModel | null }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  if (!pm?.models.length) return null;
  return (
    <>
      <h3 className="list-head">{t('3D models (display only)')}</h3>
      <ul className="pieces">
        {pm.models.map(({ item, box }) => (
          <li key={item.id}>
            <button
              type="button"
              className={`row-btn ${item.id === selectedId ? 'on' : ''}`}
              aria-pressed={item.id === selectedId}
              onClick={() => select(item.id)}
            >
              <span>
                <strong>{item.name}</strong>
                <span className="sub num">
                  {box.w} × {box.h} × {box.d} {t('mm')}
                </span>
              </span>
              <Icon name="chevron-right" className="chev sm" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Object URLs for the thumbnails of the listed models, freed when the list changes. */
function useThumbs(rows: StoredModel[]): Map<string, string> {
  const urls = useMemo(
    () =>
      new Map(
        rows.flatMap((r) =>
          r.thumb
            ? [[r.id, URL.createObjectURL(new Blob([r.thumb], { type: 'image/png' }))] as const]
            : [],
        ),
      ),
    [rows],
  );
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

/** Add a piece → My 3D models: import files from the device, add one to the project, delete unused ones. */
export function MyModels({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<StoredModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<{ ok: boolean; text: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const updateProject = useDesign((s) => s.updateProject);
  const select = useDesign((s) => s.selectItem);
  const thumbs = useThumbs(rows);
  const refresh = () =>
    listModels()
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    void refresh();
  }, []);

  const importFiles = async (files: File[]) => {
    setBusy(true);
    const out: { ok: boolean; text: string }[] = [];
    for (const f of files) {
      const r = await importModelFile(f);
      out.push(
        r.ok
          ? { ok: true, text: t('Imported {name}.', { name: r.model.name }) }
          : { ok: false, text: r.problem },
      );
    }
    setNotes(out);
    setBusy(false);
    await refresh();
  };

  const add = (row: StoredModel) => {
    const pm = useDesign.getState().projectModel;
    const b: Box | undefined = pm?.extent;
    const id = newId();
    const item = makeModelItem(id, row, b && (b.w || b.d) ? b.x + b.w : 0);
    updateProject((p) => ({
      ...p,
      schemaVersion: PROJECT_SCHEMA,
      models: [...(p.models ?? []), item],
    }));
    select(id);
    onDone();
  };

  const remove = async (row: StoredModel) => {
    if (
      !(await askConfirm(t("Delete “{name}” from this device's 3D models?", { name: row.name }), {
        confirmLabel: t('Delete'),
        danger: true,
      }))
    )
      return;
    // In use: the open project, and its undo and redo steps (an undo must not bring back a deleted file).
    const st = useDesign.getState();
    const open = [st.project, ...st.projectPast, ...st.projectFuture].flatMap((p) =>
      (p?.models ?? []).map((m) => m.modelId),
    );
    try {
      const r = await deleteModelIfUnused(row.id, open);
      if (r.deleted) forgetModelScene(row.id);
      setNotes([
        r.deleted
          ? { ok: true, text: t('Deleted {name}.', { name: row.name }) }
          : {
              ok: false,
              text: t('{name} is used by {list}; remove it there first.', {
                name: row.name,
                list: [...new Set(r.usedBy)].slice(0, 3).join(', '),
              }),
            },
      ]);
    } catch {
      setNotes([{ ok: false, text: t('{name} could not be deleted.', { name: row.name }) }]);
    }
    await refresh();
  };

  return (
    <section className="my-models" aria-labelledby="my-models-head">
      <div className="info-row">
        <h3 className="list-head" id="my-models-head">
          {t('My 3D models')}
        </h3>
        <InfoTip label={t('About my 3D models')} align="start">
          {t(
            'Appliances, sinks or decor from a .glb or .gltf file on this device, up to 30 MB and 500 000 triangles. Display only: never cut, priced or bought. Nothing is uploaded.',
          )}
        </InfoTip>
      </div>
      <input
        ref={input}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) void importFiles(files);
        }}
      />
      <button
        type="button"
        className="btn outline block"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" />
        {busy ? t('Importing…') : t('Import 3D model')}
      </button>
      {notes.map((n, i) => (
        <p key={i} className={n.ok ? 'hint' : 'alert error'} role={n.ok ? 'status' : 'alert'}>
          {n.text}
        </p>
      ))}
      {rows.length > 0 && (
        <ul className="template-list">
          {rows.map((r) => (
            <li key={r.id} className="model-row">
              <button type="button" className="row-btn" onClick={() => add(r)}>
                <span className="glyph">
                  {thumbs.get(r.id) ? (
                    <img src={thumbs.get(r.id)} alt="" width={36} height={36} />
                  ) : (
                    <Icon name="cube" />
                  )}
                </span>
                <span>
                  <strong>{r.name}</strong>
                  <span className="sub num">
                    {r.size.w} × {r.size.h} × {r.size.d} {t('mm')} ·{' '}
                    {t('{n} triangles', { n: r.triangles.toLocaleString('en') })}
                  </span>
                </span>
                <Icon name="plus" className="chev sm" />
              </button>
              <button
                type="button"
                className="btn sm ghost"
                aria-label={t('Delete {name}', { name: r.name })}
                onClick={() => void remove(r)}
              >
                <Icon name="trash" className="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const onEnter = (f: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    f();
  }
};

/** Screen point → plan mm, through the plan's own drawing. */
function planAt(e: ReactPointerEvent<SVGGElement>): PointerAt {
  const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
  const pt = m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null;
  return {
    pointerId: e.pointerId,
    sx: e.clientX,
    sy: e.clientY,
    room: pt ? { x: Math.round(pt.x), z: Math.round(pt.y) } : null,
  };
}

/**
 * The project's models on the plan: labelled dashed boxes; tap to select, drag to move with Snap and Alt as pieces
 * do (ADR-208), arrow keys move by 10 mm (Shift 100). One undo step per drop.
 */
export function PlanModels({
  pm,
  fs,
  tapping,
}: {
  pm: ProjectModel;
  fs: number;
  tapping: boolean;
}) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  const dropModel = useDesign((s) => s.dropModel);
  const project = useDesign((s) => s.project);
  const patch = usePatchModel();
  const [snapOn] = useSnap();
  const [drag, setDragState] = useState<{ g: DragGesture; alt: boolean } | null>(null);
  const dragRef = useRef<{ g: DragGesture; alt: boolean } | null>(null);
  const setDrag = (v: { g: DragGesture; alt: boolean } | null) => {
    dragRef.current = v;
    setDragState(v);
  };
  // Esc cancels a drag (ADR-065).
  useEffect(() => {
    if (!drag) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrag(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drag]);
  const target =
    drag?.g.dragging && project
      ? modelDrop(project, pm.pieces, drag.g.id, drag.g.dx, drag.g.dz, snapOn && !drag.alt)
      : null;
  return (
    <>
      {pm.models.map(({ item, box: b }) => {
        const [x1, z1, x2, z2] = frontEdge(b, modelYaw(item));
        const on = item.id === selectedId;
        return (
          <g
            key={item.id}
            className={`plan-piece plan-model ${on ? 'on' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={t('{name} (3D model), {w} by {d} mm', { name: item.name, w: b.w, d: b.d })}
            onClick={tapping ? undefined : () => select(item.id)}
            onPointerDown={
              tapping
                ? undefined
                : (e) => {
                    if (e.pointerType === 'mouse' && e.button !== 0) return;
                    if (dragRef.current) return setDrag(null);
                    const g = pressPiece(null, item.id, planAt(e));
                    if (!g) return;
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setDrag({ g, alt: e.altKey });
                  }
            }
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d || d.g.id !== item.id) return;
              const g = movePointer(d.g, planAt(e));
              if (g !== d.g || e.altKey !== d.alt) setDrag({ g: g!, alt: e.altKey });
            }}
            onPointerUp={(e) => {
              const d = dragRef.current;
              if (!d || d.g.id !== item.id) return;
              const end = releasePointer(d.g, e.pointerId);
              setDrag(null);
              if (end?.kind === 'drop') dropModel(item.id, end.dx, end.dz, snapOn && !e.altKey);
            }}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              const m = tapping ? null : arrowMove(e.key, e.shiftKey);
              if (!m) return onEnter(() => select(item.id))(e);
              e.preventDefault();
              patch(item.id, {
                position: {
                  ...item.position,
                  x: item.position.x + m.dx,
                  z: item.position.z + m.dz,
                },
              });
            }}
          >
            <rect x={b.x} y={b.z} width={b.w} height={b.d} />
            <line className="front" x1={x1} y1={z1} x2={x2} y2={z2} />
            <text
              x={b.x + b.w / 2}
              y={b.z + b.d / 2}
              fontSize={Math.min(fs, b.w / 7)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {item.name}
            </text>
          </g>
        );
      })}
      {target && (
        <g className={`drag-ghost ${target.snap ? 'snapped' : ''}`} aria-hidden="true">
          <rect x={target.box.x} y={target.box.z} width={target.box.w} height={target.box.d} />
          <text x={target.box.x} y={target.box.z - fs * 0.5} fontSize={fs}>
            {t('From left {x} · From back {z} mm', {
              x: target.position.x,
              z: target.position.z,
            })}
          </text>
          {(target.snap ?? target.hint) && (
            <text
              className="snap-label"
              x={target.box.x}
              y={target.box.z + target.box.d + fs * 1.2}
              fontSize={fs}
            >
              {target.snap ?? target.hint}
            </text>
          )}
        </g>
      )}
    </>
  );
}

/** The project's models in the front view: labelled dashed boxes (y up is drawn as −y). */
export function FrontModels({ pm, fs }: { pm: ProjectModel; fs: number }) {
  const selectedId = useDesign((s) => s.selectedItemId);
  const select = useDesign((s) => s.selectItem);
  return (
    <>
      {[...pm.models]
        .sort((a, c) => a.box.z + a.box.d - (c.box.z + c.box.d))
        .map(({ item, box: b }) => (
          <g
            key={item.id}
            className={`front-model ${item.id === selectedId ? 'on' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={item.id === selectedId}
            aria-label={t('{name} (3D model), {w} wide, {h} high', {
              name: item.name,
              w: b.w,
              h: b.h,
            })}
            onClick={() => select(item.id)}
            onKeyDown={onEnter(() => select(item.id))}
          >
            <rect x={b.x} y={-(b.y + b.h)} width={b.w} height={b.h} />
            <text
              x={b.x + b.w / 2}
              y={-(b.y + b.h / 2)}
              fontSize={Math.min(fs, b.w / 7)}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {item.name}
            </text>
          </g>
        ))}
    </>
  );
}
