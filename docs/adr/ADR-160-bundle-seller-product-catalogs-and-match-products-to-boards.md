# ADR-160: Bundle seller product catalogs and match products to boards, edge bands and hardware

- Status: Pending
- Date: 2026-10-30
- Decided by: user, 2026-10-30 (answers below)
- Depends on: ADR-049, ADR-062, ADR-077
- Design: docs/ui-design.md (Materials, Output › Shopping list)
- Backlog: N162

## Context

The user, 2026-10-30, with a Regency Company export (7 495 products, 109 categories, prices in RON with VAT): "Import
these as products for materials, keep it regency agnostic, more sellers will follow. Match products to parts in app".

This changes two settled sentences. [ADR-049](../adr-done/ADR-049-materials-carry-optional-manufacturer-and-type-labels-the-us.md):
"**Built-in supplier decors:** never. Decors come only from the user's list." — the user now supplies the seller data
and chose to bundle it. [ADR-062](../adr-done/ADR-062-cost-estimate-from-the-user-s-own-price-list-no-supplier-serv.md):
prices "can only come from the user" — the seller's own published prices now count too, below the user's.
[ADR-063](ADR-063-supplier-price-feeds-live-stock-and-online-ordering.md) (live feeds, ordering) stays Deferred: this
is an offline snapshot, not a feed.

## Decision

- **Seller-agnostic catalog.** `SellerCatalog` (`src/core/sellers/types.ts`): seller id, name, origin, currency,
  extraction date and products (id, name, code, maker, seller category, kind, price in minor units, price unit
  piece/m/m²/pack/set, stock, thickness, width, length, nominal length, specs text, page and picture paths). Kinds:
  board, worktop, edge-band, hinge, runner, push-latch, flap-stay, shelf-pin, wall-bracket, handle, leg, other.
  One converter per seller (`tools/sellers/regency.mjs`) writes `src/core/sellers/<seller>.json`; only values the
  export states are kept (ADR-010). All 7 495 products are bundled, as a lazy chunk loaded when a picker opens.
- **Suggest, the user picks.** Nothing changes without a tap.
  - Board (Materials → **Product from a seller**): boards and worktops, same thickness first. Picking sets name,
    thickness, sheet size, manufacturer and type labels and `product`; then the seller's picture is downloaded once
    (`src/online/sellerPictureFile.ts`, CSP `connect-src`) and saved as the board's picture (ADR-048), colour = its
    average, so the 3D view shows the decor. If the seller's site blocks it (CORS) or the app is offline, the board
    keeps its look and says so. Grain stays.
  - Edge band (Materials → _Edge band_ → **Band from a seller**): bands at least as wide as the board, same decor
    code first. Picking sets type, thickness, width, code and `product`; the allowance stays.
  - Hardware (Shopping list → **Product** on each hardware line, also lines still to choose): products of the
    matching kind first (runners of the same nominal length first), all products searchable. Saved in the design as
    `hardwareProducts[line key] = { product, per }`, **per = seller units per scheduled item, default 1**, editable.
    In a project view the choice is written to every piece with that line.
  - Any other product: Shopping list → **Add seller product** adds it to the piece shown, with a quantity.
- **Design shape.** `ProductRef { seller, id, name }` on `Material.product`, `EdgeBand.product`;
  `Design.hardwareProducts`, `Design.sellerItems`. `schemaVersion` 5; versions 1–4 still load.
- **Prices.** The user's own price (ADR-062) wins; otherwise a linked product's price is used when its unit fits the
  line (sheet board: per piece = per sheet; m² ; band per m; hardware per piece × per). Pack and set prices, and a
  product no longer in the catalog, stay _price missing_. Lines priced by a seller say so; the estimate names the
  seller and the export date.
- **Pictures, on by default** (user, 2026-10-30, an exception to ADR-126's "no request until the user opts in"). Every
  product list shows the seller's picture; **Show seller pictures (online)** switches them off, remembered on this
  device. Pictures load only from the seller origins in `src/online/sellerOrigins.ts` (also in the CSP `img-src`),
  through a lazily imported `src/online` component; offline they are simply missing. A **seller page** link opens
  only on a tap.

## Alternatives considered

- **Import a seller file in the app** — not chosen by the user; every user would need the file.
- **Auto-pick the best match** — rejected: silent wrong picks.
- **Bundle thumbnails** — about 100–200 MB offline download (estimate).

## Scope

- In scope: the catalog shape, the Regency converter and data, the pickers, links, seller prices, opt-in pictures.
- Out of scope: data refresh (G-309), project-level extra items (G-310), fasteners and run parts (G-311), live
  feeds and ordering (ADR-063).

## Consequences

- The app download grows by about 0.7 MB compressed (2.7 MB raw), loaded only when a picker opens.
- Prices age; the date is shown with every seller price.

## Done when

- [x] The converter keeps all 7 495 products with kind, unit, price and only stated sizes (`tests/sellers.test.ts`)
- [x] Board, band and hardware ranking and patches set only seller values; grain, colour, allowance stay (unit tests)
- [x] Product links validate, round-trip, schemaVersion 5; versions 1–4 load (unit tests)
- [x] Estimate: own price wins, seller price by unit, `per` multiplies, pack/set/unknown stay missing (unit tests)
- [x] No request outside `src/online`; CSP `img-src` lists only the seller origins added (network and security tests)
- [x] find-it (jsdom, 390 and 1280 px): **Product from a seller**, **Band from a seller**, **Product**, **Add seller
      product** found and a pick shows in the board, band and the estimate (`tests/find-it/sellers.test.tsx`)
- [x] All CI checks pass

## Implementation notes

`src/core/sellers/` (`types.ts` catalog shape, `index.ts` loader, matching, patches and price lookup, `choices.ts`
design updates, `regency.json` generated by `tools/sellers/regency.mjs`), `src/core/prices.ts` (`sellerLinePrice`,
`priceSource`), `src/core/shopping.ts` (product links on lines, added items), `src/ui/ProductPicker.tsx`,
`src/ui/SellerLinks.tsx`, `src/ui/Shopping.tsx`, `src/online/SellerPicture.tsx`, `src/online/sellerPictureFile.ts`,
`src/online/sellerOrigins.ts`, `csp.ts`. A dialog opened inside another (the picker in Settings) now closes only
itself. Tests: `tests/sellers.test.ts`, `tests/security.test.ts`, `tests/find-it/sellers.test.tsx`.

## Answers (user, 2026-10-30)

1. Get products in how? — **Bundle in the app build.**
2. Match how? — **Suggest, user picks.**
3. Seller prices in the estimate? — **Yes, own price wins.**
4. Which categories? — **All, match what fits.**
5. Pictures? — **Load pictures, opt-in**; changed the same day to **on by default** ("Images on product listings").
6. Hardware link saved where? — **In the design.**
7. Acceptance? — **jsdom find-it.**
8. Hardware price count? — **1 seller unit per item, editable.**
9. 3D look of a seller board? — **The seller's picture as the board's decor** ("3d rendering gets it right?").
