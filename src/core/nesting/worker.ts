/**
 * Web Worker entry for sheet nesting (ADR-0018): the placer runs off the main thread.
 * Request {id, jobs, options?} → reply {id, results} or {id, error}. Uses only `self`; no DOM.
 */
import { nest } from './place'
import type { NestJob, NestOptions, NestResult } from './types'

export interface NestRequest { id: number | string; jobs: NestJob[]; options?: NestOptions }
export type NestResponse = { id: number | string; results: NestResult[] } | { id: number | string; error: string }

const ctx = self as unknown as {
  onmessage: ((e: { data: NestRequest }) => void) | null
  postMessage: (msg: NestResponse) => void
}

ctx.onmessage = e => {
  const { id, jobs, options } = e.data
  try {
    ctx.postMessage({ id, results: jobs.map(j => nest(j, options)) })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
