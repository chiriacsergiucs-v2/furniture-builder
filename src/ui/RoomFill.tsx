/**
 * Fill the room (ADR-173): a room (its shape and sizes, or the open project's room), which walls to fill, then
 * suggested whole-room mixes built on Fill a wall (ADR-103/104) with a corner cabinet at each inside corner. Refine
 * narrows them; "Use this mix" saves and opens a project, or adds the pieces to the open project. The mixes are
 * worked out in `src/core/roomfill.ts`; this file only collects the answers and shows the result.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { t, tr } from '../core/i18n';
import {
  BASE_HEIGHT,
  TALL_HEIGHT,
  WALL_DEPTH,
  WALL_HEIGHT,
  MIXES_FIRST,
  WALL_DEFAULTS,
  type TallPosition,
  type WallRow,
} from '../core/wallfill';
import {
  isRectangle,
  suggestRoomMixes,
  type CornerKind,
  type RoomInput,
  type RoomMix,
} from '../core/roomfill';
import { CURRENCY_ID, DEFAULT_CURRENCY, formatMoney, parseMoney } from '../core/prices';
import { builtInStyles, yourStyles, type Style } from '../core/styles';
import { listProjects } from '../persist/db';
import { usePrices } from './priceStore';
import {
  DEFAULT_ROOM_HEIGHT,
  shapeOutline,
  wallLength,
  type Room,
  type RoomFeature,
  type RoomShape,
  type ShapeSizes,
} from '../core/room';
import { snapshotSvg } from '../core/snapshot';
import { saveProject } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Segmented, Steps } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { RoomFeatures } from './RoomFeatures';

type StepId = 'room' | 'walls' | 'mixes' | 'refine';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'room', label: t('Room') },
  { id: 'walls', label: t('Walls') },
  { id: 'mixes', label: t('Suggestions') },
  { id: 'refine', label: t('Refine') },
];

/** What the user typed, kept as text so a wrong entry shows as a problem instead of vanishing (ADR-008). */
interface Form {
  shape: RoomShape;
  width: string;
  depth: string;
  cutWidth: string;
  cutDepth: string;
  offset: string;
  roomHeight: string;
  pieceDepth: string;
  tallDepth: string;
  minWidth: string;
  maxWidth: string;
  baseHeight: string;
  tallCount: string;
  tallPosition: TallPosition | 'auto';
  shelves: string;
  drawers: string;
  door: string;
  wallRow: WallRow;
  wallHeight: string;
  corner: CornerKind;
  /** Tall cabinet height and wall cabinet depth (ADR-204). */
  tallHeight: string;
  wallDepth: string;
  /** The room's doors, windows and other features (ADR-204). */
  features: RoomFeature[];
  /** Budget ceiling as typed (empty = none), the style's id ('' = Any), an island and its walkway (ADR-210). */
  ceiling: string;
  style: string;
  island: boolean;
  walkway: string;
}

const START: Form = {
  shape: 'rectangle',
  width: '3600',
  depth: '3000',
  cutWidth: '1500',
  cutDepth: '1500',
  offset: '0',
  roomHeight: String(DEFAULT_ROOM_HEIGHT),
  pieceDepth: '560',
  tallDepth: '',
  minWidth: String(WALL_DEFAULTS.minWidth),
  maxWidth: String(WALL_DEFAULTS.maxWidth),
  baseHeight: String(BASE_HEIGHT),
  tallCount: '',
  tallPosition: 'auto',
  shelves: '',
  drawers: '',
  door: '',
  wallRow: 'always',
  wallHeight: String(WALL_HEIGHT),
  corner: 'blind',
  tallHeight: String(TALL_HEIGHT),
  wallDepth: String(WALL_DEPTH),
  features: [],
  ceiling: '',
  style: '',
  island: false,
  // No prefilled walkway: the user's own size (ADR-010, ADR-073).
  walkway: '',
};

const num = (s: string) => Number(s.trim());
const opt = (s: string) => (s.trim() === '' ? undefined : num(s));

