# Uploaded template and service evidence


**Status:** Verified uploaded file bytes in this chat's working container, 21 October 2026. These were incorrectly described as inaccessible in the prior Deep Research report. They are available here, but not automatically available in any future Claude Flow checkout.

## Workbook family

All four `SABLON DEBITARE NOU` variants are distinct by SHA-256, have 3 worksheet XML parts and 6 formula nodes per file. The base workbook was opened and read with the spreadsheet reader. `Sheet1` starts with `CODUL DE PAL`, `Lungime`, `Latime`, `Nr. Buc.`, `Fibra`, two `ABS Lungime` columns and two `ABS latime` columns. `Sheet2` is a lookup with `DOCOR`, `ABS`, `FIBRA`, `OPERATIE`, including board formats and edging codes. **Do not assume the four versions contain identical data, formulas, semantics, or row ordering.** See `workbook-inventory.json` for hashes.

## SALICE cutting-order PDF (4 pages)

The user-supplied form has columns `NR BUC`, `VERTICAL`, `ORIZONTAL`, `FIBRA`, `CVS`, `COS`, `CVD`, `COJ`; it explicitly says the dimensions completed by the customer are FINAL **including ABS thickness**. `FIBRA`: 1 for vertical alignment, otherwise 0. Edge columns refer to left/top/right/bottom. Its sample codes: 1=CANT 22/.04, 2=CANT 22/2, 3=CANT 33/2, 4=CANT 42/2, 5=CANT 22/1. This is a supplier-specific **input contract**, not proof the application's native exact-cut dimensions use the same convention. Create an explicit adapter decision before mapping.

## Text exports

`Branch · Branch · Fișiere salvate și grupate.txt` discusses a living-room configuration: column 535×2600×400 mm, lower front 535×2162, upper front 535×436, 2 mm reveal; upper/lower bodies 2685×435×400. This is a conversation extract with a project-specific geometry claim, not a verified manufacturing spec. It also includes a large interactive three.js HTML block which is not carried verbatim into the knowledge export.

`Estimare servicii Salice.txt` reports an example 3 PAL sheets (2800×2070×18) + 3 MDF P110 sheets (2800×1220×18), 69 PAL and 38 MDF pieces, and 4mm cutting separation. These are source-quoted estimates, **not independently rerun nesting results**, and should not become global project defaults.

## Mapping gate

Before any commercial XLSX/SALICE adapter: compare versions, identify row types/merged cells/formulas, distinguish dimensions before/after edge-banding, validate grain encoding, obtain one signed-off fixture with expected export, and test roundtrips. `TSK-010` is **ready for a mapping specification** but **not production-complete**. The repo's *Regency workbook* mentioned in `docs/progress.json` is a different named source; do not relabel the uploaded templates as that Regency workbook without evidence.
