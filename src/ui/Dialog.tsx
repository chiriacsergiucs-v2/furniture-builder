import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@furniture-builder/i18n';
import { useUi } from '../store/uiStore';
import { Icon } from './icons';

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
        // A form opened inside the sheet (a modal dialog of its own) closes itself on Esc; the sheet stays (G-519, N318).
        if ((e.target as HTMLElement).closest('dialog') !== ref.current) return;
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
