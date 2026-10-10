# Furniture Builder — Mobila Cutlist Optimizer

Prototype of a mobile-first, offline-oriented furniture panel cutting optimizer using React, TypeScript, Vite and a Web Worker. Source files and docs track `chiriacsergiucs-v2/furniture-builder` and GitHub Pages base `/furniture-builder/`.

## Features implemented in source

Project editor, PAL/MDF/custom materials, configurable sheets/quantities/trims, parts, grain, rotation, four-edge ABS, localStorage, version-1 JSON backups, CSV/XLSX generic import, SVG/print/PDF/CSV/XLSX exports, multi-restart heuristic guillotine optimizer and independent cut-tree validation.

## Reusable cutlist presets

In a project editor, open **Presets**. Choose **Create preset**, name it (for example, Drawer top), add as many labeled cut items as needed, and save. Set how many complete sets to add, then choose **Add to project**. Parts are copied with new IDs and multiplied quantities; you can edit them independently. **Save project parts as preset** builds a preset from the current project cutlist. Material type, thickness, and finish must match a compatible project material; ambiguous or missing materials are reported without partial insertion. Presets are saved separately in browser localStorage, remain available across projects and reloads, and support JSON export/import. They are not part of individual project JSON backups.

## Development

Node >=22 required. `npm install` then `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test:kernel`, `npm test`, `npm run build`, `npm run test:e2e`. No lockfile was generated in the sandbox because registry network access was blocked. Make and commit one before release, then switch CI/deploy to `npm ci`.

Without dependencies the engine test can run with `npm run test:kernel` (Node built-in test runner and strip-types).

## State and resumption

Read `docs/progress.json`, `docs/handoff.md`, `docs/verification-log.md`, `AGENTS.md` and `CUTLIST_OPTIMIZER_RESUMABLE_BUILD_PROMPT_v2.md`. **Source is a prototype; production verification is incomplete.** Full UI build, Android/PWA offline tests, and Pages deployment have not been confirmed.

## Privacy and licensing

MIT-licensed application source. No backend/database/accounts/remote optimization, and no data leaves the browser during application use. Validate exact fabrication constraints and dimensions before cutting. Third-party licence inventory pending dependency audit.
