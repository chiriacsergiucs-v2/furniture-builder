# Modular Furniture Engine — EDC Architecture & Execution Backlog

**Project:** `chiriacsergiucs-v2/furniture-builder`  
**Backlog version:** 1.4 · 2026-10-11 · **Canonical status source for this initiative**  
**Implementation branch policy:** Work on `main` when explicitly requested. Preserve user data.  
**Current iteration:** Iteration 5 (B19–B20; B22 partial): source preset revision pins, non-destructive legacy graph adapters, and save-configured-furniture drafts. Verified [CI 38117222030](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38117222030) and [Pages 38117222131](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38117222131), both successful on `07a1eaf9`.

## Mandate and frozen product decisions

Create a reusable, rule-driven furniture configuration system where furniture types are composed of components; components own parameter schemas, dependencies, child relationships, attachment slots and manufacturing projections. User-configured furniture is saved as independently editable instances, and users may store configurations as presets. Future furniture families must be added without writing a second drawer, shelf or carcass engine.

**Keep** lessons from IKEA PAX/KOMPLEMENT, BESTÅ, PLATSA and other modular systems. Quality of an individual retailer's products does not invalidate its modular-interface knowledge. Draw complementary ideas from Roomle's parametric hierarchy/docking concepts, Configura-style rule-driven layouts and cabinetmaking/manufacturing configurators. These are **design references**, not claims that the current code implements those systems.

**Focus now:** reusable component "brain": types, composition, parameters, compatibility, geometry, instance isolation, cutlist derivation, persistent IDs and migrations.

**Defer now:** visual appearance, photorealism, specific board thickness defaults, detailed hardware libraries, joinery optimization, strength certification, comprehensive E2E tests, nonessential refactors. Thickness remains a **parameter** because it changes clearances and geometry even though material engineering is deferred.

**Safety/data:** Do not lose any Dexie IndexedDB projects, presets, revisions, kits or JSON backup/import compatibility. No backend or accounts. A valid cutlist must not be fabricated for a planned-only template. A Fusion Python export is a direct-model snapshot, not a live-linked F3D document.

## EDC — Explore → Doubt → Compare

### E — Explore: viable engine architectures

| Candidate | Definition | Fastest benefit | Fundamental limitation |
|---|---|---|---|
| **A. Independent template generators** | Add `buildDrawer()`, `buildWardrobe()`, `buildDesk()` as isolated generators | Quick demonstration of each new furniture kind | Duplicates shelves/drawers; fixes fail to propagate between templates; unbounded maintenance |
| **B. Fully generic constraint graph/solver** | Universal component graph with bidirectional relations and constraint solving from day one | Highest theoretical expressiveness | Premature solver complexity, debugging difficulty, slow time to usable furniture; many unverified abstractions |
| **C. Typed component graph + recipe-based generators (recommended)** | Small component registry, named slots and directed parameter dependencies, deterministic builders and derived outputs | Shared component behavior with manageable increments | Requires careful schema, dependency and ID design from the first implementation |
| **D. Hybrid template-specific parents + shared leaf generators** | Specialized bed/table/carcass parents, shared drawer/shelf/door/leg child components and common output contract | Preserves distinct structural semantics with strong reuse | Must prevent parent-specific sizing rules from leaking into generic child components |

**Preferred implementation:** **C + D**. Use a minimal typed graph and shared engine, with specialist top-level generators where furniture constructions genuinely differ (beds and tables are not rectangular carcasses).

### D — Doubt: assumptions, failure modes and evidence boundaries

