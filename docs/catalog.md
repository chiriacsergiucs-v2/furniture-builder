# Template catalog — families, default structure, configurations and default variants

Source of truth for the shipped template catalog (ADR-0032, ADR-0033). The code catalog must list exactly these
families and variants; a test compares them. **All dimensions are typical values from retail catalogs and
planners as known to the model on 2026-10-22 — not checked against live sources (web was blocked) and not standards
compliance. Confirm before relying on them.**

Legend — **Support**: ✅ ready (builds today) · 🔧 needs construction (ADR named) · 📖 reference only (ADR-0039).
**Variant kind**: **I** interior-only (space tree / sizes / materials on an existing root) · **C** needs
construction; `requires` in brackets. `hw` = hardware the user must specify (ADR-0010); `safety` = values the user
must confirm (ADR-0035). ★ = existing template id kept as the variant id. Sizes are W × H × D in mm.

Rooms: living · bedroom · dining · office · outdoor · kitchen · hallway · kids · other. A family is listed under
every room it carries; the first is its primary room. Function groups: seating · sleeping · tables · storage · kitchen.

## Kitchen (10 families, 38 variants)

Shared defaults (ADR-0036, open questions): carcass 720 high, base depth 560, plinth 100 (setback 50), wall depth
320, tall up to 2400; width grid 150 · 200 · 300 · 400 · 450 · 500 · 600 · 800 · 900 · 1000 · 1200 (free size allowed
with a warning). Run parts — fillers, end cover panels, plinth, worktop — are project-level (ADR-0036).

| Family | Rooms | Root · support | Default | Configurations | Variants (≤ 5) |
|---|---|---|---|---|---|
| Base cabinet, doors | kitchen | cabinet ✅ | 600 × 720 × 560 | width grid; 1 or 2 doors (2 above 600); shelves 0–3, adjustable; inner drawers | ★`base-door` 1 door + shelf **I** · 2 doors + shelf **I** · drawer over door **I** · door + 2 inner drawers **I** · open shelves **I** |
| Base cabinet, drawers | kitchen | cabinet ✅ | 600 × 720 × 560 | drawer count 1–5; heights fixed / shares (ADR-0023); runner length from list | 3 drawers, deep bottom **I** · 4 equal **I** · 2 pan drawers **I** · shallow + deep + inner drawer **I** · hob base: shallow top + 2 deep **I** |
| Sink base | kitchen | cabinet 🔧 ADR-0036 | 800 × 720 × 560 | rails instead of top; no back; doors 1–2; false front | 2 doors, rails, no back **C** [top:rails] · 1 door (600) **C** [top:rails] · false front + 2 doors **C** [top:rails] · U-cut drawer + drawer **C** [shape, hw] · waste pull-out **C** [hw] |
| Appliance base | kitchen | cabinet 🔧 ADR-0036 | 600 × 720 × 560 | niche size from the appliance drawing (never defaulted) | oven niche + drawer below **C** [appliance-niche] · oven niche at plinth **C** [appliance-niche] |
| Narrow pull-out base | kitchen | cabinet ✅ | 300 × 720 × 560 | width 150–400; one tall drawer front | full-height pull-out **I** [hw] · spice / bottle pull-out 150 **I** [hw] |
| Integrated front | kitchen | panel 🔧 ADR-0036 | 600 × 720 | front only, no carcass; aligned to neighbouring fronts | dishwasher 600 **C** [root:panel] · dishwasher 450 **C** [root:panel] · fridge door **C** [root:panel] |
| Wall cabinet | kitchen, living | cabinet ✅ | 800 × 720 × 320 | width grid; height 360 / 600 / 720 / 900; doors 1–2; flap; open | ★`wall-cabinet` 2 doors + shelf **I** · 1 door + 2 shelves **I** · open, banded inside **I** · lift-up flap **C** [front:flap, hw] · over-hood, no bottom **C** [bottom:none] |
| Tall cabinet | kitchen, hallway | cabinet ✅ | 600 × 2200 × 560 | height 2000–2400; stacked doors; fixed middle shelf; niches | pantry, 2 stacked doors **I** · pantry + inner drawers **I** · broom / utility **I** · oven + microwave tower **C** [appliance-niche] · fridge housing **C** [appliance-niche] |
| Blind corner | kitchen | corner ✅ | 1000 × 720 × 560 | side left / right; blind width; base or wall height | ★`corner-blind` blind left + shelf **I** · blind right + shelf **I** · wall blind corner **I** |
| L corner | kitchen | corner ✅ | 900 × 900 × 720 | wing lengths; side; base or wall | ★`corner-l` base L, folding doors **I** · wall L 600 × 600 **I** · diagonal front **C** [shape] |

