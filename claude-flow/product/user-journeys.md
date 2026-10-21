# User journeys (as implemented)

1. **Plain cutlist**: new project → materials/sheets → add parts (CSV/XLSX or manual) → optimise → review SVG per
   board, stats, unplaced → export CSV/XLSX/print. (`src/app/App.tsx`, `src/import-export/*`)
2. **Furniture from template**: Presets → pick a ready template → configure in the wizard (shelves, drawers, split,
   doors, plinth) → see positioned 3D → save as preset (revision) → insert into a project → optimise. (`src/components/CabinetConfigurator.tsx`, `PresetManager.tsx`)
3. **Project-only customisation**: insert preset → *Customize for project* → edit isolated copy → explicit Save. (`src/presets/customize.ts`)
4. **Assembly tweak**: open assembly editor → move/rotate instances in integer mm/deg → export Fusion script. (`src/components/Assembly3DEditor.tsx`, `src/assembly/fusion.ts`)
5. **Backup / move device**: Settings → export full database JSON → import on other device (merge, no overwrite). (`src/db/backup.ts`)
6. **Upgrade from the localStorage era**: open app → automatic one-time migration → legacy keys untouched. (`src/db/migration.ts`)
