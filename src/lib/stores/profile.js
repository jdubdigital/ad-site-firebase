import { get, writable } from 'svelte/store';
import { defaultDashboardProfile } from '$lib/data/catalog';
import {
  checkDisplayNameAvailable as checkProfileDisplayNameAvailable,
  checkUserSlugAvailable as checkProfileSlugAvailable,
  getDashboardProfile,
  setDashboardProfile
} from '$lib/repositories/profile';

export const profile = writable(defaultDashboardProfile);

export async function hydrateProfile() {
  profile.set(await getDashboardProfile());
}

export async function saveProfile(updates) {
  const current = get(profile);
  const nextProfile = {
    ...current,
    ...updates
  };
  const saved = (await setDashboardProfile(nextProfile)) || nextProfile;

  profile.set(saved);
  return saved;
}

export async function checkUserSlugAvailable(slug, currentSlug = '') {
  return checkProfileSlugAvailable(slug, currentSlug);
}

export async function checkDisplayNameAvailable(name, currentNameKey = '') {
  return checkProfileDisplayNameAvailable(name, currentNameKey);
}