## Storage and display (9 families, 28 variants)

| Family | Rooms | Root · support | Default | Configurations | Variants |
|---|---|---|---|---|---|
| Bookcase (with back) | living, office, kids | cabinet ✅ | 800 × 1800 × 300 | width (bays via *Bays and shelves*); shelves fixed / adjustable; back inset; plinth | ★`bookcase` open, back panel, shelves **I** |
| Wardrobe | bedroom, hallway | cabinet ✅ | 1200 × 2100 × 600 | sections 1–6; per section hanging / shelves / drawers; hinged or sliding; plinth | ★`wardrobe` 2 doors, hanging + shelves **I** · 3 sections + drawers **I** · double hanging **I** · 4 doors, 2 sections **I** · sliding 2 doors **C** [front:sliding] |
| Armoire | bedroom | cabinet ✅ | 1100 × 1950 × 600 | 1–2 sections; 2 doors; bottom drawer | hanging + bottom drawer **I** · hanging + shelves **I** |
| Dresser | bedroom | cabinet ✅ | 1400 × 800 × 500 | columns 1–3 × rows 2–5; equal or graduated heights | 2 × 3 drawers **I** · 2 × 4 drawers **I** · 3 graduated wide **I** |
| Chest of drawers | bedroom, hallway | cabinet ✅ | 800 × 900 × 450 | drawers 3–6; widths; tall-narrow | ★`chest` 4 drawers **I** · 5 drawers, tall-narrow **I** · 2 small over 3 wide **I** · lidded blanket chest **C** [front:flap, hw] |
| Sideboard | dining, living | cabinet ✅ | 1600 × 800 × 450 | sections 2–4; doors / drawers / open per section | ★`sideboard` doors · drawers · doors **I** · 3 doors **I** · 2 doors + open niche **I** |
| Credenza | office, dining, living | cabinet ✅ | 1600 × 700 × 450 | sections; sliding or hinged; file drawer | doors + file drawer **I** [hw: file rails] · 3 doors, low **I** · sliding doors **C** [front:sliding] |
| Media console | living | cabinet ✅ | 1800 × 450 × 420 | open niches; drawers; flaps; floor or wall-hung | open niches + drawers **I** · doors + open centre **I** · wall-hung **I** (mount: wall) · drop-down flaps **C** [front:flap, hw] |
| Filing cabinet | office | cabinet ✅ | 420 × 720 × 600 | drawers 2–4; vertical or lateral; pedestal | 3 file drawers **I** [hw: file rails] · pedestal: box + file drawer **I** · lateral 2 drawers **I** |

## Tables and surfaces (6 families, 17 variants)

| Family | Rooms | Root · support | Default | Configurations | Variants |
|---|---|---|---|---|---|
| Desk | office, bedroom, kids | desk ✅ | 1400 × 750 × 700 | gables / pedestal left / right / both; pedestal spaces; modesty panel | ★`desk-pedestal` pedestal left **I** · pedestal right **I** · two pedestals **I** · ★`desk-gables` panel desk **I** |
| Nightstand | bedroom | cabinet ✅ | 450 × 600 × 400 | drawers 0–3; open niche; door; plinth | drawer + open shelf **I** · 2 drawers **I** · door + drawer **I** |
| Coffee table | living | cabinet ✅ / frame 🔧 ADR-0038 | 1100 × 420 × 600 | box or legs; lower shelf; drawer | low box with open shelf **I** · legs + top **C** [root:frame] · legs + lower shelf **C** [root:frame] |
| End table | living, bedroom | cabinet ✅ / frame 🔧 | 450 × 550 × 450 | box or legs; drawer; shelf | box with drawer **I** · legs + shelf **C** [root:frame] |
| Dining table | dining, kitchen | frame 🔧 ADR-0038 | 1600 × 750 × 900 | length per seats (≈ 600 each); legs / trestle; apron height; centre rail | 4 seats 1200 × 800 **C** [root:frame] · 6 seats 1600 × 900 **C** [root:frame] · trestle **C** [root:frame] |
| Patio table | outdoor | frame 🔧 ADR-0038 | 1500 × 740 × 900 | slatted top with gap; outdoor timber | slatted top **C** [root:frame] · solid top **C** [root:frame] |

