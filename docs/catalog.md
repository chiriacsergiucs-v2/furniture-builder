# Template catalog — families, default structure, configurations and default variants

The shipped template catalog (ADR-032, ADR-033, ADR-039). The tables below are generated from
`src/core/catalog/` and a test fails when they differ, so the code and this file always list the same families and
variants. **Every dimension is a typical value from retail catalogs and planners as known to the model on
2026-10-22 — not checked against live sources (the web was blocked) and not a standards check. Confirm before relying
on them.**

Legend — **Support**: ✅ ready (in *Start from* and the Catalog) · 🔧 needs construction · 📖 reference (browsed in
the Catalog tab; only "frame only" variants can be inserted, ADR-039). **Variant kind**: **I** interior-only (space
tree, sizes or materials on an existing root) · **C** needed new construction; `[…]` lists what it requires.
`hardware:user` inserts with a reminder to choose that hardware from its datasheet (ADR-010). ⏳ = waits for a
construction that is not built (`shape`, `front:fixed`, `front:lid`, `frame:arms`, `frame:modules`,
`frame:under-storage`) or for safety values the user confirms (`safety:user-confirmed`, ADR-035). Sizes are
W × H × D in mm, measured on the built model of the default variant (fronts included).

Rooms: living · bedroom · dining · office · kitchen · hallway · kids · outdoor · other. A family shows under every
room it lists; the first is its primary room. Kitchen defaults (ADR-036 open questions): 720 mm carcass on a 100 mm
plinth, 560 deep; wall units 320 deep; width grid 150 · 200 · 300 · 400 · 450 · 500 · 600 · 800 · 900 · 1000 · 1200
(free sizes allowed). Run parts — worktop, fillers, cover panels — are added to projects (ADR-036).

<!-- catalog:begin (generated from src/core/catalog by `npm run catalog:docs`; do not edit by hand) -->
### Kitchen cabinets (10 families, 38 variants)

| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|---|
| Base cabinet, doors | kitchen | cabinet · ✅ ready | 600 × 820 × 578 | Sides, bottom and top between the sides, back, plinth; shelves behind one or two hinged doors. | Width on the kitchen grid (free size allowed); 1 door up to 600 mm, 2 doors above; Shelves 0–3, fixed or adjustable; Inner drawers behind the door | 1 door + shelf **I** · 2 doors + shelf **I** · Drawer over door **I** · Door + 2 inner drawers **I** · Open shelves **I** |
| Base cabinet, drawers | kitchen | cabinet · ✅ ready | 600 × 820 × 578 | Carcass on a plinth with a bank of drawers on side-mount runners; fronts split top to bottom. | Drawers 1–5; Front heights equal, fixed or shares; Runner length from your list; Rails instead of a top under a hob | 3 drawers, deep bottom **I** · 4 equal drawers **I** · 2 pan drawers **I** · 800 wide drawer bank **I** · Hob base **C** [top:rails] |
| Sink base | kitchen | cabinet · ✅ ready | 800 × 820 × 578 | Carcass with two top rails instead of a top and no back, so the sink and pipes fit; doors in front. | Width 600–1200; 1 or 2 doors; Rails depth; False front, U-cut drawer or waste pull-out | 2 doors, rails, no back **C** [top:rails] · 1 door (600) **C** [top:rails] · False front + 2 doors **C** [top:rails, front:fixed] ⏳ · U-cut drawer + drawer **C** [top:rails, shape, hardware:user] · Waste pull-out **C** [top:rails, hardware:user] |
| Appliance base | kitchen | cabinet · ✅ ready | 600 × 820 × 578 | Carcass with rails and no back; an open niche sized from the oven's installation drawing. | Niche size from the appliance drawing (never defaulted); Drawer below or oven at plinth level | Oven niche + drawer below **C** [top:rails, appliance-niche, hardware:user] · Oven niche at plinth **C** [top:rails, appliance-niche, hardware:user] |
| Narrow pull-out base | kitchen | cabinet · ✅ ready | 300 × 820 × 578 | Narrow carcass with one full-height drawer front on a pull-out frame. | Width 150–400; Pull-out frame from its datasheet | Full-height pull-out **I** [hardware:user] · Spice / bottle pull-out **I** [hardware:user] |
| Integrated front | kitchen | panel · ✅ ready | 597 × 717 × 18 | One front panel with no carcass, fixed to the appliance with its own kit. | Width and height to line up with the neighbouring fronts; Handle | Dishwasher 600 **C** [root:panel] · Dishwasher 450 **C** [root:panel] · Fridge door **C** [root:panel] |
| Wall cabinet | kitchen, living | cabinet · ✅ ready | 800 × 720 × 338 | Carcass with the back set in, hung on brackets and a wall rail; shelves behind doors or a flap. | Width on the grid; Height 360 / 600 / 720 / 900; Doors 1–2, lift-up flap or open; No bottom over a hood | 2 doors + shelf **I** · 1 door + 2 shelves **I** · Open **I** · Lift-up flap **C** [front:flap, hardware:user] · Over-hood, no bottom **C** [bottom:none] |
| Tall cabinet | kitchen, hallway | cabinet · ✅ ready | 600 × 2200 × 578 | Full-height carcass on a plinth, divided by a fixed shelf; stacked doors; niches for appliances. | Height 2000–2400; Stacked doors; Inner drawers; Appliance niches sized from their drawings | Pantry, 2 stacked doors **I** · Pantry + inner drawers **I** · Broom / utility **I** · Oven + microwave tower **C** [appliance-niche, hardware:user] · Fridge housing **C** [appliance-niche, hardware:user] |
| Blind corner | kitchen | corner · ✅ ready | 1000 × 820 × 578 | A blind section covered by the neighbouring cabinet, joined to a normal cabinet with a door. | Corner on the left or right; Blind width; Base or wall height | Blind left + shelf **I** · Blind right + shelf **I** · Wall blind corner **I** [hardware:user] |
| L corner | kitchen | corner · ✅ ready | 900 × 820 × 900 | Two wings open to each other at the corner with a folding door pair. | Wing lengths; Corner side; Base or wall height | Base L, folding doors **I** · Wall L 600 × 600 **I** [hardware:user] · Diagonal front **C** [shape] |

