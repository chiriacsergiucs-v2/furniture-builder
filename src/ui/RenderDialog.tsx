import { useEffect, useRef, useState } from 'react';
import type { RenderJob } from '../viewer/pathtrace';
import { Segmented } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import {
  hasWebGL2,
  RENDER_SAMPLES,
  RENDER_SIZES,
  renderFileName,
  type RenderSize,
} from './renderSupport';

type State =
  | { kind: 'idle' }
  | { kind: 'rendering'; n: number }
  | { kind: 'done'; png: Blob }
  | { kind: 'failed'; message: string };

/**
 * Render a picture (ADR-067): path-traces what the 3D view shows and saves it as a PNG on this device. The path
 * tracer is loaded only from here, the first time Start is pressed.
 */
export function RenderDialog({
  open,
  onClose,
  name,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
}) {
  const [size, setSize] = useState<RenderSize>('1920x1080');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [supported] = useState(hasWebGL2);
  const job = useRef<RenderJob | null>(null);
  const holder = useRef<HTMLDivElement>(null);

  const stop = () => {
    job.current?.dispose();
    job.current = null;
    holder.current?.replaceChildren();
  };
  const close = () => {
    stop();
    setState({ kind: 'idle' });
    onClose();
  };
  useEffect(() => stop, []);

  const start = async () => {
    stop();
    const s = RENDER_SIZES.find((x) => x.value === size)!;
    setState({ kind: 'rendering', n: 0 });
    try {
      const { startRender } = await import('../viewer/pathtrace');
      const j = await startRender({
        width: s.width,
        height: s.height,
        samples: RENDER_SAMPLES,
        onProgress: (n) => setState((st) => (st.kind === 'rendering' ? { ...st, n } : st)),
      });
      job.current = j;
      j.canvas.className = 'render-canvas';
      j.canvas.setAttribute('aria-label', 'Rendered picture');
      holder.current?.replaceChildren(j.canvas);
      const png = await j.done;
      if (job.current !== j) return;
      setState(png ? { kind: 'done', png } : { kind: 'idle' });
    } catch (e) {
      stop();
      setState({ kind: 'failed', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const save = (png: Blob) => {
    const url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = renderFileName(name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const busy = state.kind === 'rendering';
  const footer = !supported ? null : (
    <>
      {busy ? (
        <button
          type="button"
          className="btn outline"
          onClick={() => {
            job.current?.cancel();
            stop();
            setState({ kind: 'idle' });
          }}
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          className={state.kind === 'done' ? 'btn outline' : 'btn solid'}
          onClick={start}
        >
          {state.kind === 'done' ? 'Render again' : 'Start'}
        </button>
      )}
      {state.kind === 'done' && (
        <button type="button" className="btn solid" onClick={() => save(state.png)}>
          <Icon name="download" className="sm" />
          Save PNG
        </button>
      )}
    </>
  );

  return (
    <Dialog open={open} onClose={close} title="Render a picture" footer={footer} wide>
      {!supported ? (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>Rendering needs WebGL 2 on this device</span>
        </p>
      ) : (
        <>
          <Segmented
            label="Size"
            value={size}
            options={RENDER_SIZES.map((s) => ({ value: s.value, label: s.label }))}
            onChange={(v) => !busy && setSize(v)}
          />
          <p className="hint">
            Renders what the 3D view shows, with realistic light. Best on a laptop; a phone may be
            slow. The picture stays on this device.
          </p>
          {busy && (
            <p className="status saving" role="status">
              Rendering… {state.n} / {RENDER_SAMPLES} samples
            </p>
          )}
          {state.kind === 'done' && (
            <p className="status saved" role="status">
              Done: {RENDER_SAMPLES} samples
            </p>
          )}
          {state.kind === 'failed' && (
            <p className="alert error" role="alert">
              <Icon name="alert-circle" className="sm" />
              <span>Could not render: {state.message}</span>
            </p>
          )}
          <div className="render-frame" ref={holder} />
        </>
      )}
    </Dialog>
  );
}
