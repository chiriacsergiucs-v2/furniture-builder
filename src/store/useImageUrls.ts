/**
 * One object URL per stored picture, shared between the views (ADR-048), for the 3D view and the ui alike: the viewer
 * reads it from here, never from `src/ui` (ADR-230). ADR-223 moves the hook out of `src/persist`; it then lives in
 * this file.
 */
export { imageKey, useImageUrls, type ImageUrl } from '../persist/images';
