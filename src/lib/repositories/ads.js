import { getCurrentFirebaseUser, isFirebaseConfigured } from '$lib/firebase/client';
import * as firebaseAds from './ads.firebase';
import * as localAds from './ads.local';

export async function loadAds() {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    const likedIds = user ? (await firebaseAds.getLikedAdIds()) || [] : localAds.getLikedAdIds();
    const ads = await firebaseAds.loadAds(likedIds);
    if (ads) return ads;
  }

  return localAds.loadAds();
}

export async function getLikedAdIds() {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    if (!user) return localAds.getLikedAdIds();

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
  }

  localAds.setLikedAdIds(ids);
}

export async function createSubmittedAd(adValues, file) {
  if (isFirebaseConfigured) {
    return firebaseAds.createSubmittedAd(adValues, file);
  }

  return localAds.createSubmittedAd(adValues);
}

export async function persistEditedAd(ad, file) {
  if (isFirebaseConfigured && ad.source === 'firebase') {
    await firebaseAds.persistEditedAd(ad, file);
    return;
  }

  localAds.persistEditedAd(ad);
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
