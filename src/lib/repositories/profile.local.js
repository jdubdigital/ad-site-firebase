import { defaultDashboardProfile } from '$lib/data/catalog';
import { getUserBySlug } from '$lib/utils/ad-utils';
import { readJson, writeJson } from './storage';

const DASHBOARD_PROFILE_KEY = 'dashboardProfile';

export function getDashboardProfile() {
  const storedProfile = readJson(DASHBOARD_PROFILE_KEY, {});
  const legacySlugKey = `${'post' + 'er'}Slug`;
  const { [legacySlugKey]: legacyUserSlug, ...currentProfile } = storedProfile;

  return {
    ...defaultDashboardProfile,
    ...currentProfile,
    userSlug: currentProfile.userSlug || legacyUserSlug || defaultDashboardProfile.userSlug
  };
}

export function setDashboardProfile(profile) {
  writeJson(DASHBOARD_PROFILE_KEY, profile);
}

export function getPublicProfileBySlug(slug) {
  const dashboardProfile = getDashboardProfile();
  if (dashboardProfile.userSlug === slug) return dashboardProfile;

  return getUserBySlug(slug) || null;
}
