// @vitest-environment jsdom
// ADR-229: the boot loads the chosen language's dictionary before the app's modules, so texts made at module load
// (module-scope t() calls) come out in Russian when Russian is stored, and English stays English.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from './find-it/setup';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** The boot order of src/main.tsx: the stored language, its dictionary, then the app. */
async function boot() {
  vi.resetModules();
  const { langReady } = await import('../src/langInit');
  await langReady;
  return import('../src/ui/viewChoice');
}

describe('language boot (ADR-229)', () => {
  it('Russian stored: module-scope texts are Russian on first load', async () => {
    localStorage.setItem('fb:lang', 'ru');
    const { NO_3D_REASON } = await boot();
    expect(NO_3D_REASON).toBe('3D-просмотр недоступен в этом браузере');
  });

  it('English stored or nothing stored: module-scope texts are English', async () => {
    const { NO_3D_REASON } = await boot();
    expect(NO_3D_REASON).toBe('3D preview is not available in this browser');
  });

  it('Russian stored: the first paint of the app is Russian', async () => {
    localStorage.setItem('fb:lang', 'ru');
    await renderApp(390);
    const places = screen.getByRole('navigation', { name: 'Разделы' });
    expect(within(places).getByRole('link', { name: /Проекты/ })).toBeTruthy();
    // The constant the app imported is the same Russian text.
    const { NO_3D_REASON } = await import('../src/ui/viewChoice');
    expect(NO_3D_REASON).toBe('3D-просмотр недоступен в этом браузере');
    // The Projects page reads the saved lists on arrival and sets state when they come back. Let those reads finish
    // before the test ends, or their state update lands after jsdom is torn down ("window is not defined").
    const { listDesigns, listProjects } = await import('../src/persist/db');
    await Promise.allSettled([listProjects(), listDesigns()]);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('main.tsx imports the app only after the dictionary is loaded', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'main.tsx'), 'utf8');
    expect(src).not.toMatch(/^import[^;]*from '\.\/ui\/App'/m);
    const ready = src.indexOf('await langReady');
    const app = src.indexOf("await import('./ui/App')");
    expect(ready).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(ready);
  });

  it('the Russian dictionary is not imported at run time by the i18n core', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'core', 'i18n', 'index.ts'), 'utf8');
    expect(src).not.toMatch(/^import \{[^}]*\} from '\.\/ru'/m);
    expect(src).toMatch(/^import type \{[^}]*\} from '\.\/ru'/m);
  });
});
