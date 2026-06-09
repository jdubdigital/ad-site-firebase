import { getCurrentFirebaseUser, isFirebaseConfigured } from '$lib/firebase/client';
import * as firebaseFavorites from './favorites.firebase';
import * as localFavorites from './favorites.local';

export async function getFavoriteUsers() {
  if (isFirebaseConfigured) {
    const users = await firebaseFavorites.getFavoriteUsers();
    if (users) return users;
  }

  return localFavorites.getFavoriteUsers();
}

export async function setFavoriteUsers(slugs) {
  if (isFirebaseConfigured) {
    const user = await getCurrentFirebaseUser();
    if (user) {
      await firebaseFavorites.setFavoriteUsers(slugs);
      return;
    }
  }

  localFavorites.setFavoriteUsers(slugs);
}
