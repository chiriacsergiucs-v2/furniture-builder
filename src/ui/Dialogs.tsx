import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useUi } from '../store/uiStore';
import { kerfOf, newId, sheetOf } from '../core/design';
import type { BoardFinish, Material, MaterialKind, MaterialMaker } from '../core/types';
import { t } from '../core/i18n';
import {
  BAND_COLUMNS,
  DECOR_COLUMNS,
  decorPatch,
  KINDS,
  MAKERS,
  parseBandList,
  parseDecorList,
  type Band,
  type Decor,
} from '../core/materials';
import { newProject } from '../core/project';
import { roomPresets } from '../core/catalog/roomPresets';
import { projectFromTemplate, type ProjectTemplate } from '../core/projectTemplate';
import {
  clearDecors,
  listBands,
  listDecors,
  replaceBands,
  replaceDecors,
  saveProject,
} from '../store/libraryStore';
import { useDesign } from '../store/designStore';
import { Group, InfoTip, MmField, Segmented, Select, Toggle } from './controls';
import { Icon } from './icons';
import { BoardBand } from './BoardBand';
import { BoardProduct } from './SellerLinks';
import { StartFrom } from './Catalog';
import { askConfirm } from './Confirm';
import { importImage } from '../persist/images';
import { useImageUrls } from '../store/useImageUrls';
import { FINISHES, MAX_TILE } from '../core/surface';
import { usePieceLockHint } from './pieceLockHint';

const FINISH_LABEL: Record<BoardFinish, string> = {
  matte: t('Matte'),
  satin: t('Satin'),
  gloss: t('Gloss'),
};
const KIND_LABEL: Record<MaterialKind, string> = {
  pal: t('PAL'),
  mdf: t('MDF'),
  worktop: t('Kitchen worktop'),
  other: t('Other'),
};
const FINISH_OPTIONS = FINISHES.map((f) => ({ ...f, label: FINISH_LABEL[f.value] }));
const MAKER_OPTIONS = MAKERS.map((m) => (m.value === 'other' ? { ...m, label: t('Other') } : m));
const KIND_OPTIONS = KINDS.map((k) => ({ ...k, label: KIND_LABEL[k.value] }));

/** Modal shell: header (title + close), scrolling body, optional footer for actions. Esc and backdrop close it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  info,
  backdropClose = true,
  inSheet = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** An `InfoTip` beside the title (ADR-113); Esc while it is open closes only the tip. */
  info?: ReactNode;
  /** `false`: a click on the backdrop does not close the dialog (the wizard, ADR-191). */
  backdropClose?: boolean;
  /**
   * Phones (ADR-247): open inside the editor's Compose sheet (full height) instead of over the page, so the piece stays
   * the context and Back returns to it. Only while the editor is the page shown; otherwise the usual modal.
   */
  inSheet?: boolean;
}) {
  // The sheet shows only in Compose (ADR-241: the Cut list place hides it), so elsewhere the modal is used.
  const compose = useUi((s) => s.mode === 'compose');
  const slot = typeof document === 'undefined' ? null : document.getElementById('sheet-slot');
  const sheet = !!inSheet && compose && !!slot && slot.closest('main')?.hidden === false;
  if (sheet)
    return open ? (
      <SheetDialog title={title} info={info} footer={footer} onClose={onClose} slot={slot!}>
        {children}
      </SheetDialog>
    ) : null;
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      wide={wide}
      info={info}
      backdropClose={backdropClose}
    >
      {children}
    </ModalDialog>
  );
}

