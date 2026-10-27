import { useEffect, useState } from 'react';
import { codeLink, decodeCode, encodeCode, LINK_KEY } from '../core/shareCode';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { importDocument, type ImportResult } from './shell/importFile';

/** The app's address without its #part, for links. */
const appBase = () => (typeof location === 'undefined' ? '' : location.href.split('#')[0]);

const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined);

/**
 * Copy code (ADR-124): the open project (or design) as a text code and a link that opens it on another device. Made
 * on this device from the saved document; nothing is sent anywhere (ADR-002).
 */
export function CopyCodeDialog({ onClose }: { onClose: () => void }) {
  const project = useDesign((s) => s.project);
  const design = useDesign((s) => s.design);
  const editingItemId = useDesign((s) => s.editingItemId);
  const doc = project && !editingItemId ? project : design;
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    encodeCode(doc).then(
      (c) => live && setCode(c),
      () => live && setCode(''),
    );
    return () => {
      live = false;
    };
  }, [doc]);
  const link = code ? codeLink(appBase(), code) : '';
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Code for ${doc.name}`}
      info={
        <InfoTip label="About design codes" align="start">
          Paste the code in Open from code on another device, or open the link there. Pictures and
          3D models stay on this device; a project file carries them.
        </InfoTip>
      }
      footer={
        <button type="button" className="btn solid" onClick={onClose}>
          Done
        </button>
      }
    >
      {code === null ? (
        <p className="loading">Making the code…</p>
      ) : code === '' ? (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>This browser cannot make codes.</span>
        </p>
      ) : (
        <div className="share-code">
          <label className="field">
            <span className="field-label">Code</span>
            <textarea readOnly rows={4} value={code} onFocus={(e) => e.target.select()} />
          </label>
          <label className="field">
            <span className="field-label">Link</span>
            <textarea readOnly rows={3} value={link} onFocus={(e) => e.target.select()} />
          </label>
          <div className="split-actions">
            <button
              type="button"
              className="btn outline"
              onClick={() => {
                void copy(code);
                setCopied('Code copied.');
              }}
            >
              <Icon name="copy" className="sm" />
              Copy code
            </button>
            <button
              type="button"
              className="btn outline"
              onClick={() => {
                void copy(link);
                setCopied('Link copied.');
              }}
            >
              <Icon name="copy" className="sm" />
              Copy link
            </button>
          </div>
          {copied && (
            <p className="hint" role="status">
              {copied}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** A code or link read, validated and opened as a new copy (ADR-124); the message when it did not open. */
async function openCode(text: string): Promise<ImportResult> {
  const r = await decodeCode(text);
  if (!r.ok) return { opened: false, message: { ok: false, text: r.error } };
  return importDocument(r.doc);
}

/** Open from code on Projects (ADR-124): paste a code or a link; it opens as a new copy on this device. */
export function OpenFromCode({
  onOpened,
  onMessage,
}: {
  onOpened: () => void;
  onMessage: (m: { ok: boolean; text: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await openCode(text);
    setBusy(false);
    if (r.opened) {
      setOpen(false);
      setText('');
      if (r.message) onMessage(r.message);
      onOpened();
      return;
    }
    setError(r.message?.text ?? 'That code could not be opened.');
  };
  return (
    <>
      <button
        type="button"
        className="btn outline lg"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="download" />
        Open from code
      </button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Open a code"
          info={
            <InfoTip label="About opening a code" align="start">
              A code made with Copy code on any device. It opens as a new copy saved on this device.
            </InfoTip>
          }
          footer={
            <>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn solid"
                disabled={!text.trim() || busy}
                onClick={() => void submit()}
              >
                Open
              </button>
            </>
          }
        >
          <label className="field share-code">
            <span className="field-label">Code or link</span>
            <textarea
              rows={5}
              value={text}
              aria-invalid={!!error}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
          </label>
          {error && (
            <p className="alert error" role="alert">
              <Icon name="alert-circle" className="sm" />
              <span>{error}</span>
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}

/**
 * A link `…#open=<code>` (ADR-124): asks, then opens the code as a new copy. The #part is cleared first, so a reload
 * does not ask again.
 */
export function useOpenLink(
  onOpened: () => void,
  onMessage: (m: { ok: boolean; text: string } | null) => void,
) {
  useEffect(() => {
    if (typeof location === 'undefined' || !location.hash.startsWith(LINK_KEY)) return;
    const text = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    void (async () => {
      if (
        !(await askConfirm(
          'Open the design from this link? It is saved on this device as a new copy.',
          { confirmLabel: 'Open' },
        ))
      )
        return;
      const r = await openCode(text);
      if (r.message) onMessage(r.message);
      if (r.opened) onOpened();
    })();
    // Runs again when the callbacks change, but the #part is gone by then: once per link.
  }, [onOpened, onMessage]);
}
