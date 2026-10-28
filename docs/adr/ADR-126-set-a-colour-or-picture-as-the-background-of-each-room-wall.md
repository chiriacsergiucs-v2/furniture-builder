# ADR-126: Set a colour or picture as the background of each room wall

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-048, ADR-058, ADR-059
- Design: docs/ui-design.md (room editor in the project Settings; 3D view)
- Backlog: N127
- Acceptance: browser

## Context

User 2026-10-28: "Set wall background adr". Answers the same day: a **colour or a picture**, shown in the **3D view
and the front view**, set **per wall**, with a **toggle** between solid and see-through walls.

Today the room walls (ADR-058, ADR-059) are a fixed see-through grey in 3D (`#c9cdc8`, 28 % opacity,
`src/viewer/Viewer3D.tsx` `RoomWalls`) and are not drawn in the front view. Board pictures (ADR-048) already store a
picture from the device in the `images` table and keep only a reference in the document; this ADR reuses that.

## Decision

1. **Model (ADR-011).** `Room` gets an optional `walls?: WallFinish[]`, one entry per wall that has a background:
   `{ wall: number; colour?: string; image?: { id; name; tileWidth: Mm; tileHeight: Mm } }`. `wall` is the
   outline index, the same convention room features use. Absent = today's grey. Project `schemaVersion` 14; versions
   1–13 still load unchanged. `validateProject` reports a bad entry (unknown wall, bad colour, size < 1 mm) as a
   problem, never throws. A wall removed by redrawing the room drops its finish, as features on it do today.
2. **Pictures.** Wall pictures go in the existing `images` table (no new Dexie version). Project files with pictures
   (`withPictures`) also carry wall pictures; the unused-picture cleanup already keeps any id found in a saved row.
3. **Room editor.** Under _Walls_, each `Wall N` row gets a _Background_ control: _None_, _Colour_ (colour field)
   or _Picture_ (pick from the device, as for boards). A picture repeats; one copy covers _Tile width_ × _Tile height_
   mm, set by the user, starting at the picture's own proportions, 1000 mm wide, with the hint "Set the real size"
   (G-214, user 2026-10-28).
4. **3D view.** `RoomWalls` paints each wall's inner face with its colour or repeating picture, to scale. A
   _Solid walls_ switch changes walls between see-through and opaque. It is a 3D view setting on this device, not
   saved in the project, starting see-through (G-215, user 2026-10-28). Walls stay display-only, never picked.
5. **Front view.** Behind a piece in a project with a room, the front view fills the background with the finish of
   the wall the piece's back stands against (back on the wall line, same tolerance as wall snapping, ADR-070),
   from the floor to the room height. No background when the piece stands against no wall or the project has no
   room (G-213, user 2026-10-28). Pieces draw on top, unchanged.

## Alternatives considered

- **One background for the whole room** — simpler (−30 % effort, estimate), but the user chose per wall.
- **Colour only** — no picture handling, but the user asked for colour or picture.
- **A new `wallImages` table** — needs a Dexie version for no gain; the `images` table already fits.

## Scope

- In scope: per-wall colour or picture in the room editor; saved in the project; shown in 3D and the front view; a
  solid / see-through switch; project files carry wall pictures.
- Out of scope: the 2D floor plan, SVG download, catalog snapshots and cut sheets (G-216); the floor (G-217).

## Consequences

- Positive: a room that looks like the real one, with tiles or paint behind the pieces.
- Negative / risks: opaque walls can hide pieces from some camera angles (hence the switch); pictures make project
  files bigger.
- Harder to change later: the `walls` field on `Room` and project schemaVersion 14.

## Done when

- [ ] A project with wall finishes round-trips through save, export and import; versions 1–13 still load; bad
      entries give a validation problem, not an exception (tests)
- [ ] Redrawing the room drops finishes of walls that no longer exist (test)
- [ ] An exported project file carries wall pictures; the unused-picture cleanup keeps them (storage test)
- [ ] Find-it (browser, 390 and 1280 px): Settings › Room › _Wall 1_ › _Background_ › _Colour_ changes the wall
      colour in 3D; _Picture_ shows the picked picture on that wall
- [ ] Find-it: _Solid walls_ switches walls between see-through and opaque in 3D
- [ ] Find-it: the front view of a piece against Wall 1 shows Wall 1's background behind the piece
- [ ] `pnpm docs:check` and every CI check pass

## Open questions

None. Answered by the user 2026-10-28: G-213 (wall behind, floor to room height), G-214 (user-set tile size in mm),
G-215 (view setting on this device, starts see-through). Build not yet approved ("Not yet").
