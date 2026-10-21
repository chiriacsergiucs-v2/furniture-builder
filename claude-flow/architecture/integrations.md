# Integrations and file interchange

| Direction | Format | Code | Notes |
|---|---|---|---|
| In | CSV parts (`Name,Width_mm,Height_mm,Quantity,Material_ID,Rotate,Grain,ABS_Top,ABS_Right,ABS_Bottom,ABS_Left,Group,Notes`) | `src/import-export/csv.ts` | RFC 4180 quoting |
| In | Generic XLSX (known EN/RO headers) | `src/import-export/excel.ts` | ExcelJS lazy; no vendor mapping (ADR-0026) |
| Out | CSV placements, cut-order XLSX | `csv.ts`, `excel.ts` | derived from cut tree |
| Out | SVG per board, print/PDF via browser | `svg.ts` | cut lines from tree (ADR-0014) |
| Out/In | Project JSON v1, preset-library JSON v1, full DB JSON v1 | `src/db/backup.ts` | merge, never overwrite (ADR-0006) |
| Out | Fusion 360 Python (direct-model B-rep) | `src/assembly/fusion.ts` | unverified in Fusion (ADR-0025) |

No network integrations exist (ADR-0002). Supplier workbooks (Regency "SABLON DEBITARE NOU", SALICE forms) are
**not** in the repository; `regencyIntegrationStatus` is PENDING.