| Assumption / failure | Why it matters | Mitigation / verification |
|---|---|---|
| "All furniture is a cabinet" | Beds, tables and wall assemblies have different support logic | Typed template recipes with specialist structural root components |
| "Every parameter can be inherited directly" | Conflicting child overrides can create cycles or nonlocal side effects | Directed dependency graph; explicit defaults, derived values and user overrides; detect cycles |
| "A saved preset is the same as its project instance" | Editing one project could mutate the library or other projects | Versioned definition ID plus independent instance ID and frozen normalized parameter snapshot |
| "Geometry is sufficient for fabrication" | A 3D box may omit grain, ABS, kerf, hardware, drill ops, orientations | Single generated model with distinct `solids`, `parts`, `BOM`, diagnostics outputs |
| "Connect is just placing two boxes next to each other" | Invalid slot mating, overlap, unsupported attachment | Slot types, anchor transforms, compatibility and collision checks |
| "Replacing a drawer does not affect siblings" | Insert/replace/split/repeat may invalidate counts and allocations | Deterministic subtree rebuild and dependency propagation with stable unaffected IDs |
| "All saved projects can migrate automatically" | Missing definitions and historical schema variants may break old data | New optional fields, adapter for legacy CabinetSpec, versioned migrations, preserved backups |
| "Current shelf and starter drawer are fully reusable" | Current generator is cabinet-specific; starter drawer is 40×30 only | Label existing pieces partial; prove reuse in **two different furniture templates** |
| "A template marked ready is usable" | Card-level availability does not prove geometry/cutlist correctness | Ready status only after successful model/parts projection and focused verification |
| "Looks right in 3D means correct cut list" | Divergent transforms/quantities might silently pass | Geometry/BOM parity invariant; counts, dimension/placement diagnostics |
| "Generalize all 40 components at once" | Huge pre-MVP scope with little user-facing benefit | Deliver one vertical slice: carcass + compartment + shelf + drawer, then chest recipe |
| "Thicker material is always better" | Material/strength is a separate constraint system | Keep thickness parametrized now; no unverified durability scoring |

**Facts in current `main` (checked 2026-10-11):** `src/furniture/templates.ts` has 7 catalog records, 3 `ready` cabinet arrangements (`cabinet-open`, `cabinet-empty`, `cabinet-shelving`) all using the same cabinet generator; 4 are planned-only. `CabinetConfigurator.tsx` has choose/customize/review steps and a live preview. `cabinet.ts` builds panels, positioned assemblies and cutlist; `assembly/model.ts` includes a fixed-dimension drawer starter and per-piece transforms. `src/db/database.ts` uses Dexie schema v2. **There is no reusable typed composition engine yet.**

**Unknown:** Real-world user demand for each furniture family; authoritative geometry/hardware fit for most variants; full migration behavior of future graph schemas. Treat proposals as unimplemented until checked.

### C — Compare: decision matrix

Scores are **design judgments (1 weak to 5 strong), not measured benchmarks**.

| Criterion | Weight | A: isolated | B: full solver | C+D: typed + specialized |
|---|---:|---:|---:|---:|
| Reuse across families | 30% | 2 | 5 | 5 |
| Shortest validated vertical slice | 25% | 5 | 1 | 4 |
| Deterministic manufacturing output | 20% | 3 | 3 | 5 |
| Debuggability/maintainability | 15% | 2 | 2 | 4 |
| Compatibility with existing data | 10% | 4 | 2 | 4 |
| **Weighted decision score** | 100% | **3.05/5** | **2.75/5** | **4.45/5** |

**Choose C+D.** Runner-up A is useful for short experiments, not the sustainable engine. Revisit B only if a real template requires cyclic/complex constraint solving after directed propagation is proven insufficient. **Confidence: medium-high** based on code review and architecture reasoning, not user testing.

## Six-layer architecture

1. **Part definitions** — manufacturable panels, slats, rails, fittings and material references.
2. **Reusable component definitions** — carcass, shelf, drawer box, front, door, leg and other generators.
3. **Composition rules** — named slots, compatibility, attachment transforms, parameter mapping and instance repetition.
4. **Furniture template recipes** — versioned kitchen cabinet, wardrobe, chest, bed, desk and other typed root structures.
5. **Saved presets and project instances** — saved user choices, independent identities, version-pinned definitions, overrides and derived output.
6. **Generated representation** — complete positioned solids, cut list, quantity-aware BOM, validation diagnostics and snapshot exports.

**Invariant:** generate one normalized `FurnitureModel`; 3D, cutlist, BOM and Fusion snapshot must project from that same model. Never reconstruct a separate speculative "assembled view" from cut rows.

### Proposed minimal contracts (not implemented)

