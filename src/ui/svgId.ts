/** An id safe inside an SVG `id` and a `url(#…)` reference: React's `useId()` result has colons. */
export const svgId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');
