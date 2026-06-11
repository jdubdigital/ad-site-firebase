import { users } from '$lib/data/catalog';

export function getAdArea(ad) {
  const [width, height] = String(ad.size).split('x').map(Number);
  return width * height || 0;
}

export function getAdChronology(ad) {
  const timestamp = Date.parse(ad.submittedAt || ad.updatedAt || '');
  if (Number.isFinite(timestamp)) return timestamp;

  const numericId = Number(ad.id);
  return Number.isFinite(numericId) ? numericId : 0;
}

export function getAdTypeLabel(type) {
  if (type === 'gif') return 'GIF';
  if (type === 'html5') return 'HTML5';
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Image';
}

export function getUserBySlug(slug) {
  return users.find((user) => user.slug === slug);
}

export function getUserInitials(name) {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function getAdUserSlug(ad) {
  return ad.userSlug || ad[`${'post' + 'er'}Slug`];
}

export function getAdUserName(ad) {
  return ad.userName || ad['posted' + 'By'] || 'User';
}

export function getAdUserType(ad) {
  return ad.userType || ad[`${'posted' + 'By'}Type`] || 'User';
}

export function getAdSearchText(ad) {
  const user = getUserBySlug(getAdUserSlug(ad));

  return [
    ad.title,
    ad.category,
    ad.medium,
    ad.tags,
    ad.size,
    ad.type,
    getAdTypeLabel(ad.type),
    getAdUserName(ad),
    getAdUserType(ad),
    ad.notes,
    ad.mediaFileName,
    user?.location,
    user?.specialty,
    user?.description
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function cleanSubmittedValue(value) {
  return String(value || '').replace(/[<>"']/g, '').trim();
}

export function getCreativeFallback(ad) {
  const [width, height] = String(ad.size || '300x250').split('x');

  if (ad.type === 'image') {
    return `https://picsum.photos/${width || 300}/${height || 250}?random=${ad.id}`;
  }

  if (ad.type === 'gif') {
    return 'https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif';
  }

  return 'https://media.giphy.com/media/l0MYB8Ory7Hqefo9a/giphy.mp4';
}