```ts
type ComponentKind = 'carcass' | 'compartment' | 'shelf' | 'drawer' | 'door' | 'leg' | 'frame' | string;

interface ComponentDefinition<P = Record<string, unknown>> {
  id: string;              // stable namespaced kind, e.g. core/shelf
  version: number;         // generator contract revision
  kind: ComponentKind;
  defaults: P;
  slots: SlotDefinition[];  // child's accepted kinds, multiplicity, anchors
  build(input: BuildInput<P>): BuildResult;
}

interface ComponentInstance<P = Record<string, unknown>> {
  id: string;              // stable per-furniture instance ID
  definitionId: string;    // registry lookup; never copy code into preset
  definitionVersion: number;
  params: P;               // explicit user overrides, not calculated dimensions
  children: ComponentInstance[];
}

interface SlotDefinition {
  name: string;            // e.g. interior.main/front.main/bottom.support
  accepts: string[];       // supported component IDs or kinds
  min: number;
  max: number | null;
  anchor: 'parent-local';  // transform resolved by parent's build()
}

interface BuildResult {
  solids: PositionedSolid[];
  parts: ManufacturingPart[];
  bom: BillOfMaterialsRow[];
  diagnostics: Diagnostic[];
}

interface FurnitureTemplate {
  id: string;
  version: number;
  category: string;
  root: ComponentInstance; // recipe, not frozen manufacturing rows
}

interface FurnitureInstance {
  id: string;
  templateId: string;
  templateVersion: number;
  root: ComponentInstance; // snapshot of instance configuration
  updatedAt: string;
}
```

These contracts are illustrative. In the first implementation keep only necessary fields, reuse existing `ProjectAssembly` and `Part` types where safe, and use deterministic integer-millimetre manufacturing dimensions. Half-millimetre/fractional *positions* must not be silently rounded.

## Five mandatory composition operations

| ID | Operation | Behavior | Minimal acceptance |
|---|---|---|---|
| OP01 | **Insert** | Add compatible component into named slot | Insert shelf into carcass interior, preserve valid siblings |
| OP02 | **Replace** | Exchange selected component/subtree | Replace shelf with drawer; prohibit unsupported slot type |
| OP03 | **Split** | Divide one compartment into configurable child compartments | Vertical split yields two independently configurable openings |
| OP04 | **Repeat** | Create N instances from a component definition | 0/1/3 drawers or shelves recompute spacing and IDs correctly |
| OP05 | **Connect** | Attach two independently configured furniture modules | Adjacent modules validate mating slots, attachment, no collisions |

**Order:** Insert → Repeat → Replace → Split → Connect. Reordering is allowed if one end-to-end example proves an earlier abstraction unnecessary. Preserve an explicit operation log for undo/revision only when a user-facing implementation needs it; no pre-MVP generalized history system.

## Reusable component catalog — 40 proposed types

**Catalog entries are product-domain ideas, NOT proof of 40 coded generators.** Each component must ultimately define parameter schema, child slots, generation/validation behavior and manufacturing projection when appropriate.

| ID | Component | Reuse / parameter intent |
|---|---|---|
| C01 | Carcass | W/H/D, internal envelope, openings; base for many casegoods |
| C02 | Fixed shelf | Span, position, parent opening; cupboard/bookcase/wardrobe |
| C03 | Adjustable shelf | Support positions and repeatable placement |
| C04 | Divider | Splits compartment into variable sub-compartments |
| C05 | Structural back | Back inset/groove and closing envelope |
| C06 | Face frame | Frame rails/stiles and named front openings |
| C07 | Plinth/toe-kick | Bottom support slot and setback |
| C08 | Leg assembly | Count, positions, support attachment |
| C09 | Cross brace/stretcher | Connects structural members |
| C10 | Wall-hanging rail | Attaches wall-mounted module |
| C11 | Reinforced shelf | Shelf plus stiffening child elements |
| C12 | Bed support system | Center support, slats, mattress envelope |
| C13 | Worktop/tabletop | Surface, edges, support anchors |
| C14 | Structural subframe | Bed, desk, floating-effect base |
| C15 | Drawer box | Opening-adapted parts, internal cavity and bottom |
| C16 | Drawer runners | Compatibility/spacing definition, optional provider spec later |
| C17 | Drawer front | Front overlay/inset, offsets and gaps |
| C18 | Hinged door | Swing envelope and hinge attachments |
| C19 | Lift-up door | Specialized front motion and clearances |
| C20 | Sliding door | Track, overlap and travel |
| C21 | Pocket door | Pockets, mechanisms and envelope |
| C22 | Pull-out shelf/tray | Tray + runner and extension motion |
| C23 | Internal organizer | Layout within drawer or compartment |
| C24 | Wardrobe rail | Length and hanging clearance |
| C25 | Shoe insert | Angled/flat configurations |
| C26 | Waste/laundry pull-out | Child containers and movement |
| C27 | Folding/extendable surface | Joined moving supports and travel |
| C28 | Lift-storage bed mechanism | Bed platform/hinge travel slots |
| C29 | Edge protection | Generated part edge metadata |
| C30 | Joinery profile | Connection metadata; geometry where required |
| C31 | Adjustable feet | Support anchors and height |
| C32 | Anti-tip system | Required attachment/diagnostic metadata |
| C33 | Cable-routing module | Routing voids and service access |
| C34 | Ventilation module | Ventilation openings and clearance |
| C35 | LED channel | Routed recess/slot and wire access |
| C36 | Moisture barrier | Material-edge and service metadata |
| C37 | Access panel | Removable panel, service envelope |
| C38 | Soft-close/damper | Mechanism compatibility |
| C39 | Locking mechanism | Lock clearance and mounting |
| C40 | Replaceable decorative front | Independent front module and mounting |

