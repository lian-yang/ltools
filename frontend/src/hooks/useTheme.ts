import { useSyncExternalStore } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
const key = 'ltools-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(key);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch { /* Storage can be unavailable in restricted WebViews. */ }
  return 'dark';
}

let preference = readPreference();
let resolved: 'light' | 'dark' = 'dark';

function applyTheme() {
  resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  listeners.forEach(listener => listener());
}

export function setTheme(value: ThemePreference) {
  preference = value;
  try { localStorage.setItem(key, value); } catch { /* Keep the session preference. */ }
  applyTheme();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => preference);
  const resolvedTheme = useSyncExternalStore(subscribe, () => resolved);
  return { theme, resolvedTheme, setTheme };
}

media.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) {
    preference = readPreference();
    applyTheme();
  }
});
// Independent Wails windows read the same origin's preference when reopened.
window.addEventListener('focus', () => {
  preference = readPreference();
  applyTheme();
});
applyTheme();
