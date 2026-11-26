/** `v` held within `[lo, hi]`. For the places a range is the documented behaviour; user input is never clamped silently (ADR-008). */
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