**Initial functional implementation sequence:** C01 carcass → C04 compartment → C02 shelf → C15 drawer box → C17 front. The fixed starter drawer is not yet C15 as a generalized component. C16 hardware adapters, C29 edge and C30 joinery are extension points, not premature mandatory library builds.

## Furniture template catalog — 18 families, at least five structural variants each

Variants are **distinct construction/partition/operation recipes**, not renamed sizes, colors or finishes. They remain planned until the engine generates real assemblies and matching manufacturing parts.

| ID | Furniture family | Five dynamic construction configurations |
|---|---|---|
| F01 | Kitchen base cabinet | Door + shelves; 3-drawer bank; shallow + two deep drawers; sink/plumbing cavity; corner-access configuration |
| F02 | Kitchen wall cabinet | Single door; double door; lift-up front; open-and-closed zones; corner wall module |
| F03 | Tall pantry | Adjustable shelves; full-height pull-out; internal drawers behind door; split upper/lower; appliance+storage |
| F04 | Kitchen island | Two-sided storage; wide drawers; open display end; overhang support; sink/preparation arrangement |
| F05 | Chest of drawers | 3 equal drawers; 4–5 equal drawers; mixed shallow/deep; two columns; drawers + closed storage |
| F06 | Wardrobe | Long-hang; double-hang; adjustable shelving; rail + lower drawers; sliding fronts + mixed interior |
| F07 | Bed frame | Slatted platform; under-bed drawers; lift storage; concealed-support platform; integrated headboard storage |
| F08 | Bedside table | Drawer + open niche; two drawers; hinged cupboard; floating module; side shelf + cable routing |
| F09 | Bookcase | Adjustable shelves; staggered dividers; open upper+closed lower; wall modules; reinforced long spans |
| F10 | Sideboard | 3-door bays; center drawers + doors; sliding fronts; wide drawers; wall-mounted |
| F11 | TV console | Ventilated open center; closed side bays; drawer console; floating version; tall side modules |
| F12 | Display unit | Glass-front; mixed open/closed; sliding display; pocket-door workstation; two-sided divider |
| F13 | Desk | Four-leg+apron; one drawer pedestal; two pedestals; L-shape; adjustable-base compatible top |
| F14 | Bathroom vanity | Floating drawers; hinged+inner shelf; open+countertop; double sink; floor-standing plumbing recess |
| F15 | Entryway/shoe unit | Storage bench; tilt-out shoes; pull-out trays; hanging+bench; tall cabinet + boot bay |
| F16 | Table | Four-leg+apron; trestle; removable leaf; drop leaf; wall-folding |
| F17 | Laundry/utility | Broom tower; above-appliance shelves; removable bins; mixed modules; service-access tower |
| F18 | Modular divider/storage | Asymmetric cubes; stacked closed modules; partially closed; two-sided divider; interchangeable inserts |

**90 conceptual variants; 0 of these 90 claimed as independently implemented production recipes.** Existing open cabinet arrangements can serve as *starting prototypes* for F09/F01 without counting them as complete versions of those furniture types.

## Prioritized implementation ledger — update after EVERY execution

### Status semantics

- **Done**: corresponding acceptance has been satisfied in code or (for B00) required planning artifact committed, with path/commit evidence.
- **Partially done**: code exists but does not satisfy the full acceptance condition.
- **Not done**: not implemented in active `main`; a mock/gallery label does not count.
- **Dropped**: intentionally removed from planned approach with a documented reason; legacy compatibility may remain.
- Moving a row to Done needs an evidence reference and the smallest applicable verification. Do not mark a task Done because a PR was opened, a file was saved, or an AI response claimed completion.

