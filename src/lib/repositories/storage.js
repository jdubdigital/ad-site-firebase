import { browser } from '$app/environment';

export function readJson(key, fallback) {
  if (!browser) return fallback;

  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  if (!browser) return;
  localStorage.setItem(key, JSON.stringify(value));
}
