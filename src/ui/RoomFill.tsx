/**
 * Fill the room (ADR-173): a room (its shape and sizes, or the open project's room), which walls to fill, then
 * suggested whole-room mixes built on Fill a wall (ADR-103/104) with a corner cabinet at each inside corner. Refine
 * narrows them; "Use this mix" saves and opens a project, or adds the pieces to the open project. The mixes are
 * worked out in `src/core/roomfill.ts`; this file only collects the answers and shows the result.
 */
import { useId, useMemo, useState, type FormEvent } from 'react';
import { t } from '../core/i18n';
import {
  BASE_HEIGHT,
  WALL_HEIGHT,
  MIXES_FIRST,
  WALL_DEFAULTS,
  type TallPosition,
  type WallField,
  type WallRow,
} from '../core/wallfill';
import {
  checkRoom,
  suggestRoomMixes,
  type CornerKind,
  type RoomInput,
  type RoomIssue,
  type RoomMix,
} from '../core/roomfill';
import {
  checkRoomSizes,
  DEFAULT_ROOM_HEIGHT,
  shapeOutline,
  wallLength,
  type Room,
  type RoomShape,
  type RoomSizeField,
  type ShapeSizes,
} from '../core/room';
import { snapshotSvg } from '../core/snapshot';
import { saveProject } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Segmented, Steps } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { Field, Problems } from './WallFill';

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
};

const num = (s: string) => Number(s.trim());
const opt = (s: string) => (s.trim() === '' ? undefined : num(s));

const sizesOf = (f: Form): ShapeSizes => ({
  width: num(f.width),
  depth: num(f.depth),
  cutWidth: num(f.cutWidth),
  cutDepth: num(f.cutDepth),
  offset: num(f.offset),
});

/** The form field a problem names (ADR-193): a room size, or one of Fill a wall's answers. */
const SIZE_FIELD: Record<RoomSizeField, keyof Form> = {
  width: 'width',
  depth: 'depth',
  height: 'roomHeight',
  cutWidth: 'cutWidth',
  cutDepth: 'cutDepth',
  offset: 'offset',
};
const WALL_FIELD: Partial<Record<WallField, keyof Form>> = {
  depth: 'pieceDepth',
  tallDepth: 'tallDepth',
  minWidth: 'minWidth',
  maxWidth: 'maxWidth',
  baseHeight: 'baseHeight',
  wallHeight: 'wallHeight',
  tallCount: 'tallCount',
  shelves: 'shelves',
  drawers: 'drawers',
  door: 'door',
};
/** The step that asks about the field a problem names; ticked walls and the cabinet depths are on Walls. */
function stepOf(d: RoomIssue): StepId {
  if (d.code === 'room-size') return 'room';
  const f = fieldOf(d);
  return !f || f === 'pieceDepth' || f === 'tallDepth' ? 'walls' : 'refine';
}

function fieldOf(d: RoomIssue): keyof Form | undefined {
  if (!d.field) return undefined;
  return d.code === 'room-size'
    ? SIZE_FIELD[d.field as RoomSizeField]
    : WALL_FIELD[d.field as WallField];
}

/** The room from the form: a ready shape and its sizes (ADR-059), no openings. */
function roomOf(f: Form): Room {
  const sizes = sizesOf(f);
  return {
    height: num(f.roomHeight),
    outline: shapeOutline(f.shape, sizes),
    features: [],
    shape: { kind: f.shape, sizes },
  };
}

function toInput(f: Form, room: Room, walls: number[]): RoomInput {
  return {
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
    corner: f.corner,
  };
}

