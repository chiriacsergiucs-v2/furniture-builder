/** The shared start of every CSV import (reuse health check M10, G-570). Pure: imports nothing. */

/** The file's non-blank lines, without a leading byte-order mark (spreadsheets save one). */
export const csvLines = (text: string): string[] =>
  text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());

/** The column separator a header row uses: `;` when it has more of them than commas, else `,`. */
export const csvSeparator = (header: string): ';' | ',' =>
  (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ';' : ',';
