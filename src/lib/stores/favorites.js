import { get, writable } from 'svelte/store';
import { getFavoriteUsers, setFavoriteUsers } from '$lib/repositories/favorites';
import { signedInEmail } from '$lib/stores/account';
import { openLogin } from '$lib/stores/ui';

export const favoriteUsers = writable([]);

export async function hydrateFavorites() {
  favoriteUsers.set(await getFavoriteUsers());
}

export function toggleFavoriteUser(slug) {
  if (!get(signedInEmail)) {
    openLogin('signin');
    return false;
  }

  let nextFavorites = [];

  favoriteUsers.update((current) => {
    const next = current.includes(slug)
      ? current.filter((favoriteSlug) => favoriteSlug !== slug)
      : [...current, slug];

    nextFavorites = next;
    return next;
  });

  setFavoriteUsers(nextFavorites).catch(() => {});
  return true;
}
