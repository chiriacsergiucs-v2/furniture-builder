/**
 * The sheet nesting engine (ADR-018, ADR-279): a seeded guillotine placer and an independent validator. Pure
 * TypeScript with no imports outside this package. The Web Worker entry is reached through `./client`.
 */
export * from './types';
export { nest, DEFAULT_MAX_ATTEMPTS, SAFETY_MAX_MS } from './place';
export { validateNest } from './validate';