| ID | Order | Initiative | Status | Current evidence / acceptance gap |
|---|---:|---|---|---|
| B00 | 0 | Publish this EDC backlog and permanent status convention | Done | `docs/modular-engine-backlog.md` on `main` |
| B01 | 1 | First-class template catalogue | Done | `src/furniture/templates.ts`: 7 versioned recipes (3 ready), registered root components and checked availability; CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) PASS. Additional template families B24 remain planned |
| B02 | 2 | Typed component-definition registry | Done | `src/furniture/component-engine.ts`: versioned `core/carcass` and `core/shelf` definitions, lookup and unsupported-version rejection; focused tests + CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) PASS |
| B03 | 3 | Component-instance tree with stable IDs | Done | `src/furniture/component-engine.ts` and optional `componentTree` on assemblies/presets: independent instance IDs, preserved root/shelf IDs on edits, legacy-safe JSON/Dexie boundary; focused tests + CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) PASS |
| B04 | 4 | Directed parameter inheritance / derived values | Done | Parent-scoped numeric bindings drive child width/depth/position; `cabinetBoxes()` now reads resolved tree so cutlist and 3D update together; focused tests + CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) PASS |
| B05 | 5 | Named attachment slots | Done | `core/carcass` declares `interior.main` with shelf/drawer compatibility and max 20; child instances carry named slots. CI 38113051014 PASS |
| B06 | 6 | Slot compatibility and cycle validation | Done | Resolution rejects incompatible slot children, duplicate IDs, unsupported definitions and capacity violations in this initial component scope. CI 38113051014 PASS |
| B07 | 7 | OP01 Insert | Done | Pure `insertComponent()` validates types; cabinet wizard inserts real drawer children and regenerates assembled geometry and cutlist. CI 38113051014 PASS |
| B08 | 8 | OP04 Repeat | Done | `repeatComponents()` preserves stable indexed child identities, updates parent count and recomputes dependent dimensions. Cabinet wizard repeats shelves/drawers in both single and split bays; focused tests CI 38114434330 PASS |
| B09 | 9 | OP02 Replace | Done | `replaceComponent()` performs immutable, compatible node substitution, updates parent shelf/drawer count, blocks mixed unpartitioned contents; bay selection replaces shelves with drawers. Tests CI 38114434330 PASS |
| B10 | 10 | OP03 Split | Done | `splitCompartment()` creates two separately parameterized `core/compartment` children, vertical or horizontal divider and real cut parts; ratio, content kind and counts editable in wizard. Tests CI 38114434330 PASS |
| B11 | 11 | OP05 Connect | Done | `connectModules()` validates two same-height/depth/thickness carcasses and right-docks module 2 via parent-width binding; complete connected 3D/cutlist and distinct panels. Scope: right-side two-module join only; arbitrary-direction docking deferred. CI 38114434330 PASS |
| B12 | 12 | C01 generic reusable carcass | Done | The existing `core/carcass` definition now serves ordinary, split, and connected cabinet assemblies, with independently configured module sizes/contents; same generator, cutlist and 3D projections. CI 38114434330 PASS |
| B13 | 13 | C02/C03 shelf component | Done | `core/shelf` reused directly and inside split compartments, repeated via `repeatComponents`; optional individually adjustable percent positions for unsplit shelves, with clear-gap constraints. Pin-drilling rules are deferred. CI 38114434330 PASS |
| B14 | 14 | C04 compartment component | Done | `core/compartment` definition has independent width/height/x/z, contents slot and child parameter derivation. Two split bays generate correctly sized shelves/drawers and divider using parent changes. CI 38114434330 PASS |
| B15 | 15 | C15 reusable drawer box | Done | `src/furniture/drawer.ts` builds side/back/inner-front/bottom plus optional applied front, opening-driven for standalone and cabinet components, independently editable. CI 38113051014 PASS |
| B16 | 16 | C17 configurable drawer fronts | Done | Versioned `core/drawer-front` occupies drawer `front.main` slot and derives applied-front dimensions or lowered finger-pull inner front from parent opening; `drawerPanels` consumes the resolved front geometry. Focused tests and CI 38115071468 PASS |
| B17 | 17 | One normalized 3D + cut-list + BOM model | Done | `src/furniture/furniture-model.ts` derives per-assembly positioned solids, actual manufacturing quantities, hardware schedule and diagnostics; assembled 3D renderer and Fusion snapshot use this model; cabinet preview uses the same pipeline. CI 38115071468 PASS |
| B18 | 18 | Complete assembled-item preview | Done | All **ready** cabinet, chest and drawer objects show a complete positioned assembly using one `PositionedFurniturePreview` path; manual cut rows do not invent assembly positions, and planned kinds remain disabled. CI 38115071468 PASS |
| B19 | 19 | Versioned template recipes and independent instances | Done | Saved presets advance `revision` on explicit Save; inserted cut parts and assembled furniture carry immutable `sourcePreset` ID/revision/definition/template pins, while their editable dimensions and component trees remain independent snapshots. JSON/IndexedDB preserves them; tests `db.test.ts` + CI 38117222030 PASS |
| B20 | 20 | Legacy migration / save & restore compatibility | Done | `legacy-adapter.ts` reconstructs known historical cabinet/drawer component trees deterministically **in memory** on read; no overwrite of old IndexedDB rows, no destructive schema change. Existing JSON/Dexie migrations remain; targeted tests prove stable IDs and stored-data preservation, CI 38117222030 PASS. Unknown future schemas not claimed supported |
| B21 | 21 | Template recipe #2 from shared components: chest of drawers | Done | Five distinct functional ready recipes (`chest-3-drawer`, `chest-5-drawer`, `chest-two-column`, `chest-mixed-drawers`, `chest-open-shelf`) reuse existing carcass, split-compartment, drawer and front definitions; catalog and wizard can create/save/edit. CI 38115071468 PASS |
| B22 | 22 | Generalized create/edit/save preset flow | Partially done | Cabinets, chest variants, drawer modules and manual cutlists support create/edit/save. **Customize for project** now permits isolated edits to a saved preset and inserts only on explicit user action, retaining the saved source ID/revision without modifying or duplicating the library record (`PresetCustomization.tsx`, `presets/customize.ts`). A generic editor for **new registered root kinds** without manufacturing generators remains unimplemented. CI [38202868555](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38202868555) and Pages [38202868533](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38202868533) PASS |
| B23 | 23 | Incompatibility/collision diagnostics | Done | Component resolver rejects invalid attachment slots/duplicate nodes, cabinet generator checks dimensions/runner fit and `geometry-diagnostics.ts` rejects intersecting 3D panel extents with numeric mm overlap diagnostics. Hardware travel, fittings drilling and structural certification explicitly excluded. CI 38115071468 PASS |
| B24 | 24 | Template expansion: 18 families / 90 variants | Partially done | **52 buildable templates**, 49 prior plus 3 verified geometry-backed enclosure arrangements (single-door kitchen base, double-door wall carcass, enclosed sideboard). New registered `core/back-panel` and `core/hinged-door` panel definitions derive cut sizes from carcass dimensions; optional back/front choices produce positioned 3D panels, cutlist, versioned instances and hinge/fixing **sets requiring supplier-specific selection**. Doors over drawer fronts are rejected. These are externally applied *static* door leaves; hinge motion, drilling, load capacity, wall mounts, plinths, lift/sliding mechanisms, wardrobes and beds remain UNIMPLEMENTED. The full 18-family × 5-variant target is NOT complete; 52 ready cards are not 52 of the originally specified 90 mechanisms. Verification: GitHub CI run 39315685574 (feature commit `f1eaca7`), see run status before release |
| B25 | 25 | Standalone per-cut-piece 3D as primary furniture preview | Dropped | User explicitly requires complete furniture preview; cutlist stays tabular |
| B26 | 26 | Material/hardware/joinery-grade advanced rules | Not done | Intentionally deferred; keep material thickness parametric |
| B27 | 27 | Photo-realistic styling / finish controls | Not done | Intentionally deferred; not a prerequisite for component engine |
| B28 | 28 | Cross-template geometry/cutlist parity verification | Done | `src/tests/unit/furniture-model.test.ts` verifies every ready cabinet/chest variant plus standalone drawer fronts: 3D oriented physical extents, per-piece cut quantities, runner BOM, versioned snapshots, legacy records and collision checks. CI 38115071468 PASS |
| B29 | 29 | Building-component catalogue in Add Item and presets | Done | `CabinetConfigurator.tsx` lists drawer/shelf and planned components; `PresetManager.tsx` creates, edits, duplicates and inserts drawer presets. CI 38113051014 PASS |
| B30 | 30 | Parametric runner-aware drawer builder | Done | `DrawerConfigurator.tsx` and `drawer.ts` support selected side/under/custom runners, nominal length, opening clearances, lowered finger-pull or applied/inner-only fronts; repeat in cabinets and independent edits. Focused tests CI 38113051014 PASS |
| B31 | 31 | Separate hardware requirements list | Done | `drawerHardware()` schedules runner pairs and optional front handles independently of board cuts in drawer and cabinet UI; not a complete drilling or supplier BOM. CI 38113051014 PASS |

