export function createSlug(value, fallback = 'user') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || fallback;
}

export function createUsernameSlug(value, fallback = '') {
  return createSlug(value, fallback).replace(/-+/g, '-');
}

export function isValidUsernameSlug(value) {
  const slug = createUsernameSlug(value, '');
  return slug.length >= 3 && slug.length <= 48 && slug === value;
}

export function cleanDisplayName(value, fallback = '') {
  const name = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);

  return name || fallback;
}

export function createDisplayNameKey(value, fallback = '') {
  return createSlug(cleanDisplayName(value), fallback).slice(0, 64);
}

export function createNameFromEmail(email, fallback = 'New User') {
  const name = String(email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return name || fallback;
}

export function safeFileName(name) {
  return String(name || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}
