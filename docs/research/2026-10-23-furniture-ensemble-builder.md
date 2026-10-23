# Furniture Ensemble Builder — Deep Research & Product Strategy

**Research snapshot: 23 October 2026.**  
**Primary product question:** given an existing library of parametrically configurable furniture items, what should be added so users can combine those items into complete, valid, editable furniture ensembles without rebuilding the individual items themselves?

## Executive summary

The research points to a fairly clear answer: **the highest-value product is not primarily a room visualiser, an AI interior designer, or a miniature CAD package. It is a guided composition system.**

The strongest pattern across IKEA, Roomle, Coohom, SketchUp, professional kitchen systems and specialist modular configurators is a workflow in which users choose existing modules, position them, connect them, configure them in context, and allow the system to manage the consequences. IKEA demonstrates the consumer mental model; Roomle has one of the clearest documented architectures for parent/child docking, component-local parameters, global parameters and order lists; Coohom demonstrates automatic generation of ensemble-level elements such as countertops, crown moulding and toe-kicks; Cabinet Vision and Cyncly show where this model can eventually extend into quotation and manufacturing. [^ref-1]

The single most important architectural decision is therefore to add a **composition layer above the existing furniture templates**, rather than merge the furniture editor and ensemble editor into one monolithic model. An existing cabinet, wardrobe, desk or shelving template should remain an independently configurable object. Composition metadata—connectors, mating surfaces, clearance envelopes, compatibility tags and dependency rules—should tell the ensemble editor how instances may interact. Roomle's documented distinction between independently parameterised components joined through docking is particularly close to this requirement. [^ref-2]

The first product milestone should centre on six capabilities:

**guided snapping, compatibility validation, clearance/collision checking, in-context parametric editing, precise 2D/3D manipulation, and reversible group operations.**

That combination is more important than photorealistic rendering. SketchUp's custom Snaps are instructive because a snap can simultaneously establish position and orientation; Roomle docking similarly gives components defined mating positions and orientations. Users also need the opposite capability: snapping must be understandable and temporarily bypassable. Planner 5D users have explicitly complained about snapping they could not disable, difficulty selecting overlapping objects, lack of grouping, and insufficient precision. [^ref-3]

The second major finding is that **validity must be active, not passive**. A furniture application should not merely draw objects that happen to overlap. It should understand door swings, drawer travel, wall clearance, neighbouring modules, connector compatibility, required filler dimensions and other operational clearances. User reports show the consequences when this does not happen: PAX configurations have been reported where drawers conflict with doors or hinges, and another IKEA planning complaint described a kitchen layout that contained physically overlapping cabinets. These are anecdotes rather than statistically representative studies, but they reveal exactly the class of error a purpose-built ensemble system should prevent. [^ref-4]

A third high-value feature family is **ensemble-derived parts**. Countertops, worktops, plinths/toe-kicks, fillers, end panels, crown moulding and shared structural elements should not normally behave like manually placed independent products. They should be derived from the modules they span. Coohom already allows cabinets to be selected and countertops, crown moulding and toe-kicks to be generated; Roomle's shelving examples demonstrate shared logic and cross-component parameter behaviour. User installation discussions also repeatedly show that fillers and clearances are not decorative details—they determine whether the final furniture can actually be installed and opened. [^ref-5]

A fourth opportunity is **cross-family composition**. IKEA's individual planners are excellent examples of constrained product-family configuration, but their separation also exposes an unmet need. A user explicitly asked for one environment combining PAX, MALM, ALEX, a desk, a bed and other IKEA products, and complained that mobile planners exposed fewer capabilities than desktop. This is only anecdotal evidence, but it aligns very closely with your intended differentiation: one workspace where wardrobes, cabinets, shelving, desks and other compatible products can participate in the same assembly model. [^ref-6]

AI should be **late in the roadmap and subordinate to deterministic constraints**. AI is useful for creating candidate layouts, interpreting natural language, style matching and generating alternatives. It should not decide whether two cabinets physically mate, whether a drawer can open or whether a countertop is manufacturable. Coohom is actively developing AI kitchen auto-layout, while Planner 5D offers automated/AI-assisted placement, but the latter's own guidance emphasises checking real dimensions and clearances. The recommended architecture is therefore **AI proposes → deterministic engine validates → user accepts/edits**. [^ref-7]

**UNFULFILLED — reliable feature-level usage telemetry.** No public source found exposes comparable analytics such as “X% of active users use snapping” or “Y% use automatic countertops” across these products. Consequently, this report does **not** claim measured “most-used” rankings. “Competitor adoption” below means how broadly a pattern appears in documented products, while “user demand” and “appreciation” use public feedback as qualitative evidence. This distinction is important: implementation prevalence is a useful signal, but it is not the same thing as usage frequency.

**Bottom-line recommendation:** build a **constraint-aware ensemble editor** before building a sophisticated AI designer. The product's distinctive promise should be:

> **Take furniture you already have in the system, connect it rapidly, and know that the resulting ensemble remains compatible, editable and explainable.**

## Competitor comparison

The competitive landscape divides into four useful groups. IKEA represents product-family configurators designed for consumers. Roomle and specialist B2B configurators represent rule-driven modular composition. Planner 5D, HomeByMe, Homestyler and Sweet Home 3D emphasise room planning and visualisation. Cabinet Vision, Cyncly and pCon represent professional design-to-order or design-to-production workflows. Your opportunity sits between the first two groups: **consumer-level simplicity with substantially stronger ensemble intelligence.**

| Product | Actual ensemble behaviour and differentiator | Praise / complaints / missing capability signal | Commercial model | Evidence |
|---|---|---|---|---|
| **IKEA Kitchen Planner** | Online 3D kitchen planning around IKEA modules; proposals can be adapted to the floor plan and product combinations. IKEA also offers specialist review. [^ref-8] | Strong consumer mental model: choose modules and see the finished kitchen. Public reports nevertheless show clearance, missing-item and even impossible-layout problems can escape planning. [^ref-9] | Consumer planner; no separate planner software fee | **High** for capability; **medium/low** for user anecdotes |
| **IKEA PAX Planner** | Family-specific wardrobe configuration with editable combinations and saved designs. IKEA maintains separate planners for PAX and other storage systems. [^ref-10] | Users value customisation but report feature differences across desktop/mobile, room modelling limitations and interference cases. One explicit request is a unified IKEA planner capable of mixing product families. [^ref-11] | Consumer web configurator | **High/medium** |
| **IKEA BESTÅ Planner** | 3D product-family configurator for modular storage. IKEA describes BESTÅ and related systems as combinations users can configure by size, style and colour. [^ref-12] | Clear modular metaphor, but substantially less public evidence was found about feature-level satisfaction than for Kitchen/PAX. | Consumer web configurator | **High capability; low user-signal confidence** |
| **SketchUp** | General-purpose modelling rather than furniture rules. Groups/components support reusable objects; Snaps let authors define meaningful attachment positions and orientation, while inference points support corners, centres and midpoints. [^ref-13] | Frequently valued for flexibility and direct modelling; the trade-off is that the user must construct much of the semantic furniture logic themselves and newcomers report a learning curve. [^ref-14] | Free web tier plus paid plans; free tier has commercial restrictions. [^ref-15] | **High** |
| **Roomle / Rubens** | One of the closest architectural analogues. Components have their own parameters; docking creates explicit parent/child relations with compatible docking points, orientations and conditions. Global parameters propagate common choices; dimensions, pricing and part lists are supported. [^ref-16] | Particularly strong for configurable furniture and commerce. Less independent public feedback was found than for mass-market room planners, so vendor documentation is the strongest evidence here. | Consumer floorplanner is free; commercial Rubens plans are paid, with Room Designer listed from €650/month or €6,500/year at research time. [^ref-17] | **Very high capability; medium user-signal confidence** |
| **Planner 5D** | Easy 2D/3D room design, drag-and-drop catalogue and AI-assisted floor-plan/layout features. [^ref-18] | User feedback is unusually useful: requests include disabling snapping, group selection, selection boxes, cycling overlapping objects, better precision/tooltips and stronger recovery/version history. [^ref-19] | Free tier plus Premium/Professional subscriptions. [^ref-20] | **High** |
| **HomeByMe** | Strong room-level workflow: construct the floor plan in 2D, furnish/visualise in 3D, resize generic objects, change finishes, create custom furniture and import models on applicable plans. [^ref-21] | Users have praised its approachable visualisation workflow; it is less specialised in semantic module-to-module furniture compatibility. [^ref-22] | Free entry plus paid consumer/professional plans. [^ref-23] | **High** |
| **Homestyler** | Combines room design with parametric kitchen/bath custom furniture. Official functionality includes cabinet/wardrobe parameters, quotations and design-to-production drawing exports. [^ref-24] | Good example of hiding technical complexity behind drag/drop and templates. Public users have noted inconsistencies between mobile and desktop workflows; some material/custom-furniture limitations appear in support discussions. [^ref-25] | Free, Pro, Team and Enterprise plans. [^ref-26] | **High/medium** |
| **Sweet Home 3D** | Mature 2D-plan + 3D-preview interior planner with importable model libraries. [^ref-27] | Strong as an accessible general floorplanner; much weaker as a semantic modular-furniture configurator. I found insufficient current public evidence to rank specific ensemble features by user appreciation. | Free/openly usable desktop application, with platform-specific distribution options. [^ref-28] | **High capability; low feature-demand confidence** |
| **Coohom Kitchen & Closet** | Very relevant competitor: users combine base, wall and countertop cabinets, adjust size/material/style and generate countertops, crown moulding, toe-kicks, sinks, handles and other derived components. [^ref-29] | Excellent example of ensemble-derived finishing parts. One independent user report criticised the interface and documentation despite liking output quality, so power-versus-complexity remains a risk. [^ref-30] | Free/basic entry plus paid professional/enterprise plans. [^ref-31] | **Very high** |
| **Cabinet Vision** | Professional cabinet design-to-manufacture workflow; the Hexagon furniture suite generates BOMs, optimised cut lists and manufacturing data. [^ref-32] | Strong reference for the eventual manufacturing end-state, but too production-oriented to use as the primary consumer UX reference. Independent current feature-demand evidence was limited. | Commercial professional software | **High capability; medium/low consumer relevance** |
| **pCon.planner / pCon ecosystem** | Professional space planning built around live manufacturer data, precise placement, configurable products, item lists and project documentation. Reference copies allow one product definition to be reused and updated across multiple instances. [^ref-33] | Especially useful precedent for a multi-supplier catalogue and reusable instances rather than monolithic geometry. Public user-demand evidence is weaker than official documentation. | Marketing Edition free; professional ecosystem/products paid. [^ref-34] | **Very high capability** |
| **Cyncly Design Flex** | Professional kitchen/bath/closet design built around configurable manufacturer catalogues, live product/pricing data and quoting. 2020 Design was rebranded/evolved into Design Flex in February 2026. [^ref-35] | Demonstrates value of catalogue accuracy and design-to-sale continuity. It is explicitly professional rather than homeowner-oriented, and pricing creates a very different market position. | $2,495/year without the Success Plan for the main Design Flex tier at research time; Foundation is cheaper. [^ref-36] | **Very high** |
| **PARAMETRA** | Specialist modular-furniture configuration: rule-driven valid positions, dependent structural components and exports including BOM/CSV/JSON and CAD formats. [^ref-37] | Architecturally very close to the target problem, especially for “valid-by-construction” shelving. Public independent user evidence was not found. | B2B/custom deployment | **Medium-high; mainly vendor evidence** |
| **VividWorks** | Rule-based modular furniture configuration with materials, pricing, BOMs and assembly information. [^ref-38] | Relevant B2B precedent for rules + commerce; independent satisfaction/usage data was not located. | Enterprise/B2B | **Medium; vendor evidence** |
| **Salsita / specialist custom configurators** | Provides connected modular furniture and room configurations with rule checks, configurable dimensions and production-oriented integration. [^ref-39] | Reinforces the commercial demand for semantic rules rather than plain 3D placement. Independent feature-level demand evidence was not located. | B2B/custom | **Medium; vendor evidence** |

