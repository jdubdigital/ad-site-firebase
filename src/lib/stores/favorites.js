import { writable } from 'svelte/store';
import { getFavoriteUsers, setFavoriteUsers } from '$lib/repositories/favorites';

export const favoriteUsers = writable([]);

export async function hydrateFavorites() {
  favoriteUsers.set(await getFavoriteUsers());
}

export function toggleFavoriteUser(slug) {
  let nextFavorites = [];

  favoriteUsers.update((current) => {
    const next = current.includes(slug)
      ? current.filter((favoriteSlug) => favoriteSlug !== slug)
      : [...current, slug];

    nextFavorites = next;
    return next;
  });

  setFavoriteUsers(nextFavorites).catch(() => {});
}
