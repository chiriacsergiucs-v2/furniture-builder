/** Inline outline icons (24-unit grid, 1.75 stroke, round caps) — same drawing style as the brand mark. No icon font. */
const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  upload: 'M12 19V8m0 0 4 4m-4-4-4 4M4 5h16',
  printer:
    'M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v6H6z',
  share: 'M12 3v12m0-12 4 4m-4-4-4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  x: 'M6 6l12 12M18 6 6 18',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  check: 'm5 12 4 4L19 7',
  'alert-triangle': 'M12 3 2 20h20zM12 9v5m0 3h.01',
  'alert-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5m0 3h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5m0-8h.01',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h11v11H9zM5 15V5a2 2 0 0 1 2-2h10',
  pencil: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  front: 'M4 4h16v16H4z',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  box: 'M4 3h16v18H4zM4 9h16M4 15h16',
  /* template glyphs */
  chest: 'M4 3h16v18H4zM4 9h16M4 15h16M11 6h2M11 12h2M11 18h2',
  bookcase: 'M4 3h16v18H4zM4 8h16M4 13h16M4 18h16',
  'base-door': 'M4 3h16v18H4zM4 18h16M15 10v3',
  sideboard: 'M3 6h18v12H3zM9 6v12M15 6v12M11 11h2M11 13h2',
  wardrobe: 'M5 2h14v20H5zM12 2v20M10 11v2M14 11v2',
  'wall-cabinet': 'M4 5h16v12H4zM12 5v12M10 10v2M14 10v2M3 21h18',
  'corner-blind': 'M4 4h16v9h-7v7H4zM4 10h9',
  'corner-l': 'M4 4h16v9h-7v7H4zM13 13 4 4',
  'desk-pedestal': 'M3 7h18M4 7v12M20 7v12M13 7v12M13 11h7M13 15h7',
  'desk-gables': 'M3 7h18M5 7v12M19 7v12',
  project: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  table: 'M3 8h18M5 8v12M19 8v12M5 12h14',
  bed: 'M3 18V7M21 18v-5H3M3 13V9h7v4M3 18h18',
  chair: 'M7 3v18M7 12h10v9M7 12V3M17 12v-2',
  panel: 'M7 3h10v18H7zM14 6v3',
  catalog: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  home: 'M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4 4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