**What the comparison says.** IKEA is the better benchmark for the *user's mental model*, Roomle for the *composition data model*, Coohom for *automatic ensemble-derived parts*, SketchUp for *controllable spatial interaction*, and Cabinet Vision/Cyncly for the *long-term downstream manufacturing/commercial pipeline*. No single competitor is the ideal template for your whole product. [^ref-40]

The common UX pattern among approachable tools is **2D for exact planning, 3D for comprehension and visual confirmation**. Roomle explicitly converts between plan and 3D views; HomeByMe promotes drawing accurately in 2D and furnishing in 3D; Planner 5D similarly presents editable 2D/3D planning. That argues against a 3D-only ensemble editor. [^ref-41]

## User evidence and feature inventory

**Most used — evidence limitation.** Public analytics are not available, so the safest proxy is widespread implementation. Drag/drop placement, 2D/3D switching, measurements, product catalogues, material changes, saving and room geometry appear across most general planners. That establishes them as category norms, not measured usage leaders. [^ref-42]

**Most appreciated.** Public feedback tends to praise the ability to see a design before buying/building it, rapid furniture placement, reusable/configurable objects and approachable visualisation. SketchUp users repeatedly value flexibility/components; HomeByMe users describe the visual planning workflow positively; IKEA users often use the planner as the starting point even when a professional later checks the result. [^ref-43]

**Most wanted.** The clearest recurring needs relevant to your product are precise manipulation, controllable snapping, grouping/multi-selection, unified catalogues rather than product-family silos, better version recovery, accurate dimensions and automatic handling of dependencies/clearances. Planner 5D feedback explicitly names grouping, selection-box behaviour and disabling snapping; an IKEA user explicitly asks for a single planner mixing wardrobes, dressers, desks and beds. [^ref-44]

**Biggest frustrations.** The most dangerous problems are not cosmetic. They are “looks right but cannot be built”: overlaps, blocked drawers or doors, insufficient appliance/filler clearances, missing hardware and dimension errors. There are also strong interaction frustrations when the system's automation cannot be overridden—especially snapping or selection behaviour. [^ref-45]

**Scoring method.** The table below is a product-research ranking, **not an invented usage statistic**. Each feature was judged ordinally on: core ensemble relevance 30%, documented/user demand 20%, UX improvement 20%, competitor adoption 15%, differentiation 10%, downstream leverage 5%. “Value” is the resulting researcher judgement on a 1–5 scale. Complexity is deliberately separate: a difficult feature can still be extremely valuable. P0 means foundational, P1 is next-stage, P2 advanced/professional, P3 experimental/later. Competitor adoption uses **High = broadly present**, **Medium = present in several specialised products**, **Low = limited/specialised**, rather than pretending to know active usage.

| Rank | Feature | User demand | Appreciation | Competitor adoption | Implementation complexity | Value | Evidence confidence | Priority |
|---:|---|---|---|---|---|---:|---|---|
| 1 | **Guided connection snapping with live preview and orientation** | High | High | Medium-high | High | **5.0** | High — Roomle/SketchUp patterns [^ref-46] | **P0** |
| 2 | **Compatibility-rule engine preventing invalid connections** | High | High | Medium | High | **5.0** | High — modular configurators + user failures [^ref-47] | **P0** |
| 3 | **Collision + operational-clearance detection** | High | High | Medium | High | **5.0** | High — real interference reports [^ref-48] | **P0** |
| 4 | **Precise numeric position, dimensions and gaps** | High | High | High | Medium | **4.9** | High [^ref-49] | **P0** |
| 5 | **Configure individual parametric items inside an ensemble** | High | High | High | Medium-high | **4.9** | High [^ref-50] | **P0** |
| 6 | **Synchronous 2D plan + 3D view** | High | High | High | Medium | **4.8** | High [^ref-51] | **P0** |
| 7 | **Explainable warnings with suggested repairs** | High | High | Medium-low | High | **4.8** | Medium-high; synthesis from validation failures [^ref-52] | **P1** |
| 8 | **Multi-select, groups and whole-ensemble transforms** | High | High | High | Medium | **4.7** | High; explicit request also found [^ref-53] | **P0** |
| 9 | **Transactional undo/redo** | High | High | High | Medium | **4.7** | High; complex editors continuously refine undo semantics [^ref-54] | **P0** |
| 10 | **Versioned save/reload of entire ensembles** | High | High | High | Medium | **4.7** | High; version-loss frustration documented [^ref-55] | **P0** |
| 11 | **Smart replace/swap with compatible alternatives** | High | High | Medium | Medium-high | **4.6** | Medium-high | **P1** |
| 12 | **Shared material/finish propagation** | High | High | Medium-high | Medium | **4.6** | High — Roomle global parameter precedent [^ref-56] | **P1** |
| 13 | **Automatically generated shared countertops/worktops** | High for cabinetry | High | Medium | High | **4.6** | High — Coohom directly implements it [^ref-57] | **P1** |
| 14 | **Automatic fillers, plinths/toe-kicks, end panels and trim** | High for cabinetry | High | Medium | High | **4.6** | High [^ref-58] | **P1** |
| 15 | **Automatic BOM / order list** | High | High | Medium-high | Medium | **4.5** | High [^ref-59] | **P0/P1** |
| 16 | Room/wall geometry, windows, doors and obstacles | High | High | High | Medium | 4.5 | High [^ref-60] | P0 |
| 17 | Edge/face/centre alignment and equal distribution | High | High | High | Medium | 4.4 | High; general CAD/planner pattern [^ref-61] | P0 |
| 18 | Lock/pin modules and preserve manual overrides | Medium-high | High | Medium | Medium | 4.4 | Medium; precision feedback supports it [^ref-62] | P1 |
| 19 | Duplicate, mirror and predictable rotate operations | High | High | High | Low-medium | 4.3 | High | P0 |
| 20 | Auto-fit a run/span using valid discrete module widths | High | High | Medium-low | High | 4.3 | Medium-high | P1 |
| 21 | Reusable ensemble templates | High | High | Medium | Medium | 4.3 | Medium-high; reusable component/configuration patterns [^ref-63] | P1 |
| 22 | Connection hierarchy / assembly graph | Indirect | Indirect | Medium | High | 4.3 | High technically — Roomle uses a docking tree [^ref-64] | P0 internal |
| 23 | Derived-component dependency regeneration | Indirect | High when invisible | Medium | High | 4.2 | High [^ref-65] | P1 internal |
| 24 | Live price/cost estimate | Medium-high | High | Medium-high | Medium if data exists | 4.1 | High [^ref-66] | P1/P2 |
| 25 | Hardware/fastener completeness | High for buildable products | High | Medium | High | 4.1 | Medium-high; missing-hinge example illustrates need [^ref-67] | P2 |
| 26 | Deterministic generation of alternative valid layouts | Medium-high | High | Low-medium | High | 4.0 | Medium | P2 |
| 27 | Auto-fill remaining span with modules + fillers | High for kitchen/storage | High | Medium | Very high | 4.0 | Medium-high | P2 |
| 28 | Section/cutaway and visibility isolation | Medium | Medium-high | Medium-high | Medium | 3.8 | Medium-high | P2 |
| 29 | Exploded assembly view | Medium | High for makers | Medium | High | 3.7 | Medium-high | P2 |
| 30 | Step-by-step assembly sequence | Medium | High for DIY | Medium-low | Very high | 3.7 | Medium | P2 |
| 31 | Cut-list generation | Medium overall; high professional | High professional | Medium-low | High | 3.6 | High in pro systems [^ref-68] | P2 |
| 32 | Sheet/material optimisation | Low consumer; high manufacturer | High professional | Low-medium | Very high | 3.4 | High professional | P2/P3 |
| 33 | Manufacturing/CAD/CNC export | Low consumer; high B2B | High professional | Medium | Very high | 3.4 | High [^ref-69] | P2/P3 |
| 34 | Inventory/availability-aware alternatives | Medium-high | High | Medium in commerce tools | High integration cost | 3.4 | Medium | P2 |
| 35 | Real-time collaboration/comments | Medium | Medium-high | Medium | High | 3.2 | Medium | P2 |
| 36 | Style/material recommendations | Medium | Medium | High in room-design apps | Medium | 3.1 | Medium | P3 |
| 37 | AI layout generation | Medium and rising | Mixed | Medium and rising | Very high | 3.0 | Medium; Coohom/Planner 5D implementations [^ref-70] | P3 |
| 38 | Natural-language ensemble generation | Emerging | Unproven | Low | Very high | 2.8 | Low-medium | P3 |
| 39 | AR placement | Low for core assembly | Mixed | Medium | High | 2.5 | Medium; one IKEA user explicitly found it low-value [^ref-71] | P3 |

