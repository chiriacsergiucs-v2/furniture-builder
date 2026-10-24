import { useEffect, useRef, useState } from 'react';
import type { CutRow } from '../core/cutlist';
import { nest } from '../core/nesting';
import type { NestJob, NestResult } from '../core/nesting/types';
import type { NestResponse } from '../core/nesting/worker';
import { useView } from './useView';

export type NestState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; results: NestResult[]; jobs: NestJob[]; rows: CutRow[] }
  | { status: 'error'; error: string };

/**
 * Lay out sheets in a Web Worker whenever the design changes while the Sheets tab is open (ADR-018).
 * Falls back to the main thread if workers are unavailable. Designs with errors are never laid out.
 */
export function useNesting(active: boolean): NestState & { blocked: boolean } {
  const view = useView();
  const [state, setState] = useState<NestState>({ status: 'idle' });
  const worker = useRef<Worker | null>(null);
  const req = useRef(0);
  const blocked = view.diagnostics.some((d) => d.severity === 'error');

  useEffect(() => {
    if (!active || blocked) return;
    const timer = setTimeout(() => {
      const jobs = view.jobs(),
        rows = view.rows;
      const id = ++req.current;
      setState({ status: 'running' });
      const finish = (msg: NestResponse) => {
        if (msg.id !== id) return;
        setState(
          'results' in msg
            ? { status: 'done', results: msg.results, jobs, rows }
            : { status: 'error', error: msg.error },
        );
      };
      try {
        worker.current ??= new Worker(new URL('../core/nesting/worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.current.onmessage = (e: MessageEvent<NestResponse>) => finish(e.data);
        worker.current.onerror = () =>
          finish({ id, error: 'The sheet layout could not run in this browser.' });
        worker.current.postMessage({ id, jobs });
      } catch {
        try {
          finish({ id, results: jobs.map((j) => nest(j)) });
        } catch (err) {
          finish({ id, error: String(err) });
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [active, blocked, view]);

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );
  return { ...state, blocked };
}
