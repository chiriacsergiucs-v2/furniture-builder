import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { Icon } from './icons';

/**
 * The app's own confirmation and text prompts (ADR-030, user decision 2026-10-23), replacing the browser's
 * confirm() and prompt(): same look as the app, Escape cancels, Enter confirms, focus returns afterwards.
 */
interface Ask {
  message: string;
  confirmLabel: string;
  danger: boolean;
  input?: string;
  resolve: (v: string | boolean | null) => void;
}
const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

export const askConfirm = (
  message: string,
  opts: { confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> =>
  new Promise((resolve) =>
    useAsk.setState({
      ask: {
        message,
        confirmLabel: opts.confirmLabel ?? 'OK',
        danger: !!opts.danger,
        resolve: (v) => resolve(v === true),
      },
    }),
  );

export const askText = (
  message: string,
  initial = '',
  confirmLabel = 'Save',
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
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ask && !d.open) {
      opener.current = document.activeElement;
      setText(ask.input ?? '');
      d.showModal();
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
      aria-label="Confirm"
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
              onClick={() => done(ask.input !== undefined ? null : false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${ask.danger ? 'danger solid' : 'primary'}`}
              autoFocus={ask.input === undefined}
            >
              {ask.confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
