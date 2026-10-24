import { useSyncExternalStore } from 'react'

/**
 * Light / dark theme. Follows the system until the user picks one; the choice is kept on this device only
 * (localStorage, no telemetry — ADR-002). `data-theme` on <html> drives the CSS tokens.
 */
export type Theme = 'light' | 'dark'
const KEY = 'fb:theme'
const listeners = new Set<() => void>()

function stored(): Theme | null {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null } catch { return null }
}
let chosen: Theme | null = stored()

export function systemTheme(): Theme {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function currentTheme(): Theme { return chosen ?? systemTheme() }

/** Writes the attribute and the browser-chrome colour; called once at start-up and on every change. */
export function applyTheme() {
  const root = document.documentElement
  if (chosen) root.dataset.theme = chosen; else delete root.dataset.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', currentTheme() === 'dark' ? '#0f1213' : '#22272a')
  listeners.forEach(l => l())
}

export function setTheme(t: Theme | null) {
  chosen = t
  try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY) } catch { /* private mode: the choice lasts for this page only */ }
  applyTheme()
}

function subscribe(l: () => void) {
  listeners.add(l)
  const m = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
  m?.addEventListener('change', applyTheme)
  return () => { listeners.delete(l); m?.removeEventListener('change', applyTheme) }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light')
}