The rank of **automatic BOM** deserves emphasis. For your product, this need not initially mean manufacturing-grade cut optimisation. At MVP level it can simply mean: “these are the furniture instances, options, generated fillers/tops and quantities required by this ensemble.” Roomle markets complete order lists, pCon builds precise item lists and Cabinet Vision extends the same principle into production BOMs. [^ref-72]

Likewise, **grouping should not mean flattening objects into one mesh**. SketchUp's distinction between reusable components and groups, Roomle's separate docked components and pCon's reference copies all support keeping object identity alive after composition. [^ref-73]

## Top recommendations and ensemble creation UX

The top fifteen implementation recommendations, ordered by product impact, are:

| Priority rank | Recommendation | Why it belongs near the top |
|---:|---|---|
| **1** | **Semantic snap connectors** | Make connectors more than geometric points. A connector should carry a coordinate frame, interface type, compatible types, allowable orientations and relevant dimensions. This converts “move until it looks aligned” into “attach this cabinet side to that cabinet side”. Roomle docking and SketchUp Snaps validate the interaction pattern. [^ref-46] |
| **2** | **A deterministic compatibility engine** | Stop invalid combinations before they become expensive downstream errors. Compatibility should consider product family, dimensions, connector types, structural rules and exclusions. |
| **3** | **Collision plus functional-clearance volumes** | A closed cabinet may not geometrically overlap anything yet its door or drawer may still hit another module. Model both static body bounds and motion/maintenance clearances. PAX and kitchen-user reports show why. [^ref-48] |
| **4** | **Precise numeric manipulation** | Dragging is fast; numbers make it trustworthy. Users should be able to type width, offset, gap, position and rotation while retaining snapping. Planner 5D feedback specifically criticises insufficient precision. [^ref-62] |
| **5** | **In-context parametric editing with propagation** | Changing a cabinet from 600 to 800 mm should preserve valid connections where possible and regenerate dependent parts. Roomle's parameter and global-parameter model provides a strong precedent. [^ref-74] |
| **6** | **One model, synchronous 2D and 3D views** | Do not maintain separate “2D project” and “3D project” states. Both views should be projections of the same ensemble graph. Roomle and HomeByMe reinforce this UX. [^ref-51] |
| **7** | **Explain errors and offer repairs** | “Invalid” is insufficient. Say “drawer clearance intersects left cabinet by 34 mm” and offer options such as change hinge side, add spacer, narrow module, move neighbour. This is a major opportunity to outperform generic planners. |
| **8** | **First-class multi-selection and grouping** | Users need to move a complete kitchen run, wardrobe bank or desk/storage combination without losing individual item configurability. Grouping is explicitly requested in Planner 5D feedback. [^ref-62] |
| **9** | **Atomic undo/redo** | A snap that simultaneously moves an item, connects it and regenerates a countertop should undo as one user action. Complex configurators continue to spend engineering effort on correct undo grouping. [^ref-54] |
| **10** | **Versioned ensemble persistence** | Store template versions, instance parameter overrides and connection metadata—not merely a flattened mesh. Version-loss complaints in planning software make save reliability a product feature, not plumbing. [^ref-55] |
| **11** | **Compatible replace/swap** | Replacing a 600 mm drawer cabinet with another compatible 600 mm cabinet should preserve placement, material context, group membership, neighbouring connections and generated top where possible. |
| **12** | **Ensemble-level materials** | Offer “apply to this module”, “this connected run” and “whole ensemble”. Roomle's global parameter context is a direct conceptual precedent. [^ref-75] |
| **13** | **Generated shared components** | A countertop, plinth or side finishing panel should depend on the cabinets it covers. Coohom demonstrates that users can generate these from selected cabinetry. [^ref-76] |
| **14** | **Room/context geometry** | Walls, corners, doors, windows, pipes/outlets and obstacle zones allow furniture validity to be checked against the actual environment, not only against other furniture. [^ref-77] |
| **15** | **Automatic ensemble BOM/order list** | Every change should update product quantities and derived pieces. This creates immediate practical value even before manufacturing exports exist. [^ref-78] |

**Recommended primary workflow**

The user's first interaction should remain catalogue-led rather than CAD-led. They open an ensemble workspace and choose a category such as Base Cabinets, Wardrobes, Shelving, Desks or Existing Designs. The catalogue should show existing templates rather than ask the user to model geometry.

When an item is dragged into the scene, the editor creates a **FurnitureInstance** referencing the existing template. The underlying template is not copied or destructively modified.

As the user drags a second item nearby, the editor queries nearby compatible connectors. Valid candidate connections appear visually—preferably with a small ghost/outline showing the resulting placement. Incompatible connectors remain absent or appear only when the user asks “why won't this connect?”. Roomle's matching docking points and SketchUp's snap model support precisely this kind of guided placement. [^ref-46]

The system should rank candidates by a deterministic score such as:

`connector compatibility → distance → orientation error → alignment preference → current editing axis → user locks`

The crucial UX detail is that **snap is previewed before it is committed**. Releasing the pointer creates a connection. A modifier key or UI toggle temporarily disables snapping; this directly addresses the frustration documented by Planner 5D users. [^ref-79]

After connection, the user can still select either item independently. Selecting the ensemble/group exposes common operations; selecting the item exposes its existing parametric controls.

If the user changes a cabinet width, the application runs a local dependency update:

`parameter change → connector frames recalculated → connected constraints re-solved → collisions/clearances rechecked → derived countertop/fillers regenerated → BOM refreshed`.

A change should never silently force an unrelated distant item to move. If propagation cannot preserve every hard constraint, stop and present the conflict.

For common parameters such as finish, offer a scope selector:

**This item / Connected run / Entire ensemble**.

That is easier to understand than exposing an abstract “global parameter” concept even though the underlying implementation can resemble Roomle's global parameter model. [^ref-75]

When multiple cabinets form a continuous run, derived-component actions become available. “Add countertop” should create **one dependent countertop object spanning that run**, not a collection of unrelated tops. “Add plinth” behaves similarly. Coohom's tooling strongly validates this UX direction. [^ref-76]

When a problem occurs, the application should select and explain it:

> **Door clearance conflict**  
> Tall cabinet A's door sweep intersects wall cabinet B.  
> **Possible fixes:** add 30 mm spacer · reverse hinge · move B · choose narrower cabinet.

This “diagnostic + repair” model is considerably more useful than red geometry alone.

Finally, the user saves either the **project** or the selected **ensemble as a reusable template**. The reusable ensemble stores item references, parameter defaults, relative transformations, connections, generated-component recipes and optional room-independent constraints. It should not embed a permanent copy of every item's geometry.

**Useful alternative workflows** should coexist with drag-and-drop:

A “build a run” workflow lets the user select a wall or draw a span, choose families and have the deterministic solver propose combinations of valid module widths plus fillers. A “replace” workflow allows users to select a module and browse only compatible alternatives. A “paste ensemble” workflow instantiates a previously saved assembly. Later, a natural-language workflow may turn “make a 3.2 m media wall with drawers below and tall storage at each side” into candidate ensembles—but only after the same rules engine validates them.

## Compatibility architecture

The architecture should preserve your existing standalone furniture system and add **composition metadata plus an ensemble runtime**.

React Three Fiber is a strong fit if the application is already React-based: it is a React renderer for Three.js and therefore keeps Three.js's scene capabilities while allowing scene objects to be organised declaratively as React components. Three.js provides raycasting for picking and TransformControls for transforms. [^ref-80]

For collision and clearance queries, Rapier is worth evaluating. Its JavaScript tooling explicitly separates broad-phase and narrow-phase collision detection and supports sensor colliders and scene queries. For a furniture editor, it should be used primarily as a **geometry/query engine**, not as a physics simulation: cabinets should not bounce, fall or be physically integrated. [^ref-81]

A practical TypeScript domain model could look like this:

