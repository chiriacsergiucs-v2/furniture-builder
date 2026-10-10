# Furniture Builder — Mobila Cutlist Optimizer

Mobile-first, client-side 2D guillotine cutting optimizer for PAL, MDF, plywood and configurable stock sheets.

## Project status (2026-10-10)
Development in progress, not yet released. A TypeScript solver prototype was tested locally with **12/12 standalone tests passing** (including 200 fuzz cases). React/TypeScript/Vite full build, browser E2E, offline/PWA and GitHub Pages are **not yet verified**. The build environment could not download npm dependencies.

## Architecture
- React + TypeScript + Vite; localStorage; Web Worker; SVG diagrams.
- No backend, database, account registration or cloud data transfer.
- Coordinates and panel dimensions in integer mm.
- Recursive guillotine cut-tree checked by an independent validator.
- Data exports: JSON, CSV, SVG, browser print/PDF, generic XLSX (lazy ExcelJS).
- Regency workbook adapter awaits original `SABLON DEBITARE NOU.xlsx`.

## Deployment
Target URL after deployment: https://chiriacsergiucs-v2.github.io/furniture-builder/

The repository is presently private. GitHub Pages availability for this private repository depends on account/repository settings. Do not claim a live deployment until verified.

## Resumption
Read `docs/progress.json`, `docs/handoff.md`, then `AGENTS.md` before continuing.
