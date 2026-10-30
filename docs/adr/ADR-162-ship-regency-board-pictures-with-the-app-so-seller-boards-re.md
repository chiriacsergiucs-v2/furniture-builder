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

- **Download script** `tools/sellers/regency-pictures.mjs`: for every board and worktop of
  `src/core/sellers/regency.json` with a picture, downloads it once to `public/sellers/regency/<id>.<ext>`. Pictures
  already there are skipped. It marks each product whose file exists with `h: 1` in `regency.json`. Only https URLs
  on the seller's own picture base are fetched, a few at a time.
- **Workflow** `.github/workflows/seller-pictures.yml`, started by hand (`workflow_dispatch`): runs the script and
  opens a pull request with the pictures. Nothing is pushed to `main` directly. The repository grows by the pictures'
  size (estimated 30–60 MB).
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
      (`tests/find-it/sellers.test.tsx`, 390 and 1280 px)
- [x] Board lists show the app's copy without a seller request (find-it)
- [ ] All CI checks pass

## Implementation notes

`tools/sellers/regency-pictures.ts` (run with Node's type stripping), `.github/workflows/seller-pictures.yml`,
`hostedBase` and `h` in `src/core/sellers/types.ts`, `hostedPicture` and `pictureExt` in `src/core/sellers/index.ts`,
same-origin download in `src/online/sellerPictureFile.ts`, `AppPicture` in `src/ui/ProductPicker.tsx`. Tests:
`tests/seller-pictures.test.ts`, `tests/find-it/seller-pictures.test.tsx`. The pictures arrive in a separate pull
request opened by the workflow; until then every board falls back to the seller's site (ADR-161).

## Answers (user, 2026-10-30)

1. How do the pictures get into the app? — **Bundle board pictures.**
2. Where are they kept? — **Committed to the repository**, by a workflow started by hand.
3. Lists use the app's copy? — **Yes, for boards.**
4. Acceptance? — **jsdom find-it.**
