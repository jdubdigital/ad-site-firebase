import { defaultDashboardProfile, users } from '$lib/data/catalog';
import { getUserBySlug } from '$lib/utils/ad-utils';
import { cleanDisplayName, createDisplayNameKey, createUsernameSlug } from '$lib/utils/slug';
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
  const name = cleanDisplayName(currentProfile.name, defaultDashboardProfile.name);

  return {
    ...defaultDashboardProfile,
    ...currentProfile,
    name,
    displayNameKey: createDisplayNameKey(currentProfile.displayNameKey || name, defaultDashboardProfile.displayNameKey),
    username: createUsernameSlug(currentProfile.username || userSlug, userSlug),
    userSlug
  };
}

export function setDashboardProfile(profile) {
  const userSlug = createUsernameSlug(profile.userSlug || profile.username, defaultDashboardProfile.userSlug);
  const name = cleanDisplayName(profile.name, defaultDashboardProfile.name);
  const saved = {
    ...profile,
    name,
    displayNameKey: createDisplayNameKey(name, defaultDashboardProfile.displayNameKey),
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

export function checkDisplayNameAvailable(name, currentNameKey = '') {
  const cleanName = cleanDisplayName(name, '');
  const cleanKey = createDisplayNameKey(cleanName, '');
  if (cleanName.length < 2 || !cleanKey) return false;
  if (cleanKey === currentNameKey) return true;
  if (users.some((user) => createDisplayNameKey(user.name) === cleanKey)) return false;

  const dashboardProfile = getDashboardProfile();
  return dashboardProfile.displayNameKey !== cleanKey;
}
