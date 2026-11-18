/**
 * Main-thread side of the nesting worker (ADR-018, ADR-279). The worker URL is built here, inside the package, so
 * Vite emits the worker chunk from the package's own `worker.ts`. Throws where `Worker` is missing (jsdom, old
 * browsers); callers fall back to `nest` on the main thread.
 */
export type { NestResponse } from './worker';

export const createNestWorker = (): Worker =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
