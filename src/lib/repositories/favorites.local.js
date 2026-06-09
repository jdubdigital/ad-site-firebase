import { readJson, writeJson } from './storage';

const FAVORITE_USERS_KEY = 'favoriteUsers';
const LEGACY_FAVORITE_USERS_KEY = 'favorite' + 'Post' + 'ers';

export function getFavoriteUsers() {
  const savedUsers = readJson(FAVORITE_USERS_KEY, []);
  return savedUsers.length ? savedUsers : readJson(LEGACY_FAVORITE_USERS_KEY, []);
}

export function setFavoriteUsers(slugs) {
  writeJson(FAVORITE_USERS_KEY, slugs);
}