/** The sheet form of a dialog (ADR-247): a non-modal `<dialog open>` in the Compose sheet; Esc and × close it. */
function SheetDialog({
  title,
  info,
  footer,
  onClose,
  slot,
  children,
}: {
  title: string;
  info?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  slot: HTMLElement;
  children: ReactNode;
}) {
  const ask = useUi((s) => s.askSheet);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ask('full');
    return () => ask('half');
  }, [ask]);
  // A non-modal dialog does not take the focus as `showModal` does: without it, Esc goes to the page, not here.
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);
  return createPortal(
    <dialog
      ref={ref}
      open
      tabIndex={-1}
      className="dialog sheet-dialog"
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <header>
        {info ? (
          <div className="info-row">
            <h2>{title}</h2>
            {info}
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        <button
          type="button"
          className="btn icon ghost sm close"
          onClick={onClose}
          aria-label={t('Close')}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>,
    slot,
  );
}

function ModalDialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  info,
  backdropClose = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  info?: ReactNode;
  backdropClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef<number | null>(null);
  const backdropClick = useRef(false);
  const onBackdrop = (e: { target: EventTarget; clientX: number; clientY: number }) => {
    const d = ref.current;
    if (!d || e.target !== d) return false;
    const b = d.getBoundingClientRect();
    return e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom;
  };
  useEffect(() => {
    backdropPointer.current = null;
    backdropClick.current = false;
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'wide' : ''}`}
      // A dialog opened from inside this one (a product picker, ADR-161) closes only itself.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Esc asks the owner to close (`open` → false), so a close guard (ADR-191) sees it like the × button.
      onCancel={(e) => {
        e.preventDefault();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDownCapture={(e) => {
        backdropClick.current = false;
        backdropPointer.current = onBackdrop(e) ? e.pointerId : null;
      }}
      onPointerUpCapture={(e) => {
        backdropClick.current = backdropPointer.current === e.pointerId && onBackdrop(e);
        backdropPointer.current = null;
      }}
      onPointerCancelCapture={() => {
        backdropPointer.current = null;
        backdropClick.current = false;
      }}
      onClick={(e) => {
        const dismiss = backdropClick.current && onBackdrop(e);
        backdropClick.current = false;
        if (backdropClose && dismiss) onClose();
      }}
      aria-label={title}
    >
      <header>
        {info ? (
          <div className="info-row">
            <h2>{title}</h2>
            {info}
          </div>
        ) : (
          <h2>{title}</h2>
        )}
        <button
          type="button"
          className="btn icon ghost sm close"
          onClick={onClose}
          aria-label={t('Close')}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}

export function NewDialog({
  open,
  onClose,
  onBrowse,
  onWizard,
  onFillWall,
  onFillRoom,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onBrowse?: () => void;
  onWizard?: () => void;
  onFillWall?: () => void;
  /** Fill the room (ADR-173): every wall of a drawn room, with corner cabinets. */
  onFillRoom?: () => void;
  onOpened?: () => void;
}) {
  const load = useDesign((s) => s.load);
  const openProject = useDesign((s) => s.openProject);
  const [saveError, setSaveError] = useState<string | null>(null);
  // A failed save is said only while the dialog stays open: each opening starts without it.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSaveError(null);
  }
  // Set from the tap that saves a new project until the dialog closes or the save fails.
  const saving = useRef(false);
  useEffect(() => {
    if (open) saving.current = false;
  }, [open]);
  const opened = () => {
    onClose();
    onOpened?.();
  };
  // ADR-193: the new project is saved before it opens; a storage failure is said here and nothing opens. Another
  // tap while it saves, or before the dialog has closed, does nothing, so one tap makes one project.
  const newProjectOpened = async () => {
    if (saving.current) return;
    saving.current = true;
    const p = newProject();
    try {
      await saveProject(p);
    } catch {
      saving.current = false;
      setSaveError(t('The project could not be saved in this browser’s storage.'));
      return;
    }
    setSaveError(null);
    openProject(p);
    opened();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Start something new')}
      info={
        <InfoTip label={t('About starting something new')} align="start">
          {t('What you have open now is already saved on this device.')}
        </InfoTip>
      }
    >
      {onWizard && (
        <button type="button" className="row-btn" onClick={onWizard}>
          <span className="glyph">
            <Icon name="plus" />
          </span>
          <span>
            <strong>{t('New piece, step by step')}</strong>
            <span className="sub">
              {t(
                'Size, type, then only the questions that apply (dividers, shelves, drawers, doors, base), with suggested combinations. Saved to the Catalog.',
              )}
            </span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      <button type="button" className="row-btn" onClick={() => void newProjectOpened()}>
        <span className="glyph">
          <Icon name="project" />
        </span>
        <span>
          <strong>{t('Project with several pieces')}</strong>
          <span className="sub">
            {t(
              'A kitchen, a bedroom or a room: place pieces, then get one parts list and one set of sheets.',
            )}
          </span>
        </span>
        <Icon name="chevron-right" className="chev sm" />
      </button>
      {saveError && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{saveError}</span>
        </p>
      )}
      {onFillWall && (
        <button type="button" className="row-btn" onClick={onFillWall}>
          <span className="glyph">
            <Icon name="wall" />
          </span>
          <span>
            <strong>{t('Fill a wall')}</strong>
            <span className="sub">
              {t(
                "Enter a wall's width, depth and height; get suggested mixes of tall and base cabinets that fill it exactly, then refine them.",
              )}
            </span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      {onFillRoom && (
        <button type="button" className="row-btn" onClick={onFillRoom}>
          <span className="glyph">
            <Icon name="room-plan" />
          </span>
          <span>
            <strong>{t('Fill the room')}</strong>
            <span className="sub">
              {t(
                'Pick a room shape; get suggested mixes for every wall at once, with a corner cabinet at each inside corner, then refine them.',
              )}
            </span>
          </span>
          <Icon name="chevron-right" className="chev sm" />
        </button>
      )}
      <RoomPresets onOpened={opened} />
      {open && (
        <StartFrom
          onPick={(d) => {
            load(d);
            opened();
          }}
          onBrowse={onBrowse}
        />
      )}
    </Dialog>
  );
}

/**
 * New… → Room preset (ADR-210): the shipped room presets; one becomes a project with its room, saved on this device and
 * opened (ADR-060). Presets are built when the row opens.
 */
function RoomPresets({ onOpened }: { onOpened: () => void }) {
  const openProject = useDesign((s) => s.openProject);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presets = useMemo(() => (shown ? roomPresets() : []), [shown]);
  const use = async (template: ProjectTemplate) => {
    try {
      const p = projectFromTemplate(template);
      await saveProject(p);
      openProject(p);
      onOpened();
    } catch {
      setError(t('The project could not be created on this device.'));
    }
  };
  return (
    <>
      <button
        type="button"
        className="row-btn"
        aria-expanded={shown}
        onClick={() => setShown((v) => !v)}
      >
        <span className="glyph">
          <Icon name="project" />
        </span>
        <span>
          <strong>{t('Room preset')}</strong>
          <span className="sub">
            {t(
              'A ready room with its pieces against the walls: a bedroom, a home office, a kitchen and desk.',
            )}
          </span>
        </span>
        <Icon name={shown ? 'chevron-down' : 'chevron-right'} className="chev sm" />
      </button>
      {shown && (
        <ul className="home-list" aria-label={t('Room presets')}>
          {presets.map((pr) => (
            <li key={pr.id}>
              <button type="button" className="row-btn" onClick={() => void use(pr.template)}>
                <span className="glyph">
                  <Icon name="project" />
                </span>
                <span>
                  <strong>{pr.name}</strong>
                  <span className="sub">
                    {t('{n|# piece|# pieces}', { n: pr.template.items.length })}
                    {t(', with the room')}
                  </span>
                </span>
                <Icon name="chevron-right" className="chev sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Every board in this piece, the saw cut and the user's decor list (ADR-049), shown inline under Configure
 * (ADR-079; it was the Materials dialog).
 */
export function MaterialsPanel() {
  const materials = useDesign((s) => s.design.materials);
  const boardsLock = usePieceLockHint('boards');
  const kerf = useDesign((s) => kerfOf(s.design));
  const setKerf = useDesign((s) => s.setKerf);
  const update = useDesign((s) => s.updateMaterial);
  const add = useDesign((s) => s.addMaterial);
  const remove = useDesign((s) => s.removeMaterial);
  const [why, setWhy] = useState<{ id: string; text: string } | null>(null);
  // The user's decor list (ADR-049): the decor choice appears only once a list has been imported.
  const [decors, setDecors] = useState<Decor[]>([]);
  const [decorMsg, setDecorMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    listDecors()
      .then(setDecors)
      .catch(() => setDecors([]));
  }, []);
  // The user's band list (ADR-212, G-038): offered in each board's band editor once imported.
  const [bands, setBands] = useState<Band[]>([]);
  const [bandMsg, setBandMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    listBands()
      .then(setBands)
      .catch(() => setBands([]));
  }, []);
  const importBands = async (f: File) => {
    let text: string;
    try {
      text = await f.text();
    } catch {
      setBandMsg({ ok: false, text: t('{file} could not be read.', { file: f.name }) });
      return;
    }
    const r = parseBandList(text, f.name);
    if (!r.bands.length) {
      setBandMsg({
        ok: false,
        text: t('No bands imported. {problems}', { problems: r.problems.slice(0, 4).join(' ') }),
      });
      return;
    }
    try {
      await replaceBands(r.bands);
    } catch {
      setBandMsg({ ok: false, text: t('The band list could not be saved on this device.') });
      return;
    }
    setBands(r.bands);
    setBandMsg({
      ok: r.problems.length === 0,
      text: `${t('{n|# band|# bands} imported from {file}.', { n: r.bands.length, file: f.name })}${r.problems.length ? ` ${t('{n|# row|# rows} skipped: {problems}', { n: r.problems.length, problems: r.problems.slice(0, 4).join(' ') })}` : ''}`,
    });
  };
  const importDecors = async (f: File) => {
    let text: string;
    try {
      text = await f.text();
    } catch {
      setDecorMsg({ ok: false, text: t('{file} could not be read.', { file: f.name }) });
      return;
    }
    const r = parseDecorList(text, f.name);
    if (!r.decors.length) {
      setDecorMsg({
        ok: false,
        text: t('No decors imported. {problems}', { problems: r.problems.slice(0, 4).join(' ') }),
      });
      return;
    }
    try {
      await replaceDecors(r.decors);
    } catch {
      setDecorMsg({ ok: false, text: t('The decor list could not be saved on this device.') });
      return;
    }
    setDecors(r.decors);
    setDecorMsg({
      ok: r.problems.length === 0,
      text: `${t('{n|# decor|# decors} imported from {file}.', { n: r.decors.length, file: f.name })}${r.problems.length ? ` ${t('{n|# row|# rows} skipped: {problems}', { n: r.problems.length, problems: r.problems.slice(0, 4).join(' ') })}` : ''}`,
    });
  };
  const decorOptions = [
    { value: '', label: t('Not from the list') },
    ...decors.map((d) => ({
      value: d.id,
      label: t('{maker} {code} {name}, {n} mm', {
        maker: d.makerText,
        code: d.code,
        name: d.name,
        n: d.thickness,
      }),
    })),
  ];
  const decorOf = (m: Material) =>
    decors.find(
      (d) =>
        m.decor &&
        d.code === m.decor.code &&
        d.list === m.decor.list &&
        d.thickness === m.thickness,
    )?.id ?? '';
  return (
    <Group
      title={t('Boards, sheets and saw cut')}
      id="g-boards"
      defaultOpen={false}
      locked={boardsLock}
      info={
        <InfoTip label={t('About boards and sheets')}>
          {t(
            'Changing a thickness rebuilds every part made from that board. Colours and pictures only change how the board looks on screen.',
          )}
        </InfoTip>
      }
    >
      <MmField
        label={t('Saw cut (kerf)')}
        value={kerf}
        min={0}
        max={20}
        step={1}
        onChange={setKerf}
        info={
          <InfoTip label={t('About the saw cut')} align="start">
            {t('Material lost in every cut. Sheet length runs along the grain.')}
          </InfoTip>
        }
      />
      <div className="decor-list">
        <p className="hint">
          {decors.length
            ? t('Decor list: {list}, {n|# decor|# decors}.', {
                list: decors[0].list,
                n: decors.length,
              })
            : t('Decor list: none.')}{' '}
          <InfoTip label={t('About the decor list')} align="start">
            {decors.length
              ? t('Choose one on any board below.')
              : t(
                  'Import your own CSV with the columns {columns} (whole mm, #rrggbb) to choose decors on the boards.',
                  { columns: DECOR_COLUMNS },
                )}
          </InfoTip>
        </p>
        <div className="mat-picture-row">
          <label className="btn sm outline file-btn">
            <Icon name="upload" className="sm" />
            {t('Import decor list (CSV)')}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              aria-label={t('Import decor list (CSV)')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importDecors(f);
                e.target.value = '';
              }}
            />
          </label>
          {decors.length > 0 && (
            <button
              type="button"
              className="btn sm ghost"
              onClick={async () => {
                if (
                  !(await askConfirm(
                    t(
                      'Remove the decor list from this device? Boards keep their names, colours and labels.',
                    ),
                    { confirmLabel: t('Remove list'), danger: true },
                  ))
                )
                  return;
                await clearDecors();
                setDecors([]);
                setDecorMsg(null);
              }}
            >
              {t('Remove decor list')}
            </button>
          )}
        </div>
        {decorMsg && (
          <p
            className={`alert ${decorMsg.ok ? 'info' : 'error'}`}
            role={decorMsg.ok ? 'status' : 'alert'}
          >
            <Icon name={decorMsg.ok ? 'info' : 'alert-circle'} className="sm" />
            <span>{decorMsg.text}</span>
          </p>
        )}
      </div>
      <div className="decor-list">
        <p className="hint">
          {bands.length
            ? t('Band list: {list}, {n|# band|# bands}.', {
                list: bands[0].list,
                n: bands.length,
              })
            : t('Band list: none.')}{' '}
          <InfoTip label={t('About the band list')} align="start">
            {t(
              'Import your own CSV with the columns {columns} (thickness in mm with one decimal, width whole mm, #rrggbb; decor optional) to pick bands in each board’s edge band.',
              { columns: BAND_COLUMNS },
            )}
          </InfoTip>
        </p>
        <div className="mat-picture-row">
          <label className="btn sm outline file-btn">
            <Icon name="upload" className="sm" />
            {t('Import band list (CSV)')}
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              aria-label={t('Import band list (CSV)')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBands(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {bandMsg && (
          <p
            className={`alert ${bandMsg.ok ? 'info' : 'error'}`}
            role={bandMsg.ok ? 'status' : 'alert'}
          >
            <Icon name={bandMsg.ok ? 'info' : 'alert-circle'} className="sm" />
            <span>{bandMsg.text}</span>
          </p>
        )}
      </div>
      <ul className="materials">
        {materials.map((m: Material) => (
          <li key={m.id}>
            <input
              type="color"
              aria-label={t('{name} colour', { name: m.name })}
              value={m.color}
              onChange={(e) => update(m.id, { color: e.target.value })}
            />
            <input
              className="mat-name"
              aria-label={t('Name')}
              defaultValue={m.name}
              key={m.name}
              onBlur={(e) => e.target.value.trim() && update(m.id, { name: e.target.value.trim() })}
            />
            <MmField
              label={t('Thickness')}
              value={m.thickness}
              min={1}
              max={60}
              step={1}
              onChange={(v) => update(m.id, { thickness: v })}
            />
            <Toggle
              label={t('Has grain')}
              checked={m.grain}
              onChange={(v) => update(m.id, { grain: v })}
            />
            <Segmented
              label={t('Finish')}
              value={m.finish ?? 'matte'}
              options={FINISH_OPTIONS}
              onChange={(v) => update(m.id, { finish: v })}
            />
            <BoardProduct m={m} />
            <div className="sheet-fields">
              <Select
                label={t('Manufacturer')}
                value={m.maker ?? ''}
                options={[{ value: '', label: t('Not set') }, ...MAKER_OPTIONS]}
                onChange={(v) =>
                  update(m.id, { maker: (v || undefined) as MaterialMaker | undefined })
                }
              />
              <Select
                label={t('Type')}
                value={m.kind ?? ''}
                options={[{ value: '', label: t('Not set') }, ...KIND_OPTIONS]}
                onChange={(v) =>
                  update(m.id, { kind: (v || undefined) as MaterialKind | undefined })
                }
              />
              {decors.length > 0 && (
                <Select
                  label={t('Decor from your list')}
                  value={decorOf(m)}
                  options={decorOptions}
                  onChange={(v) => {
                    const d = decors.find((x) => x.id === v);
                    update(m.id, d ? decorPatch(d) : { decor: undefined });
                  }}
                />
              )}
            </div>
            <div className="sheet-fields">
              <MmField
                label={t('Sheet length')}
                value={sheetOf(m).length}
                min={300}
                max={6000}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), length: v } })}
              />
              <MmField
                label={t('Sheet width')}
                value={sheetOf(m).width}
                min={300}
                max={3000}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), width: v } })}
              />
              <MmField
                label={t('Trim each edge')}
                value={sheetOf(m).trim}
                min={0}
                max={50}
                step={1}
                onChange={(v) => update(m.id, { sheet: { ...sheetOf(m), trim: v } })}
              />
              <MmField
                label={t('Sheets in stock')}
                unit=""
                value={sheetOf(m).count ?? 0}
                min={0}
                max={999}
                step={1}
                hint={t('0 = buy as needed')}
                onChange={(v) =>
                  update(m.id, { sheet: { ...sheetOf(m), count: v === 0 ? null : v } })
                }
              />
            </div>
            <BoardBand key={`${m.id}-band`} m={m} bands={bands} />
            <MaterialPicture m={m} />
            <div className="mat-actions">
              <button
                type="button"
                className="btn sm outline"
                onClick={() => {
                  const r = remove(m.id);
                  setWhy(r ? { id: m.id, text: r } : null);
                }}
              >
                <Icon name="trash" className="sm" />
                {t('Remove board')}
              </button>
              {why?.id === m.id && (
                <p className="alert error" role="alert">
                  <Icon name="alert-circle" className="sm" />
                  <span>{why.text}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn outline"
        onClick={() =>
          add({ id: newId(), name: t('New board'), thickness: 18, grain: false, color: '#d8d4cc' })
        }
      >
        <Icon name="plus" />
        {t('Add a material')}
      </button>
    </Group>
  );
}

/**
 * ADR-048: any picture from this device as the board's look. It is scaled down and kept on this device only; the
 * plain colour becomes the picture's average colour and is shown wherever the picture cannot be.
 */
function MaterialPicture({ m }: { m: Material }) {
  const update = useDesign((s) => s.updateMaterial);
  const urls = useImageUrls(m.image?.id ?? '');
  const url = m.image ? urls.get(m.image.id) : undefined;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await importImage(file);
    setBusy(false);
    if (!r.ok) {
      setProblem(
        `${r.problem} ${m.image ? t('The board keeps its current picture.') : t('The board keeps its plain colour.')}`,
      );
      return;
    }
    update(m.id, { color: r.color, image: { ...r.image, turn: m.image?.turn } });
  };
  const img = m.image;
  return (
    <div className="mat-picture">
      <div className="mat-picture-row">
        {img && url && url !== 'missing' && (
          <img className="mat-thumb" src={url} alt={t('Picture of {name}', { name: m.name })} />
        )}
        <label className={`btn sm outline file-btn${busy ? ' disabled' : ''}`}>
          <Icon name="upload" className="sm" />
          {busy ? t('Preparing picture…') : img ? t('Replace picture') : t('Add a picture')}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            aria-label={
              img
                ? t('Replace picture for {name}', { name: m.name })
                : t('Add a picture for {name}', { name: m.name })
            }
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {img && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => update(m.id, { image: undefined })}
          >
            {t('Remove picture')}
          </button>
        )}
        {img && <span className="hint">{img.name}</span>}
      </div>
      {img && url === 'missing' && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>
            {t(
              'The picture {name} is not on this device. The plain colour is shown; add the picture again to see it.',
              { name: img.name },
            )}
          </span>
        </p>
      )}
      {problem && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{problem}</span>
        </p>
      )}
      {img && (
        <div className="sheet-fields">
          <MmField
            label={t('One picture covers, along the grain')}
            value={img.tileLength}
            min={1}
            max={MAX_TILE}
            onChange={(v) => update(m.id, { image: { ...img, tileLength: v } })}
          />
          <MmField
            label={t('One picture covers, across')}
            value={img.tileWidth}
            min={1}
            max={MAX_TILE}
            onChange={(v) => update(m.id, { image: { ...img, tileWidth: v } })}
          />
          <Toggle
            label={t('Turn picture 90°')}
            checked={!!img.turn}
            onChange={(v) => update(m.id, { image: { ...img, turn: v } })}
          />
        </div>
      )}
    </div>
  );
}
