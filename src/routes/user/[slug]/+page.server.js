import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_PROJECT_ID
} from '$env/static/public';
import { createNameFromEmail, createSlug } from '$lib/utils/slug';

const demoProfileName = 'Mohegan Sun';
const demoProfileDescription = 'Public profile summary for the ads, campaigns, and creative references you share.';

function decodeValue(value = {}) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function decodeDocument(document) {
  if (!document) return null;

  return {
    id: document.name.split('/').pop(),
    ...decodeFields(document.fields)
  };
}

function normalizeProfile(profile, slug) {
  if (!profile) return null;

  const isLegacyDemoProfile =
    profile.name === demoProfileName && (!profile.description || profile.description === demoProfileDescription);

  return {
    ...profile,
    slug,
    name: !profile.name || isLegacyDemoProfile ? createNameFromEmail(profile.email) : profile.name,
    userSlug: profile.userSlug || slug,
    description: profile.description || 'Public profile for ads and creative references shared by this user.'
  };
}

function normalizeAd(ad) {
  if (!ad) return null;

  return {
    ...ad,
    source: 'firebase',
    liked: false,
    submittedAt: ad.submittedAt || ad.createdAt || new Date().toISOString()
  };
}

async function runQuery(collectionId, slug, limit = 12) {
  if (!PUBLIC_FIREBASE_API_KEY || !PUBLIC_FIREBASE_PROJECT_ID || !slug) return [];

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userSlug' },
              op: 'EQUAL',
              value: { stringValue: slug }
            }
          },
          limit
        }
      })
    }
  );

  if (!response.ok) return [];

  const result = await response.json();
  return result.map((item) => decodeDocument(item.document)).filter(Boolean);
}

export async function load({ params }) {
  const slug = createSlug(params.slug);
  const [profiles, ads] = await Promise.all([runQuery('profiles', slug, 1), runQuery('ads', slug, 24)]);
  const firstAd = ads[0];

  return {
    publicUser:
      normalizeProfile(profiles[0], slug) ||
      (firstAd
        ? {
            slug,
            userSlug: slug,
            name: firstAd.userName || 'User',
            type: firstAd.userType || 'User',
            description: 'Public profile for ads and creative references shared by this user.',
            avatarUrl: ''
          }
        : null),
    userAds: ads.map(normalizeAd)
  };
}