### Stage gates / exact next milestone

**Iteration 1 completed (2026-10-11): B01–B04.** Versioned template roots and typed component tree are live in the cabinet generation path; tree data is stored on assemblies and presets. CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) passed lint, typecheck, kernel, unit, build and existing browser checks. B05/B06/B07 remain the next milestone.

**Original Iteration 1 acceptance definition (completed): B02 + B03 + B04 with the smallest proof that parent width changes a child clearance**, using existing cabinet as one compatible adapter. Do **not** build the entire 40-component library first.

- A typed component registry can register the carcass and shelf definitions by ID/version.
- A cabinet owns at least one `interior.main` child slot; a shelf instance can occupy that slot.
- Rebuilding after changing cabinet width updates the shelf solid and cutlist width without touching another project item.
- Existing CabinetSpec presets/projects load unchanged; no destructive migration; no new E2E.
- No second "drawer geometry engine" is introduced; B15 comes later.

**Iteration 2 completed (2026-10-11):** B05/B06/B07 implement the `interior.main` slot and the user's preferred configurable drawer as the first inserted child. C15 and the building-component UI are in place; generic repeat/replace/split remain separate checkpoints. CI 38113051014 PASS.

Original proposal (superseded): B05/B06/B07 insert with a reusable shelf in the named slot.  
**Iteration 3 completed (2026-10-11):** B08–B14, including repeat/replace, vertical or horizontal split bays, a right-docked second module, reusable carcass/adjustable shelf/compartment components. Verified by PR #5 CI 38114434330. B15 remains Done from the earlier reusable drawer milestone.
**Iteration 4 completed (2026-10-11):** B16, B17, B18, B21, B23, B28 and partial B24. Five genuine chest configurations and front components reuse the engine; geometry/Cut list/hardware are derived from a normalized model. CI 38115071468 PASS.