const picture = (m: RoomMix) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(m.model.model, m.model.materials, 220))}`;

function MixCard({ m, onUse, label }: { m: RoomMix; onUse: () => void; label: string }) {
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
  const uid = useId();
  const [form, setForm] = useState<Form>(START);
  // The answers the cards were made from; none until they are first applied (ADR-193).
  const [applied, setApplied] = useState<{ form: Form; walls: number[] } | null>(null);
  const [step, setStep] = useState<StepId>(projectRoom ? 'walls' : 'room');
  const [problems, setProblems] = useState<RoomIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const room = useMemo(() => projectRoom ?? roomOf(form), [projectRoom, form]);
  const [walls, setWalls] = useState<number[] | null>(null);
  const ticked = walls ?? room.outline.map((_, i) => i);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const result = useMemo(
    () =>
      applied
        ? suggestRoomMixes(
            toInput(applied.form, projectRoom ?? roomOf(applied.form), applied.walls),
          )
        : null,
    [applied, projectRoom],
  );
  const problemId = (i: number) => `${uid}-problem-${i}`;
  const problem = (k: keyof Form) =>
    problems
      .map((d, i) => (fieldOf(d) === k ? problemId(i) : ''))
      .filter(Boolean)
      .join(' ') || undefined;
  // Leaving the Room step checks its sizes first; a wrong one keeps the user there, named (ADR-008, ADR-193).
  const go = (s: StepId) => {
    if (step === 'room' && s !== 'room' && !projectRoom) {
      const bad = checkRoomSizes(form.shape, sizesOf(form), num(form.roomHeight));
      if (bad.length) {
        setProblems(bad);
        return;
      }
    }
    setProblems([]);
    setStep(s);
    document.querySelector('.dialog[open] .dialog-body')?.scrollTo({ top: 0 });
  };
  const suggest = () => {
    const bad = checkRoom(toInput(form, room, ticked));
    if (bad.length) {
      setProblems(bad);
      // Suggestions has no fields: the user goes to the step that holds the first problem.
      if (step === 'mixes') setStep(stepOf(bad[0]));
      return;
    }
    setApplied({ form, walls: ticked });
    go('mixes');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'room') go('walls');
    else if (step === 'mixes') go('refine');
    else suggest();
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
    <form className="wizard wall-fill room-fill" onSubmit={submit} noValidate>
      <Steps
        label={t('Fill the room steps')}
        current={step}
        onSelect={(id) => (id === 'mixes' ? suggest() : go(id as StepId))}
        steps={STEPS.filter((s) => s.id !== 'room' || !projectRoom).map((s) => ({
          ...s,
          // The Room step is left only with its sizes right; Walls is done once the answers are applied (ADR-193).
          done: (s.id === 'room' && step !== 'room') || (s.id === 'walls' && applied !== null),
        }))}
      />
      {step === 'room' && !projectRoom && (
        <section aria-label={t('Room')}>
          <h3>{t('Room')}</h3>
          <p className="hint">
            {t(
              'A ready shape and its sizes, in mm. Doors and windows come from a project’s own room: open the project and use Fill the room from its ⋯ menu.',
            )}
          </p>
          <Segmented
            label={t('Shape')}
            value={form.shape}
            onChange={(v) => {
              setForm((f) => ({ ...f, shape: v }));
              // Another shape has other walls: every wall is ticked again (ADR-193).
              setWalls(null);
            }}
            options={shapes}
          />
          <div className="wf-grid">
            <Field
              label={t('Width')}
              value={form.width}
              onChange={set('width')}
              problem={problem('width')}
            />
            <Field
              label={t('Depth')}
              value={form.depth}
              onChange={set('depth')}
              problem={problem('depth')}
            />
            <Field
              label={t('Room height')}
              value={form.roomHeight}
              onChange={set('roomHeight')}
              problem={problem('roomHeight')}
            />
            {form.shape !== 'rectangle' && (
              <>
                <Field
                  label={t('Cut width')}
                  value={form.cutWidth}
                  onChange={set('cutWidth')}
                  problem={problem('cutWidth')}
                />
                <Field
                  label={t('Cut depth')}
                  value={form.cutDepth}
                  onChange={set('cutDepth')}
                  problem={problem('cutDepth')}
                />
                <Field
                  label={t('Cut offset')}
                  value={form.offset}
                  onChange={set('offset')}
                  problem={problem('offset')}
                />
              </>
            )}
          </div>
          <Problems list={problems} idOf={problemId} />
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
          {/* The cabinet depths come before the cards, as in Fill a wall (ADR-193). */}
          <h4>{t('Cabinets')}</h4>
          <div className="wf-grid">
            <Field
              label={t('Depth')}
              value={form.pieceDepth}
              onChange={set('pieceDepth')}
              problem={problem('pieceDepth')}
            />
            <Field
              label={t('Tall cabinet depth')}
              value={form.tallDepth}
              onChange={set('tallDepth')}
              placeholder={t('same as depth')}
              problem={problem('tallDepth')}
            />
          </div>
          <Problems list={problems} idOf={problemId} />
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
            <Field
              label={t('Min piece width')}
              value={form.minWidth}
              onChange={set('minWidth')}
              problem={problem('minWidth')}
            />
            <Field
              label={t('Max piece width')}
              value={form.maxWidth}
              onChange={set('maxWidth')}
              problem={problem('maxWidth')}
            />
            <Field
              label={t('Base height')}
              value={form.baseHeight}
              onChange={set('baseHeight')}
              problem={problem('baseHeight')}
            />
            <Field
              label={t('Tall cabinets')}
              value={form.tallCount}
              onChange={set('tallCount')}
              problem={problem('tallCount')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, open shelf bases')}
              value={form.shelves}
              onChange={set('shelves')}
              problem={problem('shelves')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, drawer bases')}
              value={form.drawers}
              onChange={set('drawers')}
              problem={problem('drawers')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, door bases')}
              value={form.door}
              onChange={set('door')}
              problem={problem('door')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Wall cabinet height')}
              value={form.wallHeight}
              onChange={set('wallHeight')}
              problem={problem('wallHeight')}
              hint={t('Wall cabinet tops sit at the wall height.')}
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
          <Problems list={problems} idOf={problemId} />
        </section>
      )}
      {step === 'mixes' && result && (
        <section className="wz-suggest" aria-label={t('Suggested room mixes')}>
          <div className="card-title">
            <span>{t('Suggested room mixes')}</span>
            <span className="hint">
              {t('{n|# wall|# walls} · best {k}, each checked for problems', {
                n: applied?.walls.length ?? 0,
                k: MIXES_FIRST,
              })}
            </span>
          </div>
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
          // Back to Suggestions with nothing applied yet makes them from the typed answers (ADR-193).
          onClick={() =>
            step === 'refine' && !applied
              ? suggest()
              : go(step === 'refine' ? 'mixes' : step === 'mixes' ? 'walls' : 'room')
          }
        >
          {t('Back')}
        </button>
        <span className="wz-spacer" />
        <button type="button" className="btn ghost" onClick={onClose}>
          {t('Cancel')}
        </button>
        {/* The step's primary action is the form's submit, so Enter does it (ADR-193). */}
        <button type="submit" className="btn primary">
          {step === 'room'
            ? t('Next')
            : step === 'walls'
              ? t('Show suggestions')
              : step === 'mixes'
                ? t('Refine')
                : t('Suggest again')}
        </button>
      </div>
    </form>
  );
}
