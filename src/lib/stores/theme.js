import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const THEME_MODE_KEY = 'adArchiveThemeMode';
const modes = ['system', 'light', 'dark'];

export const themeMode = writable('system');
export const resolvedTheme = writable('light');

let systemThemeQuery;

function resolve(mode) {
  if (mode !== 'system') return mode;
  return systemThemeQuery?.matches ? 'dark' : 'light';
}

function applyTheme(mode, persist = true) {
  const nextMode = modes.includes(mode) ? mode : 'system';
  const nextResolved = resolve(nextMode);

  themeMode.set(nextMode);
  resolvedTheme.set(nextResolved);

  if (browser) {
    document.body.classList.toggle('theme-dark', nextResolved === 'dark');
    document.body.classList.toggle('theme-light', nextResolved !== 'dark');

    if (persist) {
      localStorage.setItem(THEME_MODE_KEY, nextMode);
      localStorage.removeItem('adArchiveTheme');
    }
  }
}

export function setThemeMode(mode) {
  applyTheme(mode);
}

export function initializeTheme() {
  if (!browser) return;

  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const savedMode = localStorage.getItem(THEME_MODE_KEY) || 'system';
  applyTheme(savedMode, false);

  systemThemeQuery.addEventListener('change', () => {
    themeMode.update((mode) => {
      if (mode === 'system') applyTheme('system', false);
      return mode;
    });
  });
}