## Seating (12 families, 20 variants)

Straight members only in the frame root; raked backs and splayed legs wait for a shaped-part ADR (ADR-0039).

| Family | Rooms | Root · support | Default | Configurations | Variants |
|---|---|---|---|---|---|
| Chair | dining, office, bedroom | frame 🔧 ADR-0038 | 450 × 850 × 500, seat 450 | seat height 430–480; back rails / slats / panel; stretchers | vertical slatted back **C** [root:frame] · panel back **C** [root:frame] |
| Dining chair | dining | frame 🔧 | 460 × 880 × 520, seat 460 | as chair; arms | side chair **C** [root:frame] · with arms **C** [root:frame] |
| Stool | kitchen, dining | frame 🔧 | 380 × 450 / 650 / 760 × 380 | low / counter / bar; footrest | low 450 **C** [root:frame] · counter 650 **C** [root:frame] · bar 760 **C** [root:frame] |
| Bench | dining, hallway, bedroom | frame 🔧 / cabinet ✅ | 1200 × 450 × 380 | legs or box; under-storage; lid | storage bench, open cubbies **I** · 4 legs **C** [root:frame] · lift lid **C** [front:flap, hw] |
| Garden bench | outdoor | frame 🔧 | 1500 × 450 × 450 | slats + gap; back; arms | backless slatted **C** [root:frame] · with back and arms **C** [shape] |
| Armchair | living, bedroom | 📖 reference | 800 × 850 × 850 | arm style; seat depth; cushions | frame only **C** [root:frame] |
| Accent chair | living, bedroom | 📖 reference | 700 × 800 × 750 | armless / slim arms; exposed legs | frame only **C** [root:frame] |
| Sofa | living | 📖 reference | 2100 × 850 × 900 | seats 2–4; arms; cushions; legs | 2-seat frame only **C** [root:frame] · 3-seat frame only **C** [root:frame] |
| Sectional | living | 📖 reference | modules | L / U / chaise; module list | L-shape frame only **C** [root:frame] |
| Recliner | living | 📖 reference | 900 × 1050 × 950 | mechanism; wall clearance | reference only **C** [shape, hw] |
| Ergonomic office chair | office | 📖 reference | — | seat height range; arms; headrest | reference only **C** [hw] |
| Outdoor lounger | outdoor | 📖 reference | 650 × 320 × 1950 | backrest positions; wheels | reference only **C** [shape, hw] |

## Sleeping and lying (5 families, 9 variants)

Mattress presets (EU 90/140/160/180 × 200, UK and US sizes) set the inner size + clearance (ADR-0038).

| Family | Rooms | Root · support | Default | Configurations | Variants |
|---|---|---|---|---|---|
| Bed | bedroom | frame 🔧 ADR-0038 | mattress 160 × 200 | mattress preset; slat width / gap; headboard; footboard; drawers under | platform with slats **C** [root:frame] · 2 drawers under **C** [root:frame] · headboard with shelf **C** [root:frame] |
| Daybed | living, bedroom | frame 🔧 | mattress 90 × 200 | three sides; trundle | three-sided **C** [root:frame] · with trundle drawer **C** [root:frame] |
| Futon | living, bedroom, office | frame 🔧 | mattress 140 × 200 | bi-fold deck | bi-fold frame **C** [root:frame, hw] |
| Bunk bed | kids, bedroom | frame 🔧 | 2 × 90 × 200 | tier clearance; ladder side; guard rails | standard **C** [root:frame, safety] · with trundle **C** [root:frame, safety] |
| Cradle | bedroom, kids | frame 🔧 | mattress 400 × 800 | fixed stand | fixed stand **C** [root:frame, safety] |

## Totals

42 families, 112 variants; 57 variants are **I** and build on today's roots (a few need user hardware), the rest
unlock with ADR-0036 (kitchen flags, niches, front-only panel), ADR-0037 (sliding, flap), ADR-0038 (frame root,
solid stock) or a future shaped-part ADR (ADR-0039).
