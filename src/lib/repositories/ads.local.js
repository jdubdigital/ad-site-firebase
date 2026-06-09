import { createMockAds } from '$lib/data/catalog';
import { readJson, writeJson } from './storage';

const LIKED_ADS_KEY = 'likedAds';
const SUBMITTED_ADS_KEY = 'submittedAds';
const EDITED_ADS_KEY = 'editedAds';

export function getLikedAdIds() {
  return readJson(LIKED_ADS_KEY, []);
}

export function setLikedAdIds(ids) {
  writeJson(LIKED_ADS_KEY, ids);
}

export function getSubmittedAds() {
  return readJson(SUBMITTED_ADS_KEY, []);
}

export function setSubmittedAds(items) {
  writeJson(SUBMITTED_ADS_KEY, items);
}

export function getEditedAds() {
  return readJson(EDITED_ADS_KEY, {});
}

export function setEditedAds(items) {
  writeJson(EDITED_ADS_KEY, items);
}

export function applyEditedAds(items) {
  const editedAds = getEditedAds();
  return items.map((ad) => (editedAds[ad.id] ? { ...ad, ...editedAds[ad.id] } : ad));
}

function normalizeAd(ad) {
  const legacyProfileKey = 'post' + 'er';
  const legacyProfileSlugKey = `${legacyProfileKey}Slug`;
  const legacyNameKey = 'posted' + 'By';
  const legacyTypeKey = `${legacyNameKey}Type`;
  const {
    [legacyProfileSlugKey]: legacyUserSlug,
    [legacyNameKey]: legacyUserName,
    [legacyTypeKey]: legacyUserType,
    ...currentAd
  } = ad;

  return {
    ...currentAd,
    userSlug: currentAd.userSlug || legacyUserSlug,
    userName: currentAd.userName || legacyUserName,
    userType: currentAd.userType || legacyUserType
  };
}

export function loadAds() {
  const likedIds = getLikedAdIds();
  const items = applyEditedAds([...getSubmittedAds(), ...createMockAds()]).map(normalizeAd);

  return items.map((ad) => ({
    ...ad,
    liked: likedIds.includes(ad.id),
    likes: likedIds.includes(ad.id) && !ad.liked ? ad.likes + 1 : ad.likes
  }));
}

export function createSubmittedAd(adValues) {
  const ad = {
    id: Date.now(),
    ...adValues,
    likes: 0,
    liked: false,
    submittedAt: new Date().toISOString()
  };

  setSubmittedAds([ad, ...getSubmittedAds()]);
  return ad;
}

export function persistEditedAd(ad) {
  const submittedAds = getSubmittedAds();
  const submittedIndex = submittedAds.findIndex((item) => item.id === ad.id);

  if (submittedIndex >= 0) {
    submittedAds[submittedIndex] = ad;
    setSubmittedAds(submittedAds);
  }

  setEditedAds({
    ...getEditedAds(),
    [ad.id]: ad
  });
}

export function persistDeletedAd(ad) {
  setSubmittedAds(getSubmittedAds().filter((item) => item.id !== ad.id));
  setLikedAdIds(getLikedAdIds().filter((id) => id !== ad.id));

  const editedAds = getEditedAds();
  if (editedAds[ad.id]) {
    delete editedAds[ad.id];
    setEditedAds(editedAds);
  }
}
