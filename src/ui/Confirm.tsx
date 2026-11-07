import { useEffect, useRef, useState } from 'react';
import { t } from '../core/i18n';
import { Icon } from './icons';
import { useAsk } from '../store/confirmStore';

/**
 * The app's own confirmation and text prompts (ADR-030); the question on screen lives in `useAsk` (src/store).
 */

export const askConfirm = (
  message: string,
  opts: {
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    cancelFirst?: boolean;
  } = {},
): Promise<boolean> =>
  new Promise((resolve) =>
    useAsk.setState({
      ask: {
        message,
        confirmLabel: opts.confirmLabel ?? t('OK'),
        cancelLabel: opts.cancelLabel,
        danger: !!opts.danger,
        cancelFirst: !!opts.cancelFirst,
        resolve: (v) => resolve(v === true),
      },
    }),
  );

export const askText = (
  message: string,
  initial = '',
  confirmLabel = t('Save'),
): Promise<string | null> =>
  new Promise((resolve) =>
    useAsk.setState({
      ask: {
        message,
        confirmLabel,
        danger: false,
        input: initial,
        resolve: (v) => resolve(typeof v === 'string' ? v : null),
      },
    }),
  );

export function ConfirmHost() {
  const ask = useAsk((s) => s.ask);
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const opener = useRef<Element | null>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) {
      opener.current = document.activeElement;
      setText(ask.input ?? '');
      d.showModal();
      // The default answer takes the focus, so Enter gives it: Keep when the safe answer is the default (G-469).
      if (ask.input === undefined) (ask.cancelFirst ? cancelBtn : okBtn).current?.focus();
    }
    if (!ask && d.open) d.close();
  }, [ask]);
  const done = (v: string | boolean | null) => {
    ask?.resolve(v);
    useAsk.setState({ ask: null });
    (opener.current as HTMLElement | null)?.focus?.();
  };
  return (
    <dialog
      ref={ref}
      className="dialog confirm"
      aria-label={t('Confirm')}
      onCancel={(e) => {
        e.preventDefault();
        done(ask?.input !== undefined ? null : false);
      }}
    >
      {ask && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            done(ask.input !== undefined ? text.trim() || null : true);
          }}
        >
          <div className="dialog-body">
            <p className="confirm-msg">
              {ask.danger && <Icon name="alert-triangle" className="sm" />}
              {ask.message}
            </p>
            {ask.input !== undefined && (
              <input
                id="ask-text"
                aria-label={ask.message}
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="btn outline"
              ref={cancelBtn}
              onClick={() => done(ask.input !== undefined ? null : false)}
            >
              {ask.cancelLabel ?? t('Cancel')}
            </button>
            <button
              type="submit"
              className={`btn ${ask.danger ? 'danger solid' : 'primary'}`}
              ref={okBtn}
            >
              {ask.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
