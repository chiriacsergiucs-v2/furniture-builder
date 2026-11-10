# UI audit 10 — Room and walls: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Room and walls (`src/ui/info/features.ts:785-859`, 14 feature lines)
- ADR: [ADR-257](../adr-done/ADR-257-ui-audit-room-name-the-field-one-tap-one-corner.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (core and
  store in node with `fake-indexeddb`, the Room section in jsdom over `tests/find-it/setup.tsx` at 1280 and 390 px).
  No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The Room section is `RoomSection`
(`src/ui/Project.tsx:3220-3409`), rendered in the project's Compose panel (`Project.tsx:544`); on a phone the panel is
the bottom sheet (`openSheet`, `tests/find-it/setup.tsx:118-124`). The room fold is closed by default
(`Project.tsx:3270`).

| #   | Feature line (features.ts)                        | Sub-flow: entry → steps → end state                                                                                                                                       | Code                                                                                                       | Covering test                                                                    | P/D |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | Room size, doors, windows and obstacles (:789)    | Project → Compose → Room → Add the room → fold → Shape, sizes, Room height, Wall N lengths → `setRoom`; Add door / window / obstacle → fields per feature → Remove …     | `Project.tsx:3220-3409`, `RoomFeatures.tsx:81-198`, store `designStore.ts:1899-1909`, core `room.ts:518-660` | `tests/room.test.ts`, `tests/find-it/room-suggested-size.test.tsx`               | P D |
| 2   | Draw the floor plan (:794)                        | Room → Draw the room (again) → banner "Tap the corners…" → taps on the plan → Close the room → `finishDrawRoom` (one undo step); Use a ready shape instead               | `Project.tsx:1546-1566`, `:1960-1963`, store `designStore.ts:1910-1935`, core `room.ts:808-831`             | `tests/room.test.ts:285-310`                                                     | P D |
| 3   | Pipes and outlets (:799)                          | Room → Add pipe / Add outlet → On (wall), From the wall's start, Width, Bottom above floor, Height → checks against backs, plinths, worktops                               | `RoomFeatures.tsx:53-66`, core `room.ts:740-770`, `project.ts:1768-1779`                                   | `tests/room.test.ts`                                                             | P D |
| 4   | Wall colour or picture (:801)                     | Room → Walls → Wall N background None / Colour / Picture → colour input or Add a picture → `applyWallFinish`                                                             | `WallBackground.tsx:21-203`, `wallFinishTarget.ts`                                                         | `tests/find-it/room-surfaces.test.tsx`                                           | P D |
| 5   | Fit, shift and straighten a wall picture (:808)   | Wall N picture → Fill wall / Straighten photo (dialog, four handles, arrow keys) → Apply / Reset; 3D → Adjust wall picture                                              | `WallBackground.tsx:150-200`, `StraightenPhoto.tsx:36-164`, `src/viewer/Viewer3D.tsx:524`                  | `tests/wall-picture-fit.test.ts`                                                 | P D |
| 6   | Wall colour bands on the plan (:813)              | A wall with a finish → a 50 mm band on the plan                                                                                                                           | `RoomSurfaces.tsx:128-145`, `Project.tsx:2417`                                                             | `tests/room-surfaces.test.ts`                                                    | P D |
| 7   | Floor colour or picture (:819)                    | Room → Floor background None / Colour / Picture → `setRoom({ …floor })`                                                                                                  | `RoomSurfaces.tsx:200-295`, `FloorFill` `:94-125`, `Project.tsx:2416`                                      | `tests/room-surfaces.test.ts`, `tests/find-it/room-surfaces.test.tsx`            | P D |
| 8   | Wall behind a single piece (:826)                 | Open a project piece in a room → its front view shows the wall behind                                                                                                     | `WallBehind.tsx:18-68`, `Elevation.tsx:163`                                                                | `tests/find-it/room-surfaces.test.tsx`                                           | P D |
| 9   | Board pictures on the plan (:833)                 | A piece whose top board has a picture → pattern fill on the plan                                                                                                         | `RoomSurfaces.tsx:150-197`, `Project.tsx:1683`                                                             | `tests/room-surfaces.test.ts`                                                    | P D |
| 10  | Trace a plan picture (:839)                       | Room → Plan picture → Add a plan picture → Set the scale → two taps (banner "{n} of 2") → Known length → Show the plan picture → Remove the plan picture                  | `RoomSurfaces.tsx:302-394`, `Project.tsx:1535-1545`, store `designStore.ts:1945-1958`, core `planPicture.ts` | `tests/room-surfaces.test.ts`, `tests/find-it/room-surfaces.test.tsx`            | P D |
| 11  | Opening clearances (:846)                         | Pieces with doors, drawers, flaps → zones checked against walls and pieces → Clear. toggle draws them                                                                    | core `src/core/clearance.ts`, `Clearances.tsx:166-273`, `Project.tsx:1870,2233`                            | `tests/clearance.test.ts`                                                        | P D |
| 12  | Chair, installation and service clearances (:852) | Selected piece → Clearance zones: Chair space depth, Service zone + depth, Assembled lying down → `updateItem`                                                            | `Clearances.tsx:19-164`, `Project.tsx:533`, core `src/core/envelopes.ts`                                   | `tests/envelopes.test.ts`                                                        | P D |
| 13  | Clearance zones in 3D (:856)                      | 3D view with clearances on → zones drawn                                                                                                                                  | `src/viewer/Viewer3D.tsx`                                                                                  | no find-it test found in jsdom (3D is stubbed, `setup.tsx:27`)                   | P D |
| 14  | Backs cut around pipes and outlets (:857)         | A piece whose back meets a pipe or outlet → "Cut the back around it" → back cut                                                                                           | core `project.ts:207,1079`                                                                                 | `tests/room.test.ts`                                                             | P D |

## Bug hunt

Each check of the brief was applied to every sub-flow: empty / error / storage failure / undo / reload, double tap,
edge input (0, negative, huge, L/U/alcove), i18n, accessibility, 390 px, ADR-004, ADR-008, selector stability,
persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited, not
run), **Suspected**.

