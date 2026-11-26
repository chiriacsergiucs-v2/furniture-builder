# Fusion 360 export: first-run checklist (G-005)

The Fusion 360 export (ADR-021, More › Files › Fusion 360 script) has never been run inside Fusion. This checklist is
for that first run. It uses two built-in designs. The expected numbers come from the model, and
`tests/fusion-checklist.test.ts` keeps them current.

## Run it

1. In the app, start a new piece from each template below (New… › the template name), without editing it.
2. Open More › Files › Fusion 360 script and save the `.py` file.
3. In Fusion 360, open Utilities › Add-Ins › Scripts and Add-Ins and add the saved script. Run it in a new, empty
   design.
4. Tick each line below and note anything that differs. Then tell Claude, who records the result in the backlog.

## Expected result

| Template         | Bodies | Groups (bodies each)                                           | Overall size                                                |
| ---------------- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Base cabinet     | 8      | Carcass: 7, Doors: 1                                           | 600 × 720 × 578 mm (Fusion: 60 × 57.8 × 72 cm in X × Y × Z) |
| Chest of drawers | 30     | Carcass: 6, Drawer 1: 6, Drawer 2: 6, Drawer 3: 6, Drawer 4: 6 | 800 × 900 × 468 mm (Fusion: 80 × 46.8 × 90 cm in X × Y × Z) |

The overall size is width × height × depth in the app. Fusion's own units are centimetres (1 cm = 10 mm), and
the script makes the conversion.

## Checklist, per template

- [ ] The script runs to the end without an error message.
- [ ] The number of bodies equals **Bodies** in the table.
- [ ] The groups and their body counts equal **Groups** in the table.
- [ ] Each body is named after its part and board, for example `Left side [PAL 18 white]`, as in the app's Parts
      list.
- [ ] The bounding box of all bodies equals **Overall size** in the table: Fusion X is the width, Fusion Z the
      height, and the depth runs along −Y.
- [ ] The doors and drawer fronts face −Y (towards the viewer in Fusion's Front view).
- [ ] Measure three bodies (a side, a shelf or bottom, a door or drawer front). Each matches its length, width and
      thickness in the app's Parts list.