### Storage and display (10 families, 29 variants)

| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|---|
| Bookcase (with back) | living, office, kids | cabinet · ✅ ready | 800 × 1800 × 300 | Two sides, top, bottom, back panel and plinth; shelves between the sides. | Width (bays via "Bays and shelves"); Shelves fixed or adjustable; Back nailed on or set in; Plinth height | Open, back panel, shelves **I** |
| Wardrobe | bedroom, hallway | cabinet · ✅ ready | 1200 × 2100 × 618 | Tall carcass on a plinth divided into sections; hanging rails, shelves and drawers behind hinged or sliding doors. | Sections 1–6; Per section: hanging, shelves, drawers; Hinged or sliding doors; Plinth | 2 doors, hanging + shelves **I** · 3 sections + drawers **I** · Double hanging **I** · 4 doors, 2 sections **I** · Sliding 2 doors **C** [front:sliding] |
| Armoire | bedroom | cabinet · ✅ ready | 1100 × 1950 × 618 | Freestanding wardrobe with a pair of doors over hanging space, often a drawer below. | 1–2 sections; Pair of doors; Bottom drawer | Hanging + bottom drawer **I** · Hanging + shelves **I** |
| Dresser | bedroom | cabinet · ✅ ready | 1400 × 800 × 518 | Low wide carcass with drawer columns side by side on a plinth. | Columns 1–3 × drawers 2–5; Equal or graduated heights | 2 × 3 drawers **I** · 2 × 4 drawers **I** · 3 graduated wide **I** |
| Chest of drawers | bedroom, hallway | cabinet · ✅ ready | 800 × 900 × 468 | Carcass on a plinth with one column of drawers. | Drawers 3–6; Width; Tall and narrow | 4 drawers **I** · 5 drawers, tall-narrow **I** · 2 small over 3 wide **I** · Lidded blanket chest **C** [front:lid, hardware:user] ⏳ |
| Sideboard | dining, living | cabinet · ✅ ready | 1600 × 800 × 468 | Long low carcass in 2–4 sections with doors, drawers or open space. | Sections 2–4; Doors, drawers or open per section | Doors · drawers · doors **I** · 3 doors **I** · 2 doors + open niche **I** |
| Credenza | office, dining, living | cabinet · ✅ ready | 1600 × 700 × 468 | Low office sideboard close to desk height: doors, sliding doors or file drawers. | Sections; Hinged or sliding doors; File drawers | Doors + file drawers **I** [hardware:user] · 3 doors, low **I** · Sliding doors **C** [front:sliding] |
| Media console | living | cabinet · ✅ ready | 1800 × 450 × 438 | Low long carcass with open niches for devices, drawers, doors or flaps; on the floor or hung on the wall. | Open niches; Drawers; Drop-down flaps; Floor or wall-hung | Open niches + drawers **I** · Doors + open centre **I** · Wall-hung **I** · Drop-down flaps **C** [front:flap, hardware:user] |
| Filing cabinet | office | cabinet · ✅ ready | 420 × 1000 × 618 | Strong carcass with file drawers on full-extension runners and hanging-file rails. | Drawers 2–4; Vertical or lateral; Under-desk pedestal | 3 file drawers **I** [hardware:user] · Pedestal: box + file drawer **I** · Lateral, 2 drawers **I** [hardware:user] |
| Loose panels | other | panels · ✅ ready | 600 × 18 × 300 | Parts known only by their cut sizes: listed for cutting and sheets, shown in one pile, not assembled. | Name, length, width, board and quantity per part | One panel **I** |

