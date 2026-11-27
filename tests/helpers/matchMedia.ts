/** A `window.matchMedia` stub for jsdom unit tests: every query answers `matches()` (G-570 M9). */
export function stubMatchMedia(matches: () => boolean = () => false) {
  window.matchMedia = ((q: string) =>
    ({
      matches: matches(),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }) as never) as never;
}