### D10-F1 — A ready shape's wrong size is named as a wall problem, and no field is marked (Proven, major)

The project's Room section builds the outline straight from the typed sizes (`Project.tsx:3229-3242`,
`shapeOutline`, `room.ts:193-233`) and shows only `outlineIssues` under the fold (`Project.tsx:3243`, `:3396-3400`).
The sizes check that names the field, `checkRoomSizes` (`room.ts:246-283`, ADR-193 item 2), runs only in Fill the room
(`RoomFill.tsx:369`). The `MmField` bounds (`Project.tsx:3326-3346`: 100–20000) accept a cut-out as wide as the room.
Reproduced (jsdom, both widths): Create project → Add the room → L-shape → Cut-out width 3000 →
`D10-F1 @1280 value=3000 aria-invalid=false warnings= [ 'Wall 5 has no length.' ]`, same at 390. In core the same sizes
give `checkRoomSizes` → `cutWidth: Cut width 3000 mm must be less than the width, 3000 mm.`; 3500 gives
`Walls 3 and 6 cross.` The user typed a cut-out width and is told about wall 5.

### D10-F2 — Room problems name doors, windows, pipes and outlets in English when the app is in Russian (Proven, minor)

Feature labels are stored in English (`RoomFeatures.tsx:11-18`, "stored in the project, so kept in English") and shown
through `tr()` in the list and on the plan (`RoomFeatures.tsx:94-95`, `Project.tsx:2440-2480`), which has
`'Door {n}': 'Дверь {n}'` (`src/core/i18n/ru/data-parts.ts:299-303`). The room checks pass the raw label into
`t()` (`room.ts:555,567,574,619,628,641,751,765`). Reproduced with `setLang('ru')`:
`Door 1 выходит на 600 мм за конец стены 4 (длина 3000 мм): переместите или сделайте уже.` ADR-156 requires problem
messages in Russian; other core messages wrap generated names in `tr()` (`build.ts:99-160`, `shape.ts:177-219`).