```ts
type Id = string;
type Vec3 = readonly [number, number, number];
type Quat = readonly [number, number, number, number];

interface Transform {
  position: Vec3;
  rotation: Quat;
  scale?: Vec3;
}

interface ConnectorFrame {
  position: Vec3;       // Template-local coordinates
  rotation: Quat;       // Defines mating orientation
}

interface ConnectorDefinition {
  id: Id;

  // Semantic interface, not just geometry.
  kind:
    | "cabinet-side"
    | "cabinet-top"
    | "cabinet-bottom"
    | "wall-mount"
    | "shelf-support"
    | "desk-return"
    | "generic";

  frame: ConnectorFrame;

  compatibility: {
    acceptsKinds: string[];
    requiredTags?: string[];
    forbiddenTags?: string[];

    minWidth?: number;
    maxWidth?: number;

    // Example: only permit same-depth modules.
    parameterRules?: ParameterCompatibilityRule[];
  };

  snap: {
    radius: number;
    allowedRotationAxes?: ("x" | "y" | "z")[];
    orientationTolerance?: number;
  };

  // Extra volumes needed for doors, drawers, service access, etc.
  clearanceVolumes?: ClearanceVolumeDefinition[];
}

interface FurnitureTemplate {
  id: Id;
  version: number;

  name: string;
  category: string;

  // Reference to your EXISTING parametric item definition.
  itemDefinitionId: Id;

  geometryRef: string;
  parameterSchemaRef: string;

  composition?: {
    connectors: ConnectorDefinition[];
    tags: string[];

    bodyBounds?: BoundsDefinition[];
    operationalClearances?: ClearanceVolumeDefinition[];

    generatedPartRoles?: string[];
  };
}

interface FurnitureInstance {
  id: Id;

  templateId: Id;
  templateVersion: number;

  transform: Transform;

  // Only differences from the template defaults.
  parameters: Record<string, unknown>;
  materialOverrides?: Record<string, Id>;

  ensembleId?: Id;

  locked?: {
    position?: boolean;
    rotation?: boolean;
    parameters?: string[];
  };
}

interface ConnectorRef {
  instanceId: Id;
  connectorId: Id;
}

interface Connection {
  id: Id;

  a: ConnectorRef;
  b: ConnectorRef;

  rulesVersion: number;

  constraints: Constraint[];
  status: "valid" | "warning" | "invalid";
}

type Constraint =
  | {
      type: "dock";
      a: ConnectorRef;
      b: ConnectorRef;
    }
  | {
      type: "align";
      instances: Id[];
      axis: "x" | "y" | "z";
      mode: "min" | "centre" | "max";
    }
  | {
      type: "gap";
      a: Id;
      b: Id;
      distance: number;
    }
  | {
      type: "parameter-match";
      instances: Id[];
      parameter: string;
    }
  | {
      type: "clearance";
      instanceId: Id;
      clearanceId: Id;
    }
  | {
      type: "span";
      instanceIds: Id[];
      targetLength: number;
    };

interface GeneratedPart {
  id: Id;

  type:
    | "countertop"
    | "plinth"
    | "filler"
    | "end-panel"
    | "crown"
    | "shared-support";

  generatedFrom: Id[];          // Furniture instance IDs
  generatorVersion: number;
  parameters: Record<string, unknown>;

  // User changes that survive regeneration.
  overrides?: Record<string, unknown>;
}

interface Ensemble {
  id: Id;
  schemaVersion: number;

  name: string;

  instanceIds: Id[];
  connectionIds: Id[];
  generatedPartIds: Id[];

  groups: {
    id: Id;
    name?: string;
    instanceIds: Id[];
  }[];

  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}
```

This structure solves an important problem: **grouping and connection are different concepts**. A group says objects should be selected/transformed together. A connection says they have a semantic relationship. The same two objects may be in one group with no connection, or connected without belonging to the same selection group.

Likewise, **generated parts are not ordinary furniture instances**. A countertop should remember the cabinets that generated it and the algorithm/version used. When those cabinets move or resize, the top can be regenerated while preserving permitted user overrides.

The object hierarchy should be roughly:

```text
Project
 ├── Room / environmental geometry
 ├── Furniture instances
 │    ├── Template reference
 │    ├── Parameter overrides
 │    └── World transform
 ├── Ensembles
 │    ├── Instance membership
 │    ├── Groups
 │    ├── Connections
 │    └── Constraints
 ├── Generated parts
 └── BOM / derived outputs
```

**Do not encode the complete ensemble as a parent-child Three.js scene hierarchy.** Scene hierarchy is a rendering concern. The authoritative relationship should live in the domain graph. Otherwise an innocent reparenting operation can alter world transformations or corrupt product semantics.

**Connector design is the key content-authoring problem.** Roomle's documentation is useful here: docking points contain semantic placement logic and its product content also requires carefully defined pivots/component structure. In your system, existing templates can gradually acquire connectors without their internal model being rewritten. [^ref-82]

A connector should preferably describe a **coordinate frame**, not only a point:

```text
origin     = where the interface is
normal     = which way it faces
up         = desired vertical/reference direction
kind       = what interface it represents
rules      = what may mate
clearance  = what empty space is required
```

That allows a single snapping operation to calculate both translation and rotation.

**Constraint resolution should distinguish hard and soft constraints.**

Hard constraints include impossible dimensions, incompatible connector classes, mandatory structural dependencies and critical interference. A hard violation prevents commit or requires explicit resolution.

Soft constraints include visual alignment, equal spacing, preferred orientation and style continuity. The system may temporarily violate them while the user drags something.

Locks/manual overrides should outrank soft rules. This is essential for user trust: smart behaviour becomes frustrating when the application repeatedly “corrects” intentional placement.

Propagation should normally be **local to the connected component**. When one cabinet changes width, there is no reason to recompute an unrelated bedroom ensemble elsewhere in the project. Maintain a dependency graph and invalidate only affected connections, generated parts, BOM nodes and clearance checks.

For auto-fit, a pure continuous constraint solver is insufficient because furniture choices are often discrete—400, 600 and 800 mm cabinets, for example—and compatibility rules may be categorical. The core solver should therefore be a deterministic search/constraint layer under your control. A linear solver can still help with continuous quantities such as equal spacing, but it should not own product compatibility.

**Recommended technical stack**

| Layer | Recommendation | Reason |
|---|---|---|
| Rendering / scene | **Three.js + React Three Fiber** | Mature 3D primitives with React integration; R3F exposes Three.js capabilities declaratively. [^ref-83] |
| Picking | **Three.js Raycaster / R3F pointer events** | Built specifically for selecting/interacting with objects in 3D. [^ref-84] |
| Transform handles | **TransformControls or custom constrained gizmos** | Useful baseline, although furniture-specific handles will probably need custom UX. [^ref-85] |
| Collision/query | **Simple AABB/OBB first; Rapier for richer spatial queries** | Rapier supplies colliders, sensors, broad/narrow phase and query infrastructure. [^ref-86] |
| 2D plan | **Same scene/domain model with orthographic camera + overlays** | Avoids divergent 2D and 3D project states. |
| State | Central domain store, separate from rendered Three objects | Makes transactions, history, testing and persistence deterministic. |
| Undo/redo | **Command/transaction log** | One semantic operation can touch instances, connections, generated parts and BOM while remaining one undo step. |
| Persistence | Versioned JSON/domain records + separate asset references | Allows migrations and preserves template identity. |
| Collaboration later | **Yjs is a credible option** | Yjs shared types automatically merge concurrent changes and are designed for collaborative applications. [^ref-87] |
| Manufacturing later | Adapter layer from domain/BOM → cut list/CAD/CNC | Keeps production requirements from contaminating the core interaction model. |

R3F also supports on-demand rendering, useful for an editor where most scenes are static much of the time; this can reduce unnecessary continuous rendering on laptops and tablets. [^ref-88]

The most important engineering principle is **do not store authoritative application state inside Three.js objects**. The render tree should be a projection of your domain model. This makes save/load, testing, undo, constraints and server-side processing substantially easier.

## MVP and phased roadmap

The MVP should be deliberately narrower than an IKEA kitchen system but strong enough that “ensemble” means more than placing independent 3D models near one another.

**MVP definition**

A user must be able to load existing furniture templates, create multiple independent instances, position and configure them, form semantic connections, detect basic invalid placement, manipulate the resulting group, undo changes, save/reload the complete configuration and obtain an item list.

| MVP capability | Acceptance criterion |
|---|---|
| Existing-template instancing | The ensemble editor creates instances from current furniture templates without duplicating/reimplementing the template's internal parametric logic. |
| Catalogue placement | User can search/select an existing template and add multiple instances to a workspace. |
| Direct manipulation | User can move and rotate instances in 2D/3D and enter exact numeric transforms. |
| Connectors | Templates can optionally define semantic connection points; old templates without connectors continue to work as freely placed items. |
| Snap preview | Dragging near a valid connector visibly previews the proposed position/orientation before commit. |
| Snap override | User can temporarily disable/ignore snapping. |
| Connections | Committing a snap creates a persistent semantic connection independent of selection groups. |
| Compatibility | Invalid connector pairs are rejected or clearly reported rather than silently joined. |
| Collision | Static body intersections are detected and presented before finalisation. |
| Selection/groups | User can select one item, several items or a saved group and move them without flattening their independent configuration. |
| In-context parameters | Existing width/height/depth/material parameters can still be edited while the item belongs to an ensemble. |
| Revalidation | Parameter changes automatically rerun connection and collision validation for affected objects. |
| Undo/redo | Add, delete, move, rotate, snap, unsnap, parameter change and group operations can be reverted. Compound operations undo atomically. |
| Persistence | Saving and reopening restores template versions, parameter overrides, transformations, groups and connections. |
| BOM | Application outputs one entry per required product/configuration with quantities. |

A kitchen-style MVP should optionally add **one derived component type—countertop**—as a proving ground for the dependency architecture. If countertops are not strategically important to the first customer segment, postpone them, but implement the generic `GeneratedPart` mechanism early so the architecture does not later assume every scene object is manually placed.

**Effort terminology below is an engineering-planning estimate, not a researched market fact.** Assuming an existing React/TypeScript furniture editor, functioning 3D rendering and roughly three experienced engineers, I would use: S ≈ several engineer-days; M ≈ 1–3 engineer-weeks; L ≈ 3–6 engineer-weeks; XL ≈ 6–12+ engineer-weeks. Template metadata authoring, QA across hundreds of products, backend changes and manufacturing integrations can add substantial effort.

| Phase | Main work | Dependencies | Relative effort | Indicative sequence |
|---|---|---|---|---|
| **Functional ensemble creation** | Ensemble document model; instances; catalogue placement; selection; groups; numeric transforms; 2D/3D; connectors; basic snap; AABB/OBB collisions; undo/redo; save/load; initial BOM | Existing template API must expose parameters and geometry/bounds consistently | **XL overall** | First |
| **Intelligent compatibility and automatic adjustments** | Rich rule engine; clearance volumes; parameter propagation; compatible replacement; locks; repair suggestions; generated countertops/plinths/fillers/end panels; run auto-fit | Stable connector schema and dependency graph | **XL** | Second |
| **Manufacturing and advanced configuration** | Detailed hardware BOM; cut lists; deduplication; costing; exploded views; assembly sequence; DXF/STEP/CNC adapters as required | Stable product/part semantics and manufacturing data | **XL–XXL** | Third |
| **Smart layout and AI assistance** | Deterministic alternatives; optimisation; budget/style filters; natural-language intent; AI-generated candidate arrangements; collaboration if justified | Mature validator; sufficient catalogue/rules data | **XL** | Fourth |