**Iteration 5 completed (2026-10-11):** B19 and B20 are Done; B22 advanced but remains Partial. Introduced atomic preset revision increments, pinned source identity/definition references for inserted parts and assemblies, stable non-destructive adapters for older cabinet and drawer records, and an explicit-save workflow for project-configured furniture. Tests: 25 kernel / 56 Vitest / 12 Playwright; lint, TypeScript and production build PASS. CI 38117222030 and GitHub Pages 38117222131 success. No new end-to-end tests were authored; existing browser suite ran in CI.

**Remaining roadmap:** B22 (general editor for future registered component roots), B24 (new furniture families), B26 (advanced material/hardware/joinery), B27 (photorealism). B19/B20 cover supported current and historical versions; unknown future schemas remain outside guarantees.

**Safety boundary:** Physical panel collision checks do not simulate drawer travel, hinge swings, fastener drilling, anchoring, or structural loads; manufacturing approval still requires engineering review.
**Scope limits:** Docking is limited to exactly two horizontally adjacent same-height/depth/thickness carcasses; no arbitrary 3D placement or joint engineering. Custom shelf positions describe location, not a verified shelf-pin hole pattern. Structural strength and hardware installation remain outside scope.  
Later: B23-B24 additional families and dynamic variants; advanced fittings only on request.

### Definition of done for the first full vertical slice

- Create a complete cabinet from an explicit template and component tree.
- Insert shelf into a compatible slot, replace with drawer and repeat drawer N=0/1/3.
- Change parent W/H/D; affected children update deterministically.
- A second chest-of-drawers template reuses **the same** drawer generator.
- Render one **complete furniture 3D object** from normalized geometry; cut rows and quantities match derived parts.
- Save one configuration as a preset, instantiate into two projects, edit one without mutating the other or the preset.
- Legacy projects/presets continue to load and export with no data loss.
- Generate Fusion Python snapshot from exact normalized assembly where supported, with limitations stated.
- Reject invalid geometry/incompatible children with actionable diagnostics.

### Execution protocol (mandatory for every future coding/repo iteration)

