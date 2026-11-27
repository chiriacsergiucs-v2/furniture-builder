/**
 * Projects (ADR-022): several pieces placed in a room, cut and bought together. Each item embeds its own copy of a
 * design (library edits never flow in by themselves).
 *
 * This file only re-exports the project's files (G-548, ADR-306), so code outside src/core keeps one import:
 * `projectDoc` (the document, its types and schema versions), `projectPlace` (a piece placed in the room),
 * `projectMove` (placing, dragging, turning, locking), `projectRuns` (runs, run parts, worktop cut-outs),
 * `projectModel` (the whole room built as one model), and `projectValidate`, `projectProfiles`, `projectWorktops`.
 * Files in src/core import the file that defines a name, never this one.
 */
export * from './projectDoc';
export * from './projectPlace';
export * from './projectMove';
export * from './projectRuns';
export * from './projectModel';
export * from './projectValidate';
export * from './projectProfiles';
export * from './projectWorktops';
