# Modular Furniture Engine — EDC Architecture & Execution Backlog

**Project:** `chiriacsergiucs-v2/furniture-builder`  
**Backlog version:** 1.0 · 2026-10-11 · **Canonical status source for this initiative**  
**Implementation branch policy:** Work on `main` when explicitly requested. Preserve user data.  
**Current iteration:** Design/specification only; **no new engine capability claimed**.

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
| B05 | 5 | Named attachment slots | Not done | Slot IDs, anchors and multiplicity absent |
| B06 | 6 | Slot compatibility and cycle validation | Not done | No cross-component type validation |
| B07 | 7 | OP01 Insert | Not done | Need real insertable shelf/drawer slot |
| B08 | 8 | OP04 Repeat | Partially done | `cabinetBoxes` repeats equal shelves; not generic component repetition |
| B09 | 9 | OP02 Replace | Not done | Swap shelf for drawer within same compartment |
| B10 | 10 | OP03 Split | Not done | Create independently configurable child bays |
| B11 | 11 | OP05 Connect | Not done | Attach two compatible furniture modules with transforms |
| B12 | 12 | C01 generic reusable carcass | Partially done | `src/furniture/cabinet.ts` creates one fixed construction pattern |
| B13 | 13 | C02/C03 shelf component | Partially done | Cabinet-specific shelf count/spacing, no independent definition or slot |
| B14 | 14 | C04 compartment component | Not done | Parent opening not modeled as configurable child node |
| B15 | 15 | C15 reusable drawer box | Partially done | `assembly/model.ts` has only fixed 40×30 starter; no parent-driven dimensions/bottom |
| B16 | 16 | C17 configurable drawer fronts | Partially done | Fixed starter front, no independent adaptable front |
| B17 | 17 | One normalized 3D + cut-list + BOM model | Partially done | Cabinet builds matching boxes/parts, but no generic shared `FurnitureModel`/BOM |
| B18 | 18 | Complete assembled-item preview | Partially done | Cabinet and positioned assemblies preview exists; not supported for every planned template |
| B19 | 19 | Versioned template recipes and independent instances | Partially done | Dexie presets/project assemblies exist; version-pinned component recipes not yet supported |
| B20 | 20 | Legacy migration / save & restore compatibility | Partially done | Dexie + current backups exist; future graph adapters/migration not implemented |
| B21 | 21 | Template recipe #2 from shared components: chest of drawers | Not done | Prove carcass + repeated adjustable drawers reuse |
| B22 | 22 | Generalized create/edit/save preset flow | Partially done | Cabinet-only wizard and saved preset supported; composition engine integration missing |
| B23 | 23 | Incompatibility/collision diagnostics | Partially done | Cabinet dimension validation exists; no cross-component slot/collision diagnostics |
| B24 | 24 | Template expansion: 18 families / 90 variants | Not done | Catalog/variants specified above, generators not implemented |
| B25 | 25 | Standalone per-cut-piece 3D as primary furniture preview | Dropped | User explicitly requires complete furniture preview; cutlist stays tabular |
| B26 | 26 | Material/hardware/joinery-grade advanced rules | Not done | Intentionally deferred; keep material thickness parametric |
| B27 | 27 | Photo-realistic styling / finish controls | Not done | Intentionally deferred; not a prerequisite for component engine |
| B28 | 28 | Cross-template geometry/cutlist parity verification | Not done | Focused checks should be added only as new logic warrants |

### Stage gates / exact next milestone

**Iteration 1 completed (2026-10-11): B01–B04.** Versioned template roots and typed component tree are live in the cabinet generation path; tree data is stored on assemblies and presets. CI [38111997423](https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38111997423) passed lint, typecheck, kernel, unit, build and existing browser checks. B05/B06/B07 remain the next milestone.

**Original Iteration 1 acceptance definition (completed): B02 + B03 + B04 with the smallest proof that parent width changes a child clearance**, using existing cabinet as one compatible adapter. Do **not** build the entire 40-component library first.

- A typed component registry can register the carcass and shelf definitions by ID/version.
- A cabinet owns at least one `interior.main` child slot; a shelf instance can occupy that slot.
- Rebuilding after changing cabinet width updates the shelf solid and cutlist width without touching another project item.
- Existing CabinetSpec presets/projects load unchanged; no destructive migration; no new E2E.
- No second "drawer geometry engine" is introduced; B15 comes later.

**Iteration 2:** B05/B06/B07 insert with a reusable shelf in the named slot.  
**Iteration 3:** B08/B09 repeat and replace, including a reusable drawer box.  
**Iteration 4:** B10 split compartments.  
**Iteration 5:** B17 B19 B21 implement a chest from shared carcass+drawer components.  
**Iteration 6:** B11 connect independent modules, test cross-template reuse.  
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

Compare actual manufacturer requirements and published docs before implementing specific connectors, mechanisms or manufacturing tolerances. This backlog is a **design contract and implementation tracker**, not a verified manufacturing handbook.
