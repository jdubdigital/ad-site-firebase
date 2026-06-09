import { writable } from 'svelte/store';

export const filtersOpen = writable(false);
export const loginOpen = writable(false);
export const loginMode = writable('signin');
export const submitOpen = writable(false);
export const submitEditingAdId = writable(null);

export function openFilters() {
  filtersOpen.set(true);
}

export function closeFilters() {
  filtersOpen.set(false);
}

export function openLogin(mode = 'signin') {
  loginMode.set(mode === 'create' ? 'create' : 'signin');
  loginOpen.set(true);
}

export function closeLogin() {
  loginOpen.set(false);
}

export function openSubmit(adId = null) {
  submitEditingAdId.set(adId);
  submitOpen.set(true);
}

export function closeSubmit() {
  submitOpen.set(false);
  submitEditingAdId.set(null);
}
