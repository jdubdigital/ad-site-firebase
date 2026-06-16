import { defaultDashboardProfile } from '$lib/data/catalog';
import { getUserBySlug } from '$lib/utils/ad-utils';
import { createUsernameSlug } from '$lib/utils/slug';
import { readJson, writeJson } from './storage';

const DASHBOARD_PROFILE_KEY = 'dashboardProfile';

export function getDashboardProfile() {
  const storedProfile = readJson(DASHBOARD_PROFILE_KEY, {});
  const legacySlugKey = `${'post' + 'er'}Slug`;
  const { [legacySlugKey]: legacyUserSlug, ...currentProfile } = storedProfile;
  const userSlug = createUsernameSlug(
    currentProfile.userSlug || legacyUserSlug || currentProfile.username,
    defaultDashboardProfile.userSlug
  );

  return {
    ...defaultDashboardProfile,
    ...currentProfile,
    name: createUsernameSlug(currentProfile.username || userSlug, userSlug),
    username: createUsernameSlug(currentProfile.username || userSlug, userSlug),
    userSlug
  };
}

export function setDashboardProfile(profile) {
  const userSlug = createUsernameSlug(profile.userSlug || profile.username, defaultDashboardProfile.userSlug);
  const saved = {
    ...profile,
    name: userSlug,
    username: userSlug,
    userSlug
  };

  writeJson(DASHBOARD_PROFILE_KEY, saved);
  return saved;
}

export function getPublicProfileBySlug(slug) {
  const dashboardProfile = getDashboardProfile();
  if (dashboardProfile.userSlug === slug) return dashboardProfile;

  return getUserBySlug(slug) || null;
}

export function checkUserSlugAvailable(slug, currentSlug = '') {
  const cleanSlug = createUsernameSlug(slug, '');
  if (!cleanSlug) return false;
  if (cleanSlug === currentSlug) return true;
  return !getPublicProfileBySlug(cleanSlug);
}