### D10-F3 — Removing a feature and adding another repeats a name (Proven, minor)

`newFeature` numbers by count (`RoomFeatures.tsx:29`), so after Add door, Add door, remove Door 1, Add door:
`D10-F3 labels after add, add, remove first, add: [ 'Door 2', 'Door 2' ]`. Two fieldsets get the same accessible name
(`RoomFeatures.tsx:94`) and every room problem about either reads alike (`room.ts:567,628`). Labels cannot be edited
in the UI.

### D10-F4 — A double tap while drawing the room adds a corner twice and gives a wall with no length (Proven, minor)

The plan's click adds a corner on every tap (`Project.tsx:1960-1963`); `addRoomCorner` keeps a corner equal to the
last one (`designStore.ts:1911-1920`). Reproduced in the store with a repeated corner `[4000, 0]`:
`D10-F4 outline: [[0,0],[4000,0],[4000,0],[4000,3000],[0,3000]] issues: [ 'Wall 2 has no length.' ]` and the error
`room-outline Room: Wall 2 has no length.` The banner offers only Close and Cancel (`Project.tsx:1546-1566`): the
whole room is drawn again.

### D10-F5 — Two scale taps on one spot end Set the scale and say nothing (Proven, polish)

`addScalePoint` ends scaling and keeps the old scale when both taps hit the same pixel (`designStore.ts:1953-1957`).
Reproduced: `D10-F5 scaling after two taps on one pixel: null picture unchanged: true`. The banner ("{n} of 2",
`Project.tsx:1535-1545`) disappears as after a good second tap.

### D10-F6 — Floor picture controls differ from the wall's (Code-evident, polish)

- The file input is always named "Add a picture for the floor" (`RoomSurfaces.tsx:273`) while its visible text reads
  "Replace picture" once a picture is set (`:268`); the wall's input switches to "Replace picture for {name}"
  (`WallBackground.tsx:121-125`).
- A floor picture prepared while the choice changes is dropped silently (`RoomSurfaces.tsx:226`); the wall says "The
  prepared picture was not applied because its wall or background changed." (`WallBackground.tsx:48-53,64-67`).

## Checked, no finding

- Every visible text in `Project.tsx:3213-3409`, `RoomFeatures.tsx`, `RoomSurfaces.tsx`, `WallBackground.tsx`,
  `StraightenPhoto.tsx` and `Clearances.tsx` goes through `t()`/`tr()`; module-level `t()` maps (`SHAPES`,
  `REMOVE_FEATURE`, `KIND_NAME`) are safe because the dictionary loads before the modules (`i18n/index.ts:47-58`).
- `OptionalMm` never clamps or saves bad input and says "Not saved yet." (`Clearances.tsx:19-79`).
- Straighten photo: handles have labels and arrow keys; Apply is disabled with an alert while the corners cross
  (`StraightenPhoto.tsx:103-162`).
- Remove the room and Remove the plan picture ask first (`Project.tsx:3407-3421`, `RoomSurfaces.tsx:369-381`); every
  room edit is one undo step through `commitProject` (`designStore.ts:1899-1909`).
- A wall picture's stale write is caught and said (`WallBackground.tsx:44-67`, ADR-145/146).
- Drawing the room has no keyboard path, but Add the room plus Wall N lengths reaches every outline the drawing can
  (`Project.tsx:3384-3395`, ADR-059 "every wall length editable"): not a dead end.
- Editing a wall length turns a ready shape into "Drawn wall by wall" (`room.ts:777-794`): intended by ADR-059's
  implementation notes.
- Selectors in `RoomSection` and `PlanPictureSection` return store fields, no `.filter`/`.map` inside
  (`Project.tsx:3221-3224`, `RoomSurfaces.tsx:303-306`).
- Geometry stays in core (`shapeOutline`, `wallLength`, `floorRect`, `wallBands`, `planPictureRect`); the UI only
  draws (ADR-004).