### Tables and surfaces (6 families, 17 variants)

| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|---|
| Desk | office, bedroom, kids | desk · ✅ ready | 1400 × 750 × 700 | Worktop on panel gables or drawer pedestals (cabinets), with a modesty panel at the back. | Gables, pedestal left / right / both; Pedestal spaces edited like cabinets; Modesty panel | Pedestal left **I** · Pedestal right **I** · Two pedestals **I** · Panel desk **I** |
| Nightstand | bedroom | cabinet · ✅ ready | 450 × 600 × 418 | Small carcass on a low plinth with drawers, an open niche or a door. | Drawers 0–3; Open niche; Door | Drawer + open shelf **I** · 2 drawers **I** · Door + drawer **I** |
| Coffee table | living | frame · ✅ ready | 1100 × 420 × 600 | Low top on four legs with rails, or a low box; often a lower shelf. | Box or legs; Lower shelf; Height about the sofa seat | Low box with open shelf **I** · Legs + top **C** [root:frame] · Legs + lower shelf **C** [root:frame] |
| End table | living, bedroom | frame · ✅ ready | 450 × 550 × 468 | Small top at sofa-arm height on legs or as a box, with a drawer or shelf. | Box or legs; Drawer; Shelf | Box with drawer **I** · Legs + shelf **C** [root:frame] |
| Dining table | dining, kitchen | frame · ✅ ready | 1200 × 750 × 800 | Top on four legs joined by rails under the top; about 600 mm of length per seat. | Length per seats; Leg section and inset; Rail height; H-stretcher | 4 seats **C** [root:frame] · 6 seats **C** [root:frame] · With H-stretcher **C** [root:frame] |
| Patio table | outdoor | frame · ✅ ready | 1500 × 740 × 860 | Slatted top with drainage gaps on legs and rails, in outdoor timber. | Slat width and gap; Outdoor timber; Stretchers | Slatted top **C** [root:frame] · Slatted top, H-stretcher **C** [root:frame] |

### Seating (12 families, 25 variants)

| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|---|
| Chair | dining, office, bedroom | frame · ✅ ready | 450 × 882 × 561 | Four legs and seat rails; the back posts carry on up to a vertical back of slats or a panel. | Seat height 430–480; Back of slats or a panel; Stretchers | Vertical slatted back **C** [root:frame] · Panel back **C** [root:frame] |
| Dining chair | dining | frame · ✅ ready | 460 × 882 × 581 | As a chair, sized for a 720–760 mm table. | As chair; Arms | Side chair **C** [root:frame] · With arms **C** [root:frame, frame:arms] ⏳ |
| Stool | kitchen, dining | frame · ✅ ready | 380 × 450 × 380 | Seat on four legs with rails and a footrest ring of stretchers. | Low, counter or bar height; Footrest height | Low 450 **C** [root:frame] · Counter 650 **C** [root:frame] · Bar 760 **C** [root:frame] |
| Bench | dining, hallway, bedroom | frame · ✅ ready | 1200 × 450 × 380 | Long seat on legs and rails, or a low box with cubbies. | Legs or box; Storage under; Lid | Storage bench, open cubbies **I** · 4 legs **C** [root:frame] · Lift lid **C** [front:lid, hardware:user] ⏳ |
| Garden bench | outdoor | frame · ✅ ready | 1500 × 450 × 390 | Slatted seat with drainage gaps on legs and rails, outdoor timber. | Slat width and gap; Back and arms | Backless slatted **C** [root:frame] · With back and arms **C** [root:frame, shape] |
| Armchair | living, bedroom | frame · ✅ ready | 800 × 852 × 833 | Upholstered: base frame of rails, seat deck on webbing or springs, back frame, two arm frames, legs, cushions. | Arm style and width; Seat depth 500–550, seat height 400–450 (typical); Cushions | Frame only **C** [root:frame, hardware:user] |
| Accent chair | living, bedroom | frame · ✅ ready | 700 × 803 × 776 | Smaller upholstered chair, armless or with slim arms, on exposed legs. | Armless or slim arms; Exposed legs | Frame only **C** [root:frame, hardware:user] |
| Sofa | living | frame · ✅ ready | 1600 × 854 × 883 | Upholstered: hardwood or ply rails, seat suspension, back frame, arms, legs, cushions; about 600–700 mm per seat. | Seats 2–4; Arm style; Cushions; Legs | 2-seat frame only **C** [root:frame, hardware:user] · 3-seat frame only **C** [root:frame, hardware:user] |
| Sectional | living | frame · ✅ ready | 2400 × 854 × 933 | Sofa modules (arm, armless, corner, chaise) joined by brackets. | L, U or chaise layout; Module list | Main section frame **C** [root:frame, hardware:user] · Chaise section frame **C** [root:frame, hardware:user] · L-shape as one piece **C** [root:frame, frame:modules] ⏳ |
| Recliner | living | frame · ✅ ready | 900 × 1004 × 997 | Upholstered frame built around a bought reclining mechanism that sets its inside sizes. | Mechanism; Wall clearance | Fixed frame shell **C** [root:frame, hardware:user] · Reclining frame **C** [root:frame, shape, hardware:user] |
| Ergonomic office chair | office | frame · ✅ ready | 480 × 951 × 570 | Bought assembly: gas lift, mechanism, five-star base, adjustable seat, back and arms. | Seat height range; Arms; Headrest | Fixed-height desk chair frame **C** [root:frame, hardware:user] · Ergonomic chair (bought base) **C** [root:frame, shape, hardware:user] |
| Outdoor lounger | outdoor | frame · ✅ ready | 1950 × 320 × 570 | Two stringers, slats, a hinged backrest on a prop with several positions, legs or wheels. | Backrest positions; Wheels | Flat lounger frame **C** [root:frame, hardware:user] · Adjustable backrest **C** [root:frame, shape, hardware:user] |

### Sleeping and lying (5 families, 9 variants)

| Family | Rooms | Root · support | Default size | Structure | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|---|
| Bed | bedroom | frame · ✅ ready | 1670 × 1000 × 2056 | Headboard and footboard carry two side rails; slats on ledgers; a centre rail on legs from 1400 mm wide. | Mattress size (typical sizes, check yours); Slat width and gap; Headboard, footboard; Drawers under | Platform with slats **C** [root:frame] · Headboard + footboard **C** [root:frame] · 2 drawers under **C** [root:frame, frame:under-storage] ⏳ |
| Daybed | living, bedroom | frame · ✅ ready | 963 × 800 × 2056 | Single bed with ends and a back panel along one side, so it sits like a sofa. | Single mattress; Back and end heights; Trundle | Three-sided **C** [root:frame] · With trundle drawer **C** [root:frame, frame:under-storage] ⏳ |
| Futon | living, bedroom, office | frame · ✅ ready | 1470 × 600 × 2056 | Low slatted deck on a frame; the fold mechanism is bought. | Mattress size; Fold mechanism | Bi-fold frame **C** [root:frame, hardware:user] |
| Bunk bed | kids, bedroom | frame · 🛡 waits for safety values | — | Two decks between tall ends, guard rails all round the top deck, a ladder. | Tier gap; Ladder side; Guard rail height; Trundle | Standard **C** [root:frame, safety:user-confirmed] ⏳ · With trundle **C** [root:frame, frame:under-storage, safety:user-confirmed] ⏳ |
| Cradle | bedroom, kids | frame · 🛡 waits for safety values | — | Small bed with tall ends and closed sides on a fixed stand. | Mattress size; Side height | Fixed stand **C** [root:frame, safety:user-confirmed] ⏳ |

**Totals:** 43 families, 118 variants; 57 interior-only, 108 can be inserted today, 10 wait (⏳) for a construction or for safety values.
<!-- catalog:end -->