/** The room from the form: a ready shape and its sizes (ADR-059), with its doors, windows and features (ADR-204). */
function roomOf(f: Form): Room {
  const sizes: ShapeSizes = {
    width: num(f.width),
    depth: num(f.depth),
    cutWidth: num(f.cutWidth),
    cutDepth: num(f.cutDepth),
    offset: num(f.offset),
  };
  return {
    height: num(f.roomHeight),
    outline: shapeOutline(f.shape, sizes),
    features: f.features,
    shape: { kind: f.shape, sizes },
  };
}

/** What Fill the room needs beyond the form (ADR-210): the styles to pick from and the prices to estimate with. */
interface Extras {
  styles: Style[];
  prices: RoomInput['prices'];
}

function toInput(f: Form, room: Room, walls: number[], extras?: Extras): RoomInput {
  const ceiling = f.ceiling.trim() ? parseMoney(f.ceiling) : null;
  const style = f.style ? extras?.styles.find((s) => s.id === f.style) : undefined;
  return {
    ...(ceiling !== null ? { ceiling } : {}),
    ...(style ? { style } : {}),
    ...(f.island ? { island: { walkway: opt(f.walkway) } } : {}),
    prices: extras?.prices ?? [],
    room,
    walls,
    depth: num(f.pieceDepth),
    tallDepth: opt(f.tallDepth),
    minWidth: opt(f.minWidth),
    maxWidth: opt(f.maxWidth),
    baseHeight: opt(f.baseHeight),
    tallCount: opt(f.tallCount),
    tallPosition: f.tallPosition === 'auto' ? undefined : f.tallPosition,
    atLeast: { shelves: opt(f.shelves), drawers: opt(f.drawers), door: opt(f.door) },
    wallRow: f.wallRow,
    wallHeight: opt(f.wallHeight),
    tallHeight: opt(f.tallHeight),
    wallDepth: opt(f.wallDepth),
    corner: f.corner,
  };
}