For a three-engineer team, a realistic **planning envelope** for the first genuinely usable phase is roughly two to three months **if** the existing item editor already has stable scene rendering, transforms and parametric updates. That estimate can be badly wrong if existing geometry is not normalised, transforms are embedded in component-specific code, or parameter changes cannot be invoked externally. Treat it as a sizing assumption, not a commitment.

**Phase one — functional ensemble creation.** The key deliverable is not just drag-and-drop. It is a stable domain model. Start by adding `FurnitureInstance`, `Ensemble`, connector metadata and transactional commands. Implement top/orthographic 2D and existing perspective 3D against the same model. Then add guided snaps, collision checking, groups, save/load and BOM.

**Phase two — intelligent compatibility.** Expand connectors from “this point can attach there” into interfaces with rules and clearance envelopes. Introduce local propagation and repair diagnostics. Build generated parts next; countertops, plinths, fillers and end panels are excellent test cases because they force the system to model dependencies across multiple furniture instances. Coohom's current Kitchen & Bath design tooling shows this is commercially proven interaction territory. [^ref-76]

Auto-fit should arrive in this phase only after rules are trustworthy. Given a 3,150 mm wall run, for example, the system should search valid combinations from the actual catalogue, reserve minimum clearances/fillers, respect locked modules and rank solutions according to objective rules. That is far safer than allowing a generative model to invent cabinet widths.

**Phase three — manufacturing.** Separate consumer-facing order completeness from true production data. Detailed hardware, board-level BOMs, cut optimisation, labels and CNC output are valuable professional capabilities, as Cabinet Vision demonstrates, but they require much richer content than a room planner. [^ref-68]

Exploded views and step-by-step instructions also belong here because they require explicit knowledge about assembly relationships. A visual explosion generated from geometry alone is straightforward; a *correct assembly sequence* is not. Do not imply manufacturability until the underlying product data actually describes joints, hardware and ordering.

**Phase four — smart layout and AI.** Begin with deterministic alternative generation. AI can then translate fuzzy intent into solver inputs:

> “Create a 2.8-metre office wall with two desks, drawers at each side and overhead storage; keep it under €2,500.”

The language model should identify intent, categories, style and budget. A catalogue/constraint solver should choose concrete furniture, compute placement and validate the result. The AI should never be allowed to override a hard compatibility rule. Coohom's AI auto-layout demonstrates market interest in this direction, but the application's deterministic product rules remain the authoritative layer. [^ref-89]

## Competitive opportunities

**Unified cross-family composition is probably the most obvious opportunity.** IKEA's product-specific planners make individual systems approachable, but users can encounter planner silos. The request for a room that mixes PAX, MALM, ALEX, desks and beds is almost exactly the problem your proposed architecture can solve. Your catalogue model should therefore avoid encoding “Kitchen Mode”, “Wardrobe Mode” and “Desk Mode” as separate applications. Those should be presets or specialised workflows over one composition engine. [^ref-6]

**“Valid by construction” can be a stronger differentiator than rendering quality.** Many consumer planners compete aggressively on renders and AI imagery. Fewer make the promise that connected furniture remains structurally and operationally compatible. A system capable of saying “this module cannot go here because its drawer needs this clearance” solves a more expensive problem than another photorealistic render. The physical-conflict reports from IKEA planning and precision complaints around Planner 5D illustrate the gap. [^ref-90]

**Use operational clearance, not merely bounding-box collision.** This can become a signature capability. Each template may have multiple envelopes:

```text
solid body
door swing
drawer extension
chair/user clearance
installation clearance
service/maintenance zone
```

Users could switch the relevant overlays on/off and receive different severity levels. A drawer crossing another cabinet is a hard interference; a recommended walkway might merely be advisory.

**Make automation controllable.** Products often make one of two mistakes: little automation, requiring CAD-like manual effort, or aggressive automation that the user cannot override. The Planner 5D snapping complaints are a useful warning. Every automated behaviour should therefore have a visible cause and an escape hatch. [^ref-79]

A good principle is:

> **Automatic when obvious; preview when consequential; ask when ambiguous.**

**Generate the “boring” parts automatically.** Fillers, plinths, trims, end panels, worktops and hardware are easy for inexperienced users to forget but materially affect whether the finished furniture works. Coohom automates several of these today, while IKEA installation discussions repeatedly mention fillers, spacing and accessory completeness. [^ref-91]

**Preserve user intent through change.** Most configurators are good at creating a configuration from scratch but less elegant when users make a late structural change. Your differentiator can be that a user replaces or resizes one cabinet and the system preserves as much intent as possible:

```text
old module
   ↓ replace
compatible new module
   ↓
same logical position
same group
same neighbouring connections where valid
same ensemble finish
derived countertop regenerated
BOM updated
violations explicitly reported
```

This requires more engineering than a simple delete/add workflow, but it directly targets how people iterate designs.

**Treat constraints as explainable domain data rather than hidden code.** Ideally a rule should be inspectable:

```text
Rule: drawer-door-clearance
Applies to: base-cabinet-with-drawer
Requires: drawer swept volume does not intersect neighbour solid/door volume
Severity: error
Repair strategies:
  - increase side gap
  - insert compatible filler
  - change neighbour
  - reverse door hinge where supported
```

This opens the door to automated fixes, QA tooling, catalogue validation and much better support diagnostics.

**Bridge consumer planning and professional output gradually.** Roomle, pCon, Cyncly and Cabinet Vision show that the same product configuration can eventually feed pricing, quotations, BOMs and manufacturing. The opportunity is to preserve that path without exposing professional complexity in the everyday ensemble editor. [^ref-92]

**A cross-manufacturer/catalogue architecture may be strategically stronger than a single-brand planner.** pCon's model is particularly instructive: current manufacturer data and configurable articles can participate in the same planning environment. If your own furniture library eventually contains multiple ranges or suppliers, the composition layer should use interface capabilities rather than hard-coded brand/family checks. [^ref-93]

That means prefer:

```ts
accepts: ["cabinet-side-interface:v1"]
```

over:

```ts
if (product.family === "KitchenSeriesA") { ... }
```

Family-specific rules will still exist, but the underlying engine remains reusable.

**The most defensible AI strategy is constraint-grounded AI.** AI can make the product feel dramatically easier without becoming the source of geometric truth. Natural language, inspiration images and “show me three alternatives” are excellent AI surfaces. Snap positions, interface dimensions, physical clearances, generated hardware and manufacturing outputs should remain deterministic. This creates a useful division of labour:

```text
AI
 ├── understands intent
 ├── chooses candidate styles/categories
 ├── proposes candidate arrangements
 └── explains alternatives

Deterministic engine
 ├── resolves exact products
 ├── connects interfaces
 ├── calculates geometry
 ├── checks compatibility
 ├── checks collisions/clearances
 ├── generates shared parts
 └── produces BOM/manufacturing data
```

That architecture is also safer as models change: the core furniture-validity model does not depend on model prompts or probabilistic behaviour.

## Sources and research notes

Sources were prioritised as follows: **official technical/product documentation → current official feature/pricing pages → identifiable community feedback → vendor case/demo material**. Public forum posts are useful for discovering pain points but should not be interpreted as representative survey results.

**IKEA — high-quality primary sources**

