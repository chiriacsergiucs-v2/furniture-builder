// The assistant dialog (ADR-239, ADR-240): the switch, the consent, the chat, the preview and Apply / Discard.
import { useState, type FormEvent } from 'react';
import { t } from '../core/i18n';
import { useAccount } from '../store/accountStore';
import { useAssistant } from '../store/assistantStore';
import { Dialog } from './Dialogs';

function Consent() {
  const accept = useAssistant((s) => s.accept);
  const setEnabled = useAssistant((s) => s.setEnabled);
  return (
    <section className="assistant-consent" aria-label={t('Before you start')}>
      <p>
        {t(
          'The assistant sends your message, the open piece or project and what is selected to this app’s server, which passes them to an AI model provider (Anthropic). Pictures, other projects and your saved data are not sent. Each request costs the app’s owner money, and there is a daily limit per account.',
        )}
      </p>
      <p className="hint">
        {t('It shows each change before anything happens; you choose Apply or Discard.')}
      </p>
      <div className="row">
        <button type="button" className="btn primary" onClick={accept}>
          {t('Accept and start')}
        </button>
        <button type="button" className="btn" onClick={() => setEnabled(false)}>
          {t('No, turn it off')}
        </button>
      </div>
    </section>
  );
}

function PreviewCard() {
  const preview = useAssistant((s) => s.preview);
  const summary = useAssistant((s) => s.summary);
  const apply = useAssistant((s) => s.apply);
  const discard = useAssistant((s) => s.discard);
  if (!preview) return null;
  return (
    <section className="card assistant-preview" aria-label={t('Proposed change')}>
      <div className="card-title">
        <span>{t('Proposed change')}</span>
      </div>
      <p>{summary}</p>
      {preview.changes.length ? (
        <ul className="assistant-changes">
          {preview.changes.map((c, i) => (
            <li key={i}>
              <span className="assistant-path">{c.path}</span>{' '}
              <span className="num">
                {c.before} → {c.after}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{t('This plan changes nothing in the design.')}</p>
      )}
      {preview.diagnostics.map((d, i) => (
        <p key={i} className={`alert ${d.severity === 'error' ? 'error' : 'warning'}`} role="alert">
          <strong>{d.severity === 'error' ? t('Error') : t('Warning')}:</strong> {d.message}
        </p>
      ))}
      {preview.notes.map((n, i) => (
        <p key={i} className="hint">
          {n}
        </p>
      ))}
      <div className="row">
        <button type="button" className="btn primary" onClick={apply}>
          {t('Apply')}
        </button>
        <button type="button" className="btn" onClick={discard}>
          {t('Discard')}
        </button>
      </div>
    </section>
  );
}

function Chat() {
  const lines = useAssistant((s) => s.lines);
  const busy = useAssistant((s) => s.busy);
  const send = useAssistant((s) => s.send);
  const signedIn = useAccount((s) => !!s.user);
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = text;
    setText('');
    void send(v);
  };
  return (
    <>
      {!lines.length && (
        <p className="hint">
          {t(
            'Write what you want, e.g. “make the wardrobe 1000 wide and add two drawers on the left”.',
          )}
        </p>
      )}
      <ol className="assistant-chat" aria-label={t('Conversation')}>
        {lines.map((l, i) => (
          <li
            key={i}
            className={`assistant-line ${l.role}`}
            role={l.role === 'error' ? 'alert' : undefined}
          >
            <strong>{l.role === 'user' ? t('You') : t('Assistant')}:</strong> {l.text}
          </li>
        ))}
      </ol>
      {busy && (
        <p className="status saving" role="status">
          {t('Thinking…')}
        </p>
      )}
      <PreviewCard />
      {!signedIn && <p className="hint">{t('Sign in to use the assistant.')}</p>}
      <form className="assistant-input" onSubmit={submit}>
        <label htmlFor="assistant-text">{t('Your request')}</label>
        <textarea
          id="assistant-text"
          className="input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="btn" disabled={busy || !text.trim() || !signedIn}>
          {t('Send')}
        </button>
      </form>
    </>
  );
}

export function AssistantDialog() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const enabled = useAssistant((s) => s.enabled);
  const consented = useAssistant((s) => s.consented);
  const setEnabled = useAssistant((s) => s.setEnabled);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('Assistant')} wide>
      <label className="toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (e.target.checked) setOpen(true);
          }}
        />
        {t('Use the assistant on this device')}
      </label>
      {!enabled ? (
        <p className="hint">{t('The assistant is off. Nothing is sent anywhere.')}</p>
      ) : !consented ? (
        <Consent />
      ) : (
        <Chat />
      )}
    </Dialog>
  );
}