function Field({
  label,
  value,
  onChange,
  hint,
  unit = t('mm'),
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  unit?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="mm wz-int">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="unit">{unit}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

const picture = (m: RoomMix) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(m.model.model, m.model.materials, 220))}`;

function MixCard({
  m,
  onUse,
  label,
  currency,
}: {
  m: RoomMix;
  onUse: () => void;
  label: string;
  currency: string;
}) {
  const src = useMemo(() => picture(m), [m]);
  return (
    <li className="wz-card wf-card">
      <img
        src={src}
        alt={t('Room mix: {summary}', { summary: m.summary })}
        width={180}
        height={110}
      />
      {m.walls.map((w) => (
        <span key={w.wall} className="wz-card-label num">
          {t('Wall {n}: {w} mm', { n: w.wall + 1, w: w.widths })}
        </span>
      ))}
      <span className="wz-card-label">
        {m.corners
          ? t('{summary} · {n|# corner cabinet|# corner cabinets}', {
              summary: m.summary,
              n: m.corners,
            })
          : m.summary}
      </span>
      {m.island && (
        <span className="wz-card-label">{t('Island: {summary}', { summary: m.island })}</span>
      )}
      <span className="wz-card-label num">
        {t('Estimate {total} {currency}', { total: formatMoney(m.estimate.total), currency })}
        {m.estimate.missing.length > 0 &&
          ` · ${t('{n|# line|# lines} without a price', { n: m.estimate.missing.length })}`}
      </span>
      {m.warnings.length > 0 && (
        <ul className="wf-warnings">
          {m.warnings.slice(0, 3).map((w, i) => (
            <li key={i} className="alert warning">
              <Icon name="alert-triangle" className="sm" />
              <span>{w.message}</span>
            </li>
          ))}
          {m.warnings.length > 3 && (
            <li className="hint">
              {t('…and {n} more in the project.', { n: m.warnings.length - 3 })}
            </li>
          )}
        </ul>
      )}
      <button type="button" className="btn sm primary" onClick={onUse}>
        {label}
      </button>
    </li>
  );
}

export function RoomFillDialog({
  open,
  onClose,
  onOpened,
  addTo = false,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: () => void;
  /** Fill the open project's room and add the pieces to it (Project ⋯ → Fill the room…). */
  addTo?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t('Fill the room')} wide>
      {open && <RoomFill onClose={onClose} onOpened={onOpened} addTo={addTo} />}
    </Dialog>
  );
}

function RoomFill({
  onClose,
  onOpened,
  addTo,
}: {
  onClose: () => void;
  onOpened: () => void;
  addTo: boolean;
}) {
  const openProject = useDesign((s) => s.openProject);
  const projectRoom = useDesign((s) => (addTo ? s.project?.room : undefined));
  const fillRoom = useDesign((s) => s.fillRoom);
  const [form, setForm] = useState<Form>(START);
  const [applied, setApplied] = useState<{ form: Form; walls: number[] } | null>(null);
  const [step, setStep] = useState<StepId>(projectRoom ? 'walls' : 'room');
  const [saveError, setSaveError] = useState<string | null>(null);
  const room = useMemo(() => projectRoom ?? roomOf(form), [projectRoom, form]);
  const [walls, setWalls] = useState<number[] | null>(null);
  const ticked = walls ?? room.outline.map((_, i) => i);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  // Styles (ADR-123): the built-in ones and yours, from your saved projects (ADR-210).
  const [mine, setMine] = useState<Style[]>([]);
  useEffect(() => {
    let live = true;
    listProjects()
      .then((rows) => live && setMine(yourStyles(rows.map((r) => r.project))))
      .catch(() => live && setMine([]));
    return () => {
      live = false;
    };
  }, []);
  const styles = useMemo(() => [...builtInStyles(), ...mine], [mine]);
  // The user's prices for each mix's estimate (ADR-172, ADR-210).
  const prices = usePrices((s) => s.prices);
  const loadPrices = usePrices((s) => s.load);
  useEffect(() => loadPrices(), [loadPrices]);
  const currency = useMemo(
    () => prices.find((p) => p.id === CURRENCY_ID)?.text ?? DEFAULT_CURRENCY,
    [prices],
  );
  const result = useMemo(
    () =>
      applied
        ? suggestRoomMixes(
            toInput(applied.form, projectRoom ?? roomOf(applied.form), applied.walls, {
              styles,
              prices,
            }),
          )
        : null,
    [applied, projectRoom, styles, prices],
  );
  const badCeiling = form.ceiling.trim() !== '' && parseMoney(form.ceiling) === null;
  const rectangle = isRectangle(room);
  const go = (s: StepId) => {
    setStep(s);
    document.querySelector('.dialog[open] .dialog-body')?.scrollTo({ top: 0 });
  };
  const suggest = () => {
    setApplied({ form, walls: ticked });
    go('mixes');
  };
  const use = async (m: RoomMix) => {
    try {
      if (addTo) fillRoom(m.project);
      else {
        await saveProject(m.project);
        openProject(m.project);
      }
      onClose();
      onOpened();
    } catch {
      setSaveError(t('The project could not be saved in this browser’s storage.'));
    }
  };
  const shapes: { value: RoomShape; label: string }[] = [
    { value: 'rectangle', label: t('Rectangle') },
    { value: 'l-shape', label: t('L') },
    { value: 'u-shape', label: t('U') },
    { value: 'alcove', label: t('Alcove') },
  ];
  return (
    <div className="wizard wall-fill room-fill">
      <Steps
        label={t('Fill the room steps')}
        current={step}
        onSelect={(id) => (id === 'mixes' ? suggest() : go(id as StepId))}
        steps={STEPS.filter((s) => s.id !== 'room' || !projectRoom).map((s) => ({
          ...s,
          done:
            (s.id === 'room' && step !== 'room') ||
            (s.id === 'walls' && (step === 'mixes' || step === 'refine')),
        }))}
      />
      {step === 'room' && !projectRoom && (
        <section aria-label={t('Room')}>
          <h3>{t('Room')}</h3>
          <p className="hint">
            {t('A ready shape and its sizes, in mm, with its doors, windows and other features.')}
          </p>
          <Segmented
            label={t('Shape')}
            value={form.shape}
            onChange={(v) => setForm((f) => ({ ...f, shape: v }))}
            options={shapes}
          />
          <div className="wf-grid">
            <Field label={t('Width')} value={form.width} onChange={set('width')} />
            <Field label={t('Depth')} value={form.depth} onChange={set('depth')} />
            <Field label={t('Room height')} value={form.roomHeight} onChange={set('roomHeight')} />
            {form.shape !== 'rectangle' && (
              <>
                <Field label={t('Cut width')} value={form.cutWidth} onChange={set('cutWidth')} />
                <Field label={t('Cut depth')} value={form.cutDepth} onChange={set('cutDepth')} />
                <Field label={t('Cut offset')} value={form.offset} onChange={set('offset')} />
              </>
            )}
          </div>
          <RoomFeatures
            room={room}
            onChange={(r) => setForm((f) => ({ ...f, features: r.features }))}
          />
        </section>
      )}
      {step === 'walls' && (
        <section aria-label={t('Walls')}>
          <h3>{t('Walls')}</h3>
          <p className="hint">
            {projectRoom
              ? t('This project’s room, with its doors and windows. Tick the walls to fill.')
              : t('Tick the walls to fill; every wall is ticked to start with.')}
          </p>
          <ul className="wf-walls" role="group" aria-label={t('Walls to fill')}>
            {room.outline.map((_, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={ticked.includes(i)}
                    onChange={(e) =>
                      setWalls(
                        e.target.checked
                          ? [...ticked, i].sort((a, b) => a - b)
                          : ticked.filter((w) => w !== i),
                      )
                    }
                  />{' '}
                  {t('Wall {n}, {len} mm', { n: i + 1, len: wallLength(room, i) })}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      {step === 'refine' && (
        <section aria-label={t('Refine')}>
          <h3>{t('Refine')}</h3>
          <p className="hint">
            {t(
              'Leave a field empty for any. Applied to every ticked wall; shelves wider than the shelf-span guidance get a centre divider.',
            )}
          </p>
          <div className="wf-grid">
            <Field label={t('Depth')} value={form.pieceDepth} onChange={set('pieceDepth')} />
            <Field
              label={t('Tall cabinet depth')}
              value={form.tallDepth}
              onChange={set('tallDepth')}
              placeholder={t('same as depth')}
            />
            <Field label={t('Min piece width')} value={form.minWidth} onChange={set('minWidth')} />
            <Field label={t('Max piece width')} value={form.maxWidth} onChange={set('maxWidth')} />
            <Field label={t('Base height')} value={form.baseHeight} onChange={set('baseHeight')} />
            <Field
              label={t('Tall cabinets')}
              value={form.tallCount}
              onChange={set('tallCount')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, open shelf bases')}
              value={form.shelves}
              onChange={set('shelves')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, drawer bases')}
              value={form.drawers}
              onChange={set('drawers')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, door bases')}
              value={form.door}
              onChange={set('door')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Wall cabinet height')}
              value={form.wallHeight}
              onChange={set('wallHeight')}
              hint={t('Wall cabinet tops sit at the wall height.')}
            />
            <Field
              label={t('Tall cabinet height')}
              value={form.tallHeight}
              onChange={set('tallHeight')}
            />
            <Field
              label={t('Wall cabinet depth')}
              value={form.wallDepth}
              onChange={set('wallDepth')}
            />
          </div>
          <Segmented
            label={t('Corner cabinet')}
            value={form.corner}
            onChange={(v) => setForm((f) => ({ ...f, corner: v }))}
            options={[
              { value: 'blind', label: t('Blind corner') },
              { value: 'l-shape', label: t('L corner') },
              { value: 'none', label: t('None') },
            ]}
          />
          <Segmented
            label={t('Wall cabinets')}
            value={form.wallRow}
            onChange={(v) => setForm((f) => ({ ...f, wallRow: v }))}
            options={[
              { value: 'any', label: t('Any') },
              { value: 'always', label: t('Always') },
              { value: 'never', label: t('Never') },
            ]}
          />
          <Segmented
            label={t('Tall cabinets stand')}
            value={form.tallPosition}
            onChange={(v) => setForm((f) => ({ ...f, tallPosition: v }))}
            options={[
              { value: 'auto', label: t('Auto') },
              { value: 'left', label: t('Left') },
              { value: 'right', label: t('Right') },
              { value: 'ends', label: t('Both ends') },
              { value: 'centre', label: t('Centre') },
            ]}
          />
          <div className="wf-grid">
            <Field
              label={t('Budget ceiling')}
              value={form.ceiling}
              onChange={set('ceiling')}
              unit={currency}
              placeholder={t('none')}
              hint={t('Mixes whose estimate is above it are hidden.')}
            />
            <div className="field">
              <label htmlFor="room-fill-style">{t('Style')}</label>
              <select
                id="room-fill-style"
                value={form.style}
                onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
              >
                <option value="">{t('Any')}</option>
                {styles.map((st) => (
                  <option key={st.id} value={st.id}>
                    {tr(st.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {badCeiling && (
            <p className="alert error" role="alert">
              <Icon name="alert-circle" className="sm" />
              <span>{t('The budget ceiling is not an amount; it is not applied.')}</span>
            </p>
          )}
          <label className="toggle small">
            <input
              type="checkbox"
              checked={form.island}
              disabled={!rectangle}
              onChange={(e) => setForm((f) => ({ ...f, island: e.target.checked }))}
            />
            <span>{t('Add an island')}</span>
          </label>
          {!rectangle && <p className="hint">{t('An island needs a rectangle room.')}</p>}
          {form.island && (
            <Field
              label={t('Walkway width')}
              value={form.walkway}
              onChange={set('walkway')}
              hint={t('Your walkway around the island, in front of it and behind it.')}
            />
          )}
        </section>
      )}
      {step === 'mixes' && result && (
        <section className="wz-suggest" aria-label={t('Suggested room mixes')}>
          <div className="card-title">
            <span>{t('Suggested room mixes')}</span>
            <span className="hint">
              {t('{n|# wall|# walls} · best {k}, checked as a project', {
                n: applied?.walls.length ?? 0,
                k: MIXES_FIRST,
              })}
            </span>
          </div>
          {!!result.overBudget && result.mixes.length > 0 && (
            <p className="alert info" role="status">
              <Icon name="info" className="sm" />
              <span>{t('{n|# mix|# mixes} over the budget hidden', { n: result.overBudget })}</span>
            </p>
          )}
          {!!result.overBudget && !result.mixes.length && (
            <p className="alert error" role="status">
              <Icon name="alert-circle" className="sm" />
              <span>
                {t('No mix fits the budget; the cheapest is {total}.', {
                  total: `${formatMoney(result.cheapest ?? 0)} ${currency}`,
                })}
              </span>
            </p>
          )}
          {result.problems.map((p, i) => (
            <p key={i} className={`alert ${p.severity}`} role="status">
              <Icon name={p.severity === 'error' ? 'alert-circle' : 'info'} className="sm" />
              <span>{p.message}</span>
            </p>
          ))}
          {result.mixes.length > 0 && (
            <ul className="wz-cards wf-cards">
              {result.mixes.map((m) => (
                <MixCard
                  key={m.key}
                  m={m}
                  label={addTo ? t('Add this mix') : t('Use this mix')}
                  currency={currency}
                  onUse={() => void use(m)}
                />
              ))}
            </ul>
          )}
          {saveError && (
            <p className="alert error" role="alert">
              <Icon name="alert-circle" className="sm" />
              <span>{saveError}</span>
            </p>
          )}
        </section>
      )}
      <div className="wizard-footer">
        <button
          type="button"
          className="btn"
          disabled={step === 'room' || (step === 'walls' && !!projectRoom)}
          onClick={() => go(step === 'refine' ? 'mixes' : step === 'mixes' ? 'walls' : 'room')}
        >
          {t('Back')}
        </button>
        <span className="wz-spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
        {step === 'room' && (
          <button type="button" className="btn primary" onClick={() => go('walls')}>
            {t('Next')}
          </button>
        )}
        {step === 'walls' && (
          <button type="button" className="btn primary" onClick={suggest}>
            {t('Show suggestions')}
          </button>
        )}
        {step === 'mixes' && (
          <button type="button" className="btn primary" onClick={() => go('refine')}>
            {t('Refine')}
          </button>
        )}
        {step === 'refine' && (
          <button type="button" className="btn primary" onClick={suggest}>
            {t('Suggest again')}
          </button>
        )}
      </div>
    </div>
  );
}
