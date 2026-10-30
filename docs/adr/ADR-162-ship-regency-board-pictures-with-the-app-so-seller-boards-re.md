# ADR-162: Ship Regency board pictures with the app so seller boards render their decor

- Status: Pending
- Date: 2026-10-30
- Decided by: user, 2026-10-30 (answers below)
- Depends on: ADR-161
- Design: docs/ui-design.md (Materials)
- Backlog: N164

## Context

The user, 2026-10-30, after [ADR-161](../adr-done/ADR-161-bundle-seller-product-catalogs-and-match-products-to-boards.md)
shipped: "You didnt use the image i provided to render". ADR-161 downloads a seller board's picture from
regencycompany.ro when it is picked. A browser only lets a page read a picture from another site (as the 3D view and
the average colour need) when that site allows it (CORS), and this was never confirmed. The session cannot reach
regencycompany.ro, so its screenshots used a stand-in picture. The user chose to keep the board pictures in the
repository instead of fetching them from the seller.

## Decision

- **Thumbnails in the catalog.** The user's thumbnail file (product id → link) is read by the converter
  (`tools/sellers/regency.mjs`, third argument): the catalog gains `thumbBase`; a product whose thumbnail is on another
  path keeps it as `ti` ('' = none). For the Regency export of 2026-10-29 every thumbnail has the picture's path, so
  only `thumbBase` is added. Product lists show the thumbnail instead of the full picture.
- **Download script** `tools/sellers/regency-pictures.ts`: `download` fetches the full picture of every board and
  worktop not yet in `public/sellers/regency/` into a separate folder (the thumbnails, about 95 px, were too small for
  a board's decor: 65 px after the crop); `mark` sets `h: 1` on each product whose file
  exists. Only https URLs on the picture base are fetched, a few at a time.
- **Workflow** `.github/workflows/seller-pictures.yml`, started by hand (`workflow_dispatch`): downloads, keeps the
  bottom-left 68 % of each new picture (the seller's "SLIMLINE" badge sits in the top-right corner), resizes it to at
  most 512 px, files it as `<id>.<ext>`, marks the catalog and pushes a branch; it opens the pull request when Actions
  may, otherwise Claude opens it. Nothing is pushed to `main` directly. The first run, on full pictures without crop,
  came to 301 MB for 1 454 files; cropped and resized, a 16-picture sample shrank to about 17 %.
- **Board pick:** a product with `h` takes the app's own copy (same origin, no seller request). It is saved as the
  board's picture and its average colour becomes the board's colour (ADR-048), so 3D and the front view show the
  decor. A product without `h` falls back to the seller's site, as in ADR-161.
- **Lists:** boards and worktops with `h` show the app's own copy, with no tick box needed. Other products still load
  from the seller while **Show seller pictures (online)** is on.
- The pictures are not precached (they would add tens of MB to the offline download); a board's picture is kept on
  the device once picked.

## Alternatives considered

- **Download at each deploy** — keeps the repository small, but every deploy would depend on the seller's site. Not
  chosen.
- **The user adds each picture by hand** — two extra taps per board. Not chosen.

## Scope

- In scope: the download script, the workflow, `h` in the catalog, board pick and lists using the app's copy.
- Out of scope: band and hardware pictures (G-315); checking the pictures' look before shipping (G-316).

## Consequences

- Seller boards render their decor whatever the seller's site allows.
- The repository grows with every picture refresh.

## Done when

- [x] The script fetches only boards and worktops on the seller's picture base, skips files already there and marks `h`
      (`tests/seller-pictures.test.ts`)
- [x] A board with `h` takes the app's copy as its picture and colour; one without falls back to the seller
      (`tests/find-it/seller-pictures.test.tsx`, 390 and 1280 px)
- [x] Board lists show the app's copy without a seller request (find-it)
- [ ] All CI checks pass

## Implementation notes

`tools/sellers/regency-pictures.ts` (run with Node's type stripping), `.github/workflows/seller-pictures.yml`,
`hostedBase`, `thumbBase`, `ti` and `h` in `src/core/sellers/types.ts`, `hostedPicture`, `thumbUrl` and `pictureExt` in
`src/core/sellers/index.ts`,
same-origin download in `src/online/sellerPictureFile.ts`, `AppPicture` in `src/ui/ProductPicker.tsx`. Tests:
`tests/seller-pictures.test.ts`, `tests/find-it/seller-pictures.test.tsx`. The pictures arrive in a separate pull
request opened by the workflow; until then every board falls back to the seller's site (ADR-161).

## Answers (user, 2026-10-30)

1. How do the pictures get into the app? — **Bundle board pictures.**
2. Where are they kept? — **Committed to the repository**, by a workflow started by hand.
3. Lists use the app's copy? — **Yes, for boards.**
4. Acceptance? — **jsdom find-it.**
5. The full pictures came to 301 MB, some with a badge — **crop to the bottom-left 68 % and resize to 512 px.**
6. "Images also have a thumbnail value … also add to the dataset. Update workflow to fetch the thumbnail for
   rendering" — **`thumbBase`/`ti` in the catalog; the workflow downloads thumbnails.**
7. The thumbnails came to 65 × 65 px after the crop (1.3 MB, blurry in 3D) — **full pictures, cropped, 512 px**;
   lists keep the thumbnails.
