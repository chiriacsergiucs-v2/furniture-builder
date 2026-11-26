// The Russian and English print tables are a lazy chunk (G-496); the app loads them before choosing either language
// (src/langInit.ts, the More menu). Tests choose a print language directly with setPrintLang, so they are loaded once
// here; they live on the global object, so every copy of the app the tests load sees them.
import { loadPrintTables } from '@furniture-builder/i18n/print';

await loadPrintTables();