[IKEA UK Kitchen Planner](https://www.ikea.com/gb/en/planners/kitchen-planner/) — current page retrieved 23 October 2026; official product capability. [^ref-94]

[IKEA US Design and Planning Tools](https://www.ikea.com/us/en/planners/) — current official overview of product-specific planners. [^ref-95]

[IKEA BESTÅ Planner](https://www.ikea.com/gb/en/planners/besta-planner/) — current official 3D planner. [^ref-96]

[IKEA Netherlands Planners](https://www.ikea.com/nl/en/planners/) — official page describing sizes, colours, combinations, saved/personal codes and modular sofa/planning tools. [^ref-97]

[IKEA Romania Planning Tools](https://www.ikea.com/ro/ro/planners/) — official current list including PAX, BESTÅ, PLATSA and other systems. [^ref-98]

**Roomle — very high-quality technical primary sources**

[Roomle Basic Docking Topics](https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics) — current technical documentation; parent/child docking, connection positions and distinct component parameters. [^ref-64]

[Roomle Parameters](https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_30_parameters) — updated July 2026; parameter behaviour. [^ref-99]

[Roomle Global Parameters](https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_90_globalparameters) — current technical documentation; shared/global parameter semantics. [^ref-75]

[Roomle Dimensioning](https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_120_dimensioning) — current technical documentation. [^ref-100]

[Roomle Four-Post Shelving Example](https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/400_30_quadpost) — useful implementation example for modular dependencies. [^ref-101]

[Roomle Floorplanner](https://www.roomle.com/floorplanner) — current consumer 2D/3D floorplanning capability. [^ref-102]

[Roomle Rubens Pricing](https://www.roomle.com/en/pricing) — current commercial pricing and product scope retrieved 23 October 2026. [^ref-103]

**Coohom — high-quality primary product documentation**

[Coohom Kitchen & Closet Design Basics](https://www.coohom.com/helpcenter/kitchen-closet-kitchen-design-basics) — updated June 2026; cabinet combinations and generated countertops/crown moulding. [^ref-104]

[Coohom Kitchen & Bath Design Basics](https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics) — updated 8 October 2026; size/material/style modification and one-click generation of countertops, moulding, toe-kicks and other components. [^ref-57]

[Coohom Generate Toe-kick Moulding](https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding) — current workflow documentation. [^ref-105]

[Coohom AI Kitchen Auto-layout](https://www.coohom.com/helpcenter/enterprise-ai-kitchen-automatic-layout-custom-product-template-configuration-instructions) — current enterprise AI-layout documentation. [^ref-89]

**General room-planning competitors — primary sources**

[Planner 5D Free Floor Plan Creator](https://planner5d.com/use/free-floor-plan-creator) — current drag/drop, dimensions, 2D/3D and AI features. [^ref-106]

[HomeByMe](https://home.by.me/en/) — current 2D floorplan and 3D furnishing workflow. [^ref-107]

[HomeByMe Features](https://home.by.me/en/features/) — current generic-furniture resizing, materials, MakeByMe and model upload capabilities. [^ref-108]

[Homestyler Custom Furniture](https://www.homestyler.com/solution/design_custom-furniture) — current parametric furniture, quotation and production-oriented features. [^ref-109]

[Homestyler Pricing](https://www.homestyler.com/pricing) — current plans and parametric cabinet feature description. [^ref-26]

**Professional and specialist configurators — primary sources**

[pCon.planner](https://pcon-solutions.com/planner/) — current configurable product, manufacturer-data and item-list workflow. [^ref-110]

[pCon Download Area](https://pcon-solutions.com/download-area/) — current Marketing Edition licensing information. [^ref-34]

[Cyncly Design Flex](https://www.cyncly.com/products/design-flex) — current professional kitchen/bath platform. [^ref-111]

[Cyncly Design Flex Pricing](https://www.cyncly.com/products/design-flex/pricing) — current 2026 pricing. [^ref-36]

[Cyncly: 2020 Design to Design Flex](https://www.cyncly.com/resources/blog/from-2020-design-to-design-flex) — 16 February 2026; current naming/product evolution. [^ref-112]

[Hexagon Wood, Stone and Composites Suite](https://hexagon.com/products/product-groups/wood-stone-and-composites-suite) — current BOM, labels and optimised cut-list functionality relevant to Cabinet Vision/manufacturing. [^ref-68]

[PARAMETRA Modular Furniture Configurator](https://www.parametra.it/en/projects/modular-furniture-3d-configurator-demo) — specialist rule-driven modular-furniture precedent; **medium evidence quality because it is vendor/demo material**. [^ref-37]

**Technical architecture — high-quality primary documentation**

[React Three Fiber](https://r3f.docs.pmnd.rs/) — official/current documentation; React renderer for Three.js. [^ref-113]

[Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html) — official/current picking documentation. [^ref-114]

[Three.js TransformControls](https://threejs.org/docs/pages/TransformControls.html) — official/current manipulation control API. [^ref-85]

[Rapier JavaScript Advanced Collision Detection](https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/) — official broad/narrow-phase collision documentation. [^ref-115]

[Rapier Colliders](https://rapier.rs/docs/user_guides/javascript/colliders) — official collider/sensor documentation. [^ref-116]

[Yjs Documentation](https://docs.yjs.dev/) — official CRDT/shared-state documentation; relevant only if collaborative editing becomes a requirement. [^ref-117]

**User evidence — useful qualitative evidence, not representative surveys**

[Reddit: IKEA App Users — planner feedback](https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/) — explicit request for richer mobile planning and one unified environment mixing PAX, MALM, ALEX, desks and beds. **Evidence quality: medium for discovering a need; low for prevalence.** [^ref-118]

[Reddit: Planner 5D first-use feedback](https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/) — snapping, precision, grouping, selection and tooltip complaints. **Evidence quality: medium because several concrete interaction problems are independently testable; not statistically representative.** [^ref-62]

[Reddit: Planner 5D snapping request](https://www.reddit.com/r/planner5d/comments/1pt7sw5/how_to_disable_snapping_on_walls/) — recent corroboration of the need for a snap override. **Evidence quality: low/medium.** [^ref-119]

[Reddit: IKEA kitchen planning resulted in an impossible overlap](https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/) — illustrates physical-validation failure. **Evidence quality: low for prevalence, high relevance for failure-mode discovery.** [^ref-120]

[Reddit: IKEA kitchen tips and recommendations](https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/) — highlights professional adjustment and the practical value of fillers/end boards/spacers. **Evidence quality: medium/low.** [^ref-121]

### Research conclusion

The evidence does **not** justify building “another IKEA kitchen planner” literally. The stronger product strategy is to extract what works from several categories:

**IKEA's guided catalogue experience + SketchUp's precise/controllable manipulation + Roomle's semantic docking/parameter model + Coohom's derived ensemble components + professional systems' BOM/manufacturing continuity.** [^ref-122]

The resulting core should be an **ensemble constraint engine sitting above your existing parametric furniture templates**. Its first job is not to make a beautiful picture; its first job is to make combining existing products *fast, predictable, reversible and valid*. Once that foundation exists, auto-fill, manufacturing output and AI become extensions of the same model rather than separate systems.

---

## Citation reference links

[^ref-1]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 3](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 4](<https://www.cyncly.com/products/design-flex>); [source 5](<https://www.ikea.com/us/en/planners/>). Original citation IDs: `turn13search4`, `turn13search9`, `turn13search14`, `turn14search6`, `turn14search8`.

[^ref-2]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/150_40_lvl2_component>); [source 2](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>). Original citation IDs: `turn13search9`, `turn13search37`.

[^ref-3]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://help.sketchup.com/en/sketchup/snaps>); [source 3](<https://www.reddit.com/r/planner5d/comments/1pt7sw5/how_to_disable_snapping_on_walls/>); [source 4](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn0search2`, `turn13search9`, `turn17search0`, `turn17search2`.

[^ref-4]: [source 1](<https://www.reddit.com/r/IKEA/comments/13yis0p/pax_help/>); [source 2](<https://www.reddit.com/r/IKEA/comments/1cb3ij1/need_4_hinge_locations_93_18_tall_pax_units/>); [source 3](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>). Original citation IDs: `turn3search17`, `turn3search29`, `turn16search2`.

[^ref-5]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/400_30_quadpost>); [source 2](<https://www.coohom.com/helpcenter/desain-dapur-membuat-lis-plafon>); [source 3](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 4](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>); [source 5](<https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/>); [source 6](<https://www.reddit.com/r/IKEA/comments/lv9yk4/ikea_kitchen_tell_me_what_you_learned/>). Original citation IDs: `turn13search14`, `turn13search10`, `turn13search18`, `turn13search17`, `turn16search4`, `turn16search5`.

[^ref-6]: [source 1](<https://www.ikea.com/ro/ro/planners/>); [source 2](<https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/>). Original citation IDs: `turn16search0`, `turn13search12`.

[^ref-7]: [source 1](<https://planner5d.com/use/free-floor-plan-creator>); [source 2](<https://www.coohom.com/helpcenter/enterprise-ai-kitchen-automatic-layout-custom-product-template-configuration-instructions>). Original citation IDs: `turn13search11`, `turn13search26`.

[^ref-8]: [source 1](<https://kitchen.planner.ikea.com/au/en/>); [source 2](<https://www.ikea.com/gb/en/planners/kitchen-planner/>). Original citation IDs: `turn13search0`, `turn13search24`.

[^ref-9]: [source 1](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>); [source 2](<https://www.reddit.com/r/IKEA/comments/lv9yk4/ikea_kitchen_tell_me_what_you_learned/>); [source 3](<https://www.reddit.com/r/IKEA/comments/umn1tr/maybe_a_dumb_question_but_do_the_hinges_for_the/>). Original citation IDs: `turn16search1`, `turn16search2`, `turn16search5`.

[^ref-10]: [source 1](<https://www.ikea.com/nl/en/planners/>); [source 2](<https://www.ikea.com/ro/ro/planners/>). Original citation IDs: `turn13search12`, `turn13search28`.

[^ref-11]: [source 1](<https://www.reddit.com/r/IKEA/comments/13yis0p/pax_help/>); [source 2](<https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/>); [source 3](<https://www.reddit.com/r/IKEA/comments/1cb3ij1/need_4_hinge_locations_93_18_tall_pax_units/>). Original citation IDs: `turn16search0`, `turn3search17`, `turn3search29`.

[^ref-12]: [source 1](<https://www.ikea.com/gb/en/planners/besta-planner/>); [source 2](<https://www.ikea.com/nl/en/planners/>). Original citation IDs: `turn13search36`, `turn13search28`.

[^ref-13]: [source 1](<https://help.sketchup.com/en/sketchup/grouping-geometry>); [source 2](<https://help.sketchup.com/en/sketchup/moving-entities-around>); [source 3](<https://help.sketchup.com/en/sketchup/snaps>). Original citation IDs: `turn0search2`, `turn0search9`, `turn0search31`.

[^ref-14]: [source 1](<https://www.reddit.com/r/BeginnerWoodWorking/comments/1oj33hv/best_3d_apps_for_woodworking_planning_frames/>); [source 2](<https://www.reddit.com/r/DIY/comments/1hpd2yi/wife_tricked_me_into_complete_closet_remodel/>); [source 3](<https://www.reddit.com/r/malelivingspace/comments/11ymmjp/homestylr_vs_sketchup_vs_homebyme_vs_floorplanner/>). Original citation IDs: `turn4search8`, `turn4search25`, `turn4search6`.

[^ref-15]: [source 1](<https://help.sketchup.com/en/admin/sketchup-free>); [source 2](<https://www.sketchup.com/products/sketchup-free>). Original citation IDs: `turn9search6`, `turn9search19`.

[^ref-16]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_120_dimensioning>); [source 2](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_130_pricing>); [source 3](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_30_parameters>); [source 4](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 5](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_90_globalparameters>). Original citation IDs: `turn13search9`, `turn13search1`, `turn13search5`, `turn13search13`, `turn13search29`.

[^ref-17]: [source 1](<https://www.roomle.com/en/pricing>); [source 2](<https://www.roomle.com/en/roomle-login>). Original citation IDs: `turn15search3`, `turn15search18`.

[^ref-18]: [source 1](<https://planner5d.com/use/floor-plan-software>); [source 2](<https://planner5d.com/use/free-floor-plan-creator>). Original citation IDs: `turn13search11`, `turn13search23`.

[^ref-19]: [source 1](<https://www.reddit.com/r/planner5d/>); [source 2](<https://www.reddit.com/r/planner5d/comments/1pt7sw5/how_to_disable_snapping_on_walls/>); [source 3](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn17search0`, `turn17search1`, `turn17search2`.

[^ref-20]: [source 1](<https://planner5d.com/pricing>); [source 2](<https://planner5d.com/use/ai-interior-design>). Original citation IDs: `turn1search0`, `turn1search8`.

[^ref-21]: [source 1](<https://home.by.me/en/>); [source 2](<https://home.by.me/en/features/>). Original citation IDs: `turn15search4`, `turn15search10`.

[^ref-22]: [source 1](<https://www.reddit.com/r/Homebuilding/comments/11l5wa0/best_company_to_turn_my_plans_into_3d_not_looking/>); [source 2](<https://www.reddit.com/r/InteriorDesign/comments/xg4r69/ive_just_started_using_homebyme_and_really_like/>); [source 3](<https://www.reddit.com/r/malelivingspace/comments/11ymmjp/homestylr_vs_sketchup_vs_homebyme_vs_floorplanner/>). Original citation IDs: `turn4search14`, `turn4search9`, `turn4search6`.

[^ref-23]: [source 1](<https://home.by.me/en/offers/>). Original citation IDs: `turn15search7`.

[^ref-24]: [source 1](<https://www.homestyler.com/about/updates>); [source 2](<https://www.homestyler.com/pricing>); [source 3](<https://www.homestyler.com/solution/design_custom-furniture>). Original citation IDs: `turn15search2`, `turn15search11`, `turn15search23`.

[^ref-25]: [source 1](<https://www.homestyler.com/forum/view/1813217202118107138>); [source 2](<https://www.reddit.com/r/InteriorDesign/comments/112dnvi/homestyler_vs_homebyme/>). Original citation IDs: `turn4search1`, `turn15search14`.

[^ref-26]: [source 1](<https://www.homestyler.com/pricing>). Original citation IDs: `turn15search11`.

[^ref-27]: [source 1](<https://www.sweethome3d.com/free-3d-models/>); [source 2](<https://www.sweethome3d.com/users-guide/>). Original citation IDs: `turn1search7`, `turn9search21`.

[^ref-28]: [source 1](<https://www.sweethome3d.com/>); [source 2](<https://www.sweethome3d.com/faq/>). Original citation IDs: `turn9search1`, `turn9search30`.

[^ref-29]: [source 1](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 2](<https://www.coohom.com/helpcenter/kitchen-closet-kitchen-design-basics>); [source 3](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>). Original citation IDs: `turn13search2`, `turn13search14`, `turn13search18`.

[^ref-30]: [source 1](<https://www.reddit.com/r/InteriorDesign/comments/17m09ik/is_coohom_a_fraud/>). Original citation IDs: `turn4search10`.

[^ref-31]: [source 1](<https://www.coohom.com/helpcenter/pricing%2C-subscriptions%2C-and-payments>). Original citation IDs: `turn5search4`.

[^ref-32]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 2](<https://nexus.hexagon.com/documentationcenter/en-US/bundle/CABINET_VISION_2025_HELP/page/Room_Level/Ribbonbar/Utilities_Tab/Output_Data_File/RL.Output.Data.File.xhtml>). Original citation IDs: `turn14search6`, `turn14search0`.

[^ref-33]: [source 1](<https://en.blog.pcon-solutions.com/2026/05/11/smarter-planning-workflows-with-pcon-planner-8-14/>); [source 2](<https://pcon-solutions.com/faq-pcon-planner/>); [source 3](<https://pcon-solutions.com/planner/>). Original citation IDs: `turn14search1`, `turn14search23`, `turn14search15`.

[^ref-34]: [source 1](<https://pcon-solutions.com/download-area/>). Original citation IDs: `turn14search7`.

[^ref-35]: [source 1](<https://www.cyncly.com/products/design-flex>); [source 2](<https://www.cyncly.com/products/design-flex/catalogs>); [source 3](<https://www.cyncly.com/resources/blog/from-2020-design-to-design-flex>). Original citation IDs: `turn14search5`, `turn14search8`, `turn14search11`.

[^ref-36]: [source 1](<https://www.cyncly.com/products/design-flex/pricing>). Original citation IDs: `turn14search2`.

[^ref-37]: [source 1](<https://www.parametra.it/en/projects/modular-furniture-3d-configurator-demo>). Original citation IDs: `turn2search3`.

[^ref-38]: [source 1](<https://www.vividworks.com/industries/3d-furniture-configurator>). Original citation IDs: `turn2search9`.

[^ref-39]: [source 1](<https://salsita.ai/industry/home-and-office-furniture>). Original citation IDs: `turn2search18`.

[^ref-40]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://help.sketchup.com/en/sketchup/snaps>); [source 3](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 4](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 5](<https://www.cyncly.com/products/design-flex>). Original citation IDs: `turn13search9`, `turn13search14`, `turn0search2`, `turn14search6`, `turn14search8`.

[^ref-41]: [source 1](<https://home.by.me/en/>); [source 2](<https://planner5d.com/use/free-floor-plan-creator>); [source 3](<https://www.roomle.com/en/documentation/overview-room-designer>). Original citation IDs: `turn15search6`, `turn15search4`, `turn13search11`.

[^ref-42]: [source 1](<https://home.by.me/en/>); [source 2](<https://planner5d.com/use/free-floor-plan-creator>); [source 3](<https://www.ikea.com/us/en/planners/>); [source 4](<https://www.roomle.com/floorplanner>). Original citation IDs: `turn13search4`, `turn15search0`, `turn13search11`, `turn15search4`.

[^ref-43]: [source 1](<https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/>); [source 2](<https://www.reddit.com/r/BeginnerWoodWorking/comments/1oj33hv/best_3d_apps_for_woodworking_planning_frames/>); [source 3](<https://www.reddit.com/r/InteriorDesign/comments/xg4r69/ive_just_started_using_homebyme_and_really_like/>). Original citation IDs: `turn4search8`, `turn4search14`, `turn16search4`.

[^ref-44]: [source 1](<https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/>); [source 2](<https://www.reddit.com/r/planner5d/>); [source 3](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn17search0`, `turn17search1`, `turn16search0`.

[^ref-45]: [source 1](<https://www.reddit.com/r/IKEA/comments/13yis0p/pax_help/>); [source 2](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>); [source 3](<https://www.reddit.com/r/IKEA/comments/lv9yk4/ikea_kitchen_tell_me_what_you_learned/>); [source 4](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn16search2`, `turn16search5`, `turn3search17`, `turn17search0`.

[^ref-46]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://help.sketchup.com/en/sketchup/snaps>). Original citation IDs: `turn13search9`, `turn0search2`.

[^ref-47]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>). Original citation IDs: `turn13search9`, `turn16search2`.

[^ref-48]: [source 1](<https://www.reddit.com/r/IKEA/comments/13yis0p/pax_help/>); [source 2](<https://www.reddit.com/r/IKEA/comments/lv9yk4/ikea_kitchen_tell_me_what_you_learned/>). Original citation IDs: `turn3search17`, `turn16search5`.

[^ref-49]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_120_dimensioning>); [source 2](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn13search13`, `turn17search0`.

[^ref-50]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_30_parameters>); [source 2](<https://www.homestyler.com/pricing>). Original citation IDs: `turn13search1`, `turn15search11`.

[^ref-51]: [source 1](<https://home.by.me/en/>); [source 2](<https://www.roomle.com/en/documentation/overview-room-designer>). Original citation IDs: `turn15search6`, `turn15search4`.

[^ref-52]: [source 1](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>); [source 2](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn16search2`, `turn17search0`.

[^ref-53]: [source 1](<https://help.sketchup.com/en/sketchup/grouping-geometry>); [source 2](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn17search0`, `turn0search9`.

[^ref-54]: [source 1](<https://docs.roomle.com/rubens/changelogs/changelog>). Original citation IDs: `turn12search2`.

[^ref-55]: [source 1](<https://www.reddit.com/r/planner5d/>). Original citation IDs: `turn17search1`.

[^ref-56]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_90_globalparameters>); [source 2](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/400_30_quadpost>). Original citation IDs: `turn13search5`, `turn13search17`.

[^ref-57]: [source 1](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>). Original citation IDs: `turn13search14`.

[^ref-58]: [source 1](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>); [source 2](<https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/>). Original citation IDs: `turn13search18`, `turn16search4`.

[^ref-59]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 2](<https://www.roomle.com/en>). Original citation IDs: `turn15search12`, `turn14search6`.

[^ref-60]: [source 1](<https://planner5d.com/use/free-floor-plan-creator>); [source 2](<https://www.roomle.com/en/documentation/overview-room-designer>). Original citation IDs: `turn15search6`, `turn13search11`.

[^ref-61]: [source 1](<https://help.sketchup.com/en/sketchup/moving-entities-around>). Original citation IDs: `turn0search31`.

[^ref-62]: [source 1](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn17search0`.

[^ref-63]: [source 1](<https://pcon-solutions.com/faq-pcon-planner/>); [source 2](<https://www.ikea.com/nl/en/planners/>). Original citation IDs: `turn14search23`, `turn13search28`.

[^ref-64]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>). Original citation IDs: `turn13search9`.

[^ref-65]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/400_30_quadpost>); [source 2](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>). Original citation IDs: `turn13search14`, `turn13search17`.

[^ref-66]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_130_pricing>); [source 2](<https://www.cyncly.com/products/design-flex>). Original citation IDs: `turn13search29`, `turn14search8`.

[^ref-67]: [source 1](<https://www.reddit.com/r/IKEA/comments/umn1tr/maybe_a_dumb_question_but_do_the_hinges_for_the/>). Original citation IDs: `turn16search1`.

[^ref-68]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>). Original citation IDs: `turn14search6`.

[^ref-69]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 2](<https://www.parametra.it/en/projects/modular-furniture-3d-configurator-demo>). Original citation IDs: `turn14search6`, `turn2search3`.

[^ref-70]: [source 1](<https://planner5d.com/use/free-floor-plan-creator>); [source 2](<https://www.coohom.com/helpcenter/enterprise-ai-kitchen-automatic-layout-custom-product-template-configuration-instructions>). Original citation IDs: `turn13search26`, `turn13search11`.

[^ref-71]: [source 1](<https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/>); [source 2](<https://www.roomle.com/en/for-your-home>). Original citation IDs: `turn16search0`, `turn15search15`.

[^ref-72]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 2](<https://pcon-solutions.com/planner/>); [source 3](<https://www.roomle.com/en>). Original citation IDs: `turn15search12`, `turn14search1`, `turn14search6`.

[^ref-73]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://help.sketchup.com/en/sketchup/grouping-geometry>); [source 3](<https://pcon-solutions.com/faq-pcon-planner/>). Original citation IDs: `turn0search9`, `turn13search9`, `turn14search23`.

[^ref-74]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_30_parameters>); [source 2](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_90_globalparameters>). Original citation IDs: `turn13search1`, `turn13search5`.

[^ref-75]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_90_globalparameters>). Original citation IDs: `turn13search5`.

[^ref-76]: [source 1](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 2](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>). Original citation IDs: `turn13search14`, `turn13search18`.

[^ref-77]: [source 1](<https://www.ikea.com/lt/en/planners/>); [source 2](<https://www.roomle.com/en/documentation/overview-room-designer>). Original citation IDs: `turn15search6`, `turn13search8`.

[^ref-78]: [source 1](<https://pcon-solutions.com/planner/>); [source 2](<https://www.roomle.com/en>). Original citation IDs: `turn15search12`, `turn14search1`.

[^ref-79]: [source 1](<https://www.reddit.com/r/planner5d/comments/1pt7sw5/how_to_disable_snapping_on_walls/>); [source 2](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn17search0`, `turn17search2`.

[^ref-80]: [source 1](<https://r3f.docs.pmnd.rs/>); [source 2](<https://threejs.org/docs/pages/Raycaster.html>); [source 3](<https://threejs.org/docs/pages/TransformControls.html>). Original citation IDs: `turn18search0`, `turn18search17`, `turn18search5`.

[^ref-81]: [source 1](<https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/>); [source 2](<https://rapier.rs/docs/user_guides/javascript/colliders>); [source 3](<https://rapier.rs/docs/user_guides/javascript/simulation_structures/>). Original citation IDs: `turn18search2`, `turn18search6`, `turn18search26`.

[^ref-82]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_100_meshes>); [source 2](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>). Original citation IDs: `turn13search9`, `turn12search10`.

[^ref-83]: [source 1](<https://r3f.docs.pmnd.rs/>); [source 2](<https://r3f.docs.pmnd.rs/tutorials/how-it-works>). Original citation IDs: `turn18search0`, `turn18search12`.

[^ref-84]: [source 1](<https://r3f.docs.pmnd.rs/api/events>); [source 2](<https://threejs.org/docs/pages/Raycaster.html>). Original citation IDs: `turn18search17`, `turn18search32`.

[^ref-85]: [source 1](<https://threejs.org/docs/pages/TransformControls.html>). Original citation IDs: `turn18search5`.

[^ref-86]: [source 1](<https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/>); [source 2](<https://rapier.rs/docs/user_guides/javascript/colliders>). Original citation IDs: `turn18search2`, `turn18search6`.

[^ref-87]: [source 1](<https://docs.yjs.dev/>); [source 2](<https://docs.yjs.dev/getting-started/working-with-shared-types>). Original citation IDs: `turn18search3`, `turn18search11`.

[^ref-88]: [source 1](<https://r3f.docs.pmnd.rs/advanced/scaling-performance>). Original citation IDs: `turn18search28`.

[^ref-89]: [source 1](<https://www.coohom.com/helpcenter/enterprise-ai-kitchen-automatic-layout-custom-product-template-configuration-instructions>). Original citation IDs: `turn13search26`.

[^ref-90]: [source 1](<https://www.reddit.com/r/IKEA/comments/13yis0p/pax_help/>); [source 2](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>); [source 3](<https://www.reddit.com/r/planner5d/comments/x4pgkr/tried_the_software_today_got_tired_of_it_after_1/>). Original citation IDs: `turn16search2`, `turn3search17`, `turn17search0`.

[^ref-91]: [source 1](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 2](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>); [source 3](<https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/>); [source 4](<https://www.reddit.com/r/IKEA/comments/umn1tr/maybe_a_dumb_question_but_do_the_hinges_for_the/>). Original citation IDs: `turn13search14`, `turn13search18`, `turn16search4`, `turn16search1`.

[^ref-92]: [source 1](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 2](<https://pcon-solutions.com/planner/>); [source 3](<https://www.cyncly.com/products/design-flex>); [source 4](<https://www.roomle.com/en>). Original citation IDs: `turn15search12`, `turn14search1`, `turn14search8`, `turn14search6`.

[^ref-93]: [source 1](<https://en.blog.pcon-solutions.com/2026/05/11/smarter-planning-workflows-with-pcon-planner-8-14/>); [source 2](<https://pcon-solutions.com/planner/>). Original citation IDs: `turn14search1`, `turn14search15`.

[^ref-94]: [source 1](<https://www.ikea.com/gb/en/planners/kitchen-planner/>). Original citation IDs: `turn13search0`.

[^ref-95]: [source 1](<https://www.ikea.com/us/en/planners/>). Original citation IDs: `turn13search4`.

[^ref-96]: [source 1](<https://www.ikea.com/gb/en/planners/besta-planner/>). Original citation IDs: `turn13search36`.

[^ref-97]: [source 1](<https://www.ikea.com/nl/en/planners/>). Original citation IDs: `turn13search28`.

[^ref-98]: [source 1](<https://www.ikea.com/ro/ro/planners/>). Original citation IDs: `turn13search12`.

[^ref-99]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_30_parameters>). Original citation IDs: `turn13search1`.

[^ref-100]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_120_dimensioning>). Original citation IDs: `turn13search13`.

[^ref-101]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/400_30_quadpost>). Original citation IDs: `turn13search17`.

[^ref-102]: [source 1](<https://www.roomle.com/floorplanner>). Original citation IDs: `turn15search0`.

[^ref-103]: [source 1](<https://www.roomle.com/en/pricing>). Original citation IDs: `turn15search18`.

[^ref-104]: [source 1](<https://www.coohom.com/helpcenter/kitchen-closet-kitchen-design-basics>). Original citation IDs: `turn13search2`.

[^ref-105]: [source 1](<https://www.coohom.com/helpcenter/kitchen-design-generate-toekick-molding>). Original citation IDs: `turn13search18`.

[^ref-106]: [source 1](<https://planner5d.com/use/free-floor-plan-creator>). Original citation IDs: `turn13search11`.

[^ref-107]: [source 1](<https://home.by.me/en/>). Original citation IDs: `turn15search4`.

[^ref-108]: [source 1](<https://home.by.me/en/features/>). Original citation IDs: `turn15search10`.

[^ref-109]: [source 1](<https://www.homestyler.com/solution/design_custom-furniture>). Original citation IDs: `turn15search2`.

[^ref-110]: [source 1](<https://pcon-solutions.com/planner/>). Original citation IDs: `turn14search1`.

[^ref-111]: [source 1](<https://www.cyncly.com/products/design-flex>). Original citation IDs: `turn14search8`.

[^ref-112]: [source 1](<https://www.cyncly.com/resources/blog/from-2020-design-to-design-flex>). Original citation IDs: `turn14search5`.

[^ref-113]: [source 1](<https://r3f.docs.pmnd.rs/>). Original citation IDs: `turn18search0`.

[^ref-114]: [source 1](<https://threejs.org/docs/pages/Raycaster.html>). Original citation IDs: `turn18search17`.

[^ref-115]: [source 1](<https://rapier.rs/docs/user_guides/javascript/advanced_collision_detection_js/>). Original citation IDs: `turn18search2`.

[^ref-116]: [source 1](<https://rapier.rs/docs/user_guides/javascript/colliders>). Original citation IDs: `turn18search6`.

[^ref-117]: [source 1](<https://docs.yjs.dev/>). Original citation IDs: `turn18search3`.

[^ref-118]: [source 1](<https://www.reddit.com/r/IKEA/comments/172umml/ikea_app_users_share_your_thoughts/>). Original citation IDs: `turn16search0`.

[^ref-119]: [source 1](<https://www.reddit.com/r/planner5d/comments/1pt7sw5/how_to_disable_snapping_on_walls/>). Original citation IDs: `turn17search2`.

[^ref-120]: [source 1](<https://www.reddit.com/r/IKEA/comments/1lvpfeo/ikea_charged_me_200_for_a_kitchen_designit_was/>). Original citation IDs: `turn16search2`.

[^ref-121]: [source 1](<https://www.reddit.com/r/AusRenovation/comments/ythnrf/ikea_kitchen_tips_regrets_and_reccomdations/>). Original citation IDs: `turn16search4`.

[^ref-122]: [source 1](<https://docs.roomle.com/rubens/content-creation/scripting-course-and-resources/200_80_dockingbasics>); [source 2](<https://help.sketchup.com/en/sketchup/snaps>); [source 3](<https://hexagon.com/products/product-groups/wood-stone-and-composites-suite>); [source 4](<https://www.coohom.com/helpcenter/kitchen-%EF%BC%86-bath-design-basics>); [source 5](<https://www.ikea.com/us/en/planners/>). Original citation IDs: `turn13search4`, `turn0search2`, `turn13search9`, `turn13search14`, `turn14search6`.
