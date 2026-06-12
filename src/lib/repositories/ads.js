import { getCurrentFirebaseUser, isFirebaseConfigured } from '$lib/firebase/client';
import * as firebaseAds from './ads.firebase';
import * as localAds from './ads.local';

export async function loadAds() {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    const likedIds = user ? (await firebaseAds.getLikedAdIds()) || [] : [];
    const ads = await firebaseAds.loadAds(likedIds);
    if (ads) return ads;
  }

  return localAds.loadAds();
}

export async function getLikedAdIds() {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    if (!user) return [];

    const ids = await firebaseAds.getLikedAdIds();
    if (ids) return ids;
  }

  return localAds.getLikedAdIds();
}

export async function setLikedAdIds(ids) {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    if (user) {
      await firebaseAds.setLikedAdIds(ids);
      return;
    }
    return;
  }

  localAds.setLikedAdIds(ids);
}

export async function createSubmittedAd(adValues, file, options = {}) {
  if (isFirebaseConfigured) {
    return firebaseAds.createSubmittedAd(adValues, file, options);
  }

  return localAds.createSubmittedAd(adValues, options);
}

export async function persistEditedAd(ad, file, options = {}) {
  if (isFirebaseConfigured && ad.source === 'firebase') {
    return firebaseAds.persistEditedAd(ad, file, options);
  }

  localAds.persistEditedAd(ad, options);
  return ad;
}

export async function persistDeletedAd(ad) {
  if (isFirebaseConfigured && ad.source === 'firebase') {
    await firebaseAds.persistDeletedAd(ad);
    return;
  }

  localAds.persistDeletedAd(ad);
}

export async function persistAdLike(adId, liked) {
  if (isFirebaseConfigured) {
    await firebaseAds.persistAdLike(adId, liked);
  }
}
