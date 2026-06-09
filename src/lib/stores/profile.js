import { writable } from 'svelte/store';
import { defaultDashboardProfile } from '$lib/data/catalog';
import { getDashboardProfile, setDashboardProfile } from '$lib/repositories/profile';

export const profile = writable(defaultDashboardProfile);

export async function hydrateProfile() {
  profile.set(await getDashboardProfile());
}

export async function saveProfile(updates) {
  let saved;

  profile.update((current) => {
    saved = {
      ...current,
      ...updates
    };
    return saved;
  });

  await setDashboardProfile(saved);
  return saved;
}
