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
      await firebaseProfile.setDashboardProfile(profile);
      return;
    }
  }

  localProfile.setDashboardProfile(profile);
}

export async function getPublicProfileBySlug(slug) {
  if (isFirebaseConfigured) {
    const profile = await firebaseProfile.getPublicProfileBySlug(slug);
    if (profile) return profile;
  }

  return localProfile.getPublicProfileBySlug(slug);
}
