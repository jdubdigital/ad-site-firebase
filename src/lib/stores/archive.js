import { derived, get, writable } from 'svelte/store';
import {
  createSubmittedAd,
  getLikedAdIds,
  loadAds,
  persistAdLike,
  persistDeletedAd,
  persistEditedAd,
  setLikedAdIds
} from '$lib/repositories/ads';
import { createMockAds } from '$lib/data/catalog';
import { isFirebaseConfigured } from '$lib/firebase/client';
import { getAdArea, getAdChronology, getAdSearchText } from '$lib/utils/ad-utils';

const batchSize = 12;

export const ads = writable(isFirebaseConfigured ? [] : createMockAds());
export const activeFilters = writable({
  query: '',
  category: 'all',
  medium: 'all',
  type: 'all'
});
export const sortMode = writable('newest');
export const visibleCount = writable(batchSize);
export const adsReady = writable(!isFirebaseConfigured);

export const filteredAds = derived([ads, activeFilters, sortMode], ([$ads, $activeFilters, $sortMode]) => {
  const query = $activeFilters.query.toLowerCase();
  const filtered = $ads.filter((ad) => {
    const matchesQuery = !query || getAdSearchText(ad).includes(query);
    const matchesCategory = $activeFilters.category === 'all' || ad.category === $activeFilters.category;
    const matchesMedium = $activeFilters.medium === 'all' || (ad.medium || 'Web') === $activeFilters.medium;
    const matchesType = $activeFilters.type === 'all' || ad.type === $activeFilters.type;

    return matchesQuery && matchesCategory && matchesMedium && matchesType;
  });

  return filtered.sort((a, b) => {
    if ($sortMode === 'oldest') return getAdChronology(a) - getAdChronology(b);
    if ($sortMode === 'popular') return b.likes - a.likes;
    if ($sortMode === 'size') return getAdArea(b) - getAdArea(a);
    return getAdChronology(b) - getAdChronology(a);
  });
});

export const visibleAds = derived([filteredAds, visibleCount], ([$filteredAds, $visibleCount]) =>
  $filteredAds.slice(0, $visibleCount)
);

export async function hydrateAds() {
  adsReady.set(false);
  try {
    ads.set(await loadAds());
  } finally {
    adsReady.set(true);
  }
}

export function resetVisibleAds() {
  visibleCount.set(batchSize);
}

export function loadMoreAds() {
  visibleCount.update((count) => count + batchSize);
}

export function setSearchQuery(query) {
  activeFilters.update((filters) => ({ ...filters, query: query.trim() }));
  resetVisibleAds();
}

export function setFilter(type, value) {
  activeFilters.update((filters) => ({ ...filters, [type]: value }));
  resetVisibleAds();
}

export function clearFilters() {
  activeFilters.set({
    query: '',
    category: 'all',
    medium: 'all',
    type: 'all'
  });
  resetVisibleAds();
}

export function setSortMode(mode) {
  sortMode.set(mode);
  resetVisibleAds();
}

export async function toggleAdLike(adId) {
  let nextLikedIds = await getLikedAdIds();
  let nextLiked = false;

  ads.update((items) =>
    items.map((ad) => {
      if (ad.id !== adId) return ad;

      const liked = !ad.liked;
      nextLiked = liked;
      nextLikedIds = liked
        ? [...new Set([...nextLikedIds, ad.id])]
        : nextLikedIds.filter((id) => id !== ad.id);

      return {
        ...ad,
        liked,
        likes: Math.max(0, ad.likes + (liked ? 1 : -1))
      };
    })
  );

  setLikedAdIds(nextLikedIds).catch(() => {});
  persistAdLike(adId, nextLiked).catch(() => {});
}

export async function submitAd(adValues, file) {
  const ad = await createSubmittedAd(adValues, file);
  ads.update((items) => [ad, ...items]);
  resetVisibleAds();
  return ad;
}

export async function updateAd(adId, updates, file) {
  const existing = get(ads).find((ad) => ad.id === adId);
  if (!existing) throw new Error('This ad could not be found.');

  const updated = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  const persisted = await persistEditedAd(updated, file);
  const finalAd = {
    ...updated,
    ...(persisted || {})
  };

  ads.update((items) => items.map((ad) => (ad.id === adId ? finalAd : ad)));
  return finalAd;
}

export async function deleteAd(adId) {
  const existing = get(ads).find((ad) => ad.id === adId);
  if (!existing) throw new Error('This ad could not be found.');

  await persistDeletedAd(existing);

  ads.update((items) => items.filter((ad) => ad.id !== adId));

  const likedIds = await getLikedAdIds();
  if (likedIds.includes(adId)) {
    await setLikedAdIds(likedIds.filter((id) => id !== adId));
  }
}
