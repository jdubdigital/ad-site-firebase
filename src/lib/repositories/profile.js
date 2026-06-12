import { getCurrentFirebaseUser, isFirebaseConfigured } from '$lib/firebase/client';
import * as firebaseProfile from './profile.firebase';
import * as localProfile from './profile.local';

export async function getDashboardProfile() {
  if (isFirebaseConfigured) {
    const profile = await firebaseProfile.getDashboardProfile();
    if (profile) return profile;
  }

  return localProfile.getDashboardProfile();
}

export async function setDashboardProfile(profile) {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    if (user) {
      return firebaseProfile.setDashboardProfile(profile);
    }
  }

  return localProfile.setDashboardProfile(profile);
}

export async function getPublicProfileBySlug(slug) {
  if (isFirebaseConfigured) {
    const profile = await firebaseProfile.getPublicProfileBySlug(slug);
    if (profile) return profile;
  }

  return localProfile.getPublicProfileBySlug(slug);
}

export async function checkUserSlugAvailable(slug, currentSlug = '') {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    return firebaseProfile.checkUserSlugAvailable(slug, user?.uid || '');
  }

  return localProfile.checkUserSlugAvailable(slug, currentSlug);
}

export async function checkDisplayNameAvailable(name, currentNameKey = '') {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    return firebaseProfile.checkDisplayNameAvailable(name, user?.uid || '');
  }

  return localProfile.checkDisplayNameAvailable(name, currentNameKey);
}