1. Read this ledger, `AGENTS.md`, `docs/progress.json`, and the actual `main` code. Recover precise starting status; compare expected and observed changes.
2. Select **one smallest coherent milestone**; perform Explore → Doubt → Compare for relevant alternatives, preserve accepted decisions and defer nonessential abstractions.
3. Implement only required working behavior. Prefer lint + typecheck + build and focused unit verification where it protects geometry/data. No new E2E or broad refactors by default.
4. Update ledger **in the same iteration** with status changes, evidence/commit, unresolved gaps. Never claim Done when unverified.
5. Publish only when requested and minimum verification passes. Distinguish pushed main commit, GitHub Pages workflow and independently checked live behavior.
6. Every final response must include:
   - concise details of what changed and where;
   - **Done / Partially done / Not done / Dropped table** covering all active B-IDs (may group unchanged contiguous rows only if each ID is identified);
   - any blockers and the next lowest-risk milestone;
   - **Skipped this iteration** (explicit tasks consciously deferred).
7. Maintain one canonical ledger instead of proliferating disconnected TODO files. Do not silently remove or renumber IDs; mark deprecated items Dropped and explain why.

## External conceptual references (research leads; links not proof of implementation)

- IKEA PAX/KOMPLEMENT, BESTÅ, PLATSA systems: https://www.ikea.com/
- Roomle modular 3D/product configuration and component architecture: https://www.roomle.com/
- Configura / CET design and configurable product rules: https://www.configura.com/
- Blum e-services cabinet/product configuration: https://www.blum.com/
- Hettich cabinet/hardware reference systems: https://www.hettich.com/
- Accuride 3832 slide mounting side-space reference (12.9–13.2 mm per side): https://help.accuride-europe.com/knowledge/installing-drawer-slides
- Blum MOVENTO woodworking planning dimensions (box width = opening −42 mm, nominal length adjustment and side-thickness envelope): https://publications.blum.com/2022/catalogue/en/421/

Runner profiles implement a sizing envelope only; exact drilling, fastening and other model-specific manufacturer installation requirements remain unverified. Metal runner pairs and optional handles are scheduled separately from board cut parts.

Compare actual manufacturer requirements and published docs before implementing specific connectors, mechanisms or manufacturing tolerances. This backlog is a **design contract and implementation tracker**, not a verified manufacturing handbook.

**Iteration 6 (2026-10-12, verified):** B22 advanced with project-only preset customization. Saved manual rows, configured cabinets/chests and drawer modules can open as isolated drafts, adjusted and explicitly inserted into a chosen project without adding or editing a library preset. Cutlist parts retain source revision pins and rebuilt assemblies retain independent geometry. Modified fixed-size starter drawer panels are not given fabricated 3D positions. CI: 25 kernel, 58 Vitest, 12 Playwright; CI 38202868555 and Pages 38202868533 PASS. **B22 remains Partially done** because unimplemented root types cannot be projected into manufacturing geometry.

**Iteration 7 (2026-10-12, B24):** Usable template selection increased **9 → 19**, with ten additional manufacturing-backed carcass configurations, grouped by furniture category and searchable via the category selector. "Ready" requires real cutlist, collision-free panels, 3D placement, and serializable versioned preset; dedicated desk, wardrobe, and complete TV/door hardware templates remain planned. Feature PR #7 merged as `811d85c`; verified branch CI 38204846862 (kernel 25, Vitest 60, Playwright 12 PASS). **B24 stays Partially done** pending additional furniture-specific structural roots.

**Iteration 8 (2026-10-13, B24):** 19 → 49 working recipes. Added `core/surface` parent/positioned model, six support layout modes for 5 desks + 5 tables, on-demand 3D editor with Fusion Python output, and 20 further open/drawer casework arrangements. `SurfaceSpec` serializes on assemblies and presets without a Dexie schema change. Worktop presets support explicit create/edit/duplicate/customize, pin sources to their saved revisions, and no unsaved draft writes. CI 38325171870: 25 kernel/62 unit/12 browser PASSED. Merge `f2018211`. B24 **remains Partially done**; the specified 18 families × 5 construction mechanisms are NOT yet all manufacturing ready. Dedicated bed support, rail, door/hinge and wall-support components must not be represented by ordinary open-carcase panels or claimed as validated.

**Iteration 9 (2026-10-19, B24):** Added two reusable enclosure leaf definitions (`core/back-panel@1`, `core/hinged-door@1`) with geometry and cutlist projections, explicit configuration controls, optional back and single/double door support, invalid drawer overlay detection, normalized hinge/fixing SET requirements with drilling marked TBD, and three additional ready recipes (49 → 52). Stored cabinet specs remain backward-compatible and disabled by default, without Dexie schema changes. **Hardware fitting and physical loads are not verified; B24 stays Partially done and B26 remains Not done.** Tests in `src/tests/unit/cabinet-enclosures.test.ts`; CI https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/39315685574.
