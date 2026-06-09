const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { logger } = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const AdmZip = require('adm-zip');

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10
});

if (!getApps().length) initializeApp();

const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();

const html5MaxFiles = 120;
const html5MaxFileBytes = 5 * 1024 * 1024;
const html5MaxTotalBytes = 15 * 1024 * 1024;
const html5AllowedExtensions = new Set([
  'css',
  'gif',
  'htm',
  'html',
  'jpeg',
  'jpg',
  'js',
  'json',
  'mp3',
  'mp4',
  'otf',
  'png',
  'svg',
  'ttf',
  'txt',
  'webm',
  'webp',
  'woff',
  'woff2'
]);
const html5MimeTypes = {
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  htm: 'text/html; charset=utf-8',
  html: 'text/html; charset=utf-8',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  otf: 'font/otf',
  png: 'image/png',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  webm: 'video/webm',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2'
};

function apiPath(req) {
  const path = (req.path || req.url.split('?')[0] || '/').replace(/^\/api(?=\/|$)/, '');
  return path || '/';
}

function sendJson(res, status, body) {
  res.status(status).set('cache-control', 'no-store').json(body);
}

async function requireUser(req) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/);

  if (!match) {
    const error = new Error('Missing Firebase ID token.');
    error.status = 401;
    throw error;
  }

  try {
    return await auth.verifyIdToken(match[1]);
  } catch (cause) {
    const error = new Error('Invalid Firebase ID token.');
    error.status = 401;
    error.cause = cause;
    throw error;
  }
}

async function collectionCount(collectionName) {
  const snapshot = await db.collection(collectionName).count().get();
  return snapshot.data().count || 0;
}

function parseJsonBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function extensionForPath(path) {
  const match = String(path || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function normalizeZipPath(path) {
  const cleaned = String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (!cleaned || cleaned.length > 220 || /[\0?#]/.test(cleaned)) return '';
  if (cleaned.startsWith('__MACOSX/') || cleaned.endsWith('/.DS_Store')) return '';

  const parts = cleaned.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => part === '.' || part === '..')) return '';

  return parts.join('/');
}

function encodePreviewPath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function selectEntryPath(paths) {
  const htmlPaths = paths.filter((path) => ['html', 'htm'].includes(extensionForPath(path)));
  if (!htmlPaths.length) return '';

  return (
    htmlPaths.find((path) => path.toLowerCase() === 'index.html') ||
    htmlPaths.find((path) => path.toLowerCase() === 'index.htm') ||
    htmlPaths.find((path) => path.toLowerCase().endsWith('/index.html')) ||
    htmlPaths.find((path) => path.toLowerCase().endsWith('/index.htm')) ||
    htmlPaths[0]
  );
}

async function extractHtml5Archive(adId, storagePath) {
  if (!storagePath || !storagePath.endsWith('.zip')) {
    throw httpError(400, 'HTML5 preview extraction needs a ZIP file uploaded to Firebase Storage.');
  }

  const sourceFile = bucket.file(storagePath);
  const [exists] = await sourceFile.exists();
  if (!exists) throw httpError(404, 'The uploaded ZIP file could not be found.');

  const [archiveBuffer] = await sourceFile.download();
  const zip = new AdmZip(archiveBuffer);
  const files = [];
  let totalBytes = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const path = normalizeZipPath(entry.entryName);
    if (!path) continue;

    const extension = extensionForPath(path);
    if (!html5AllowedExtensions.has(extension)) {
      throw httpError(400, `Unsupported file in ZIP: ${path}`);
    }

    const size = Number(entry.header?.size || 0);
    if (size > html5MaxFileBytes) throw httpError(400, `File is too large in ZIP: ${path}`);

    totalBytes += size;
    if (totalBytes > html5MaxTotalBytes) {
      throw httpError(400, 'The extracted HTML5 package is too large.');
    }

    files.push({
      path,
      buffer: entry.getData(),
      contentType: html5MimeTypes[extension] || 'application/octet-stream'
    });
  }

  if (!files.length) throw httpError(400, 'The ZIP did not contain any previewable files.');
  if (files.length > html5MaxFiles) throw httpError(400, `HTML5 ZIPs can contain at most ${html5MaxFiles} files.`);

  const entryPath = selectEntryPath(files.map((file) => file.path));
  if (!entryPath) throw httpError(400, 'The ZIP needs an index.html or another HTML entry file.');

  const basePath = `html5Previews/${adId}`;
  await bucket.deleteFiles({ prefix: `${basePath}/`, force: true });

  await Promise.all(
    files.map((file) =>
      bucket.file(`${basePath}/${file.path}`).save(file.buffer, {
        metadata: {
          contentType: file.contentType,
          cacheControl: file.contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600'
        },
        resumable: false
      })
    )
  );

  return {
    htmlPreviewBasePath: basePath,
    htmlPreviewEntryPath: entryPath,
    htmlPreviewUrl: `/api/html5/${adId}/${encodePreviewPath(entryPath)}`,
    htmlPreviewFileCount: files.length,
    htmlPreviewStatus: 'ready'
  };
}

async function handleHtml5Extraction(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const user = await requireUser(req);
  const { adId } = parseJsonBody(req);
  if (!adId || typeof adId !== 'string') throw httpError(400, 'Missing adId.');

  const adRef = db.collection('ads').doc(adId);
  const snapshot = await adRef.get();
  if (!snapshot.exists) throw httpError(404, 'Ad not found.');

  const ad = snapshot.data();
  if (ad.ownerUid !== user.uid) throw httpError(403, 'You can only extract ZIP previews for your own ads.');
  if (ad.type !== 'html5') throw httpError(400, 'Only HTML5 ZIP ads can be extracted.');

  try {
    const previewFields = await extractHtml5Archive(adId, ad.mediaStoragePath || '');
    await adRef.update({
      ...previewFields,
      htmlPreviewError: null,
      htmlPreviewProcessedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    sendJson(res, 200, previewFields);
  } catch (error) {
    await adRef.update({
      htmlPreviewStatus: 'failed',
      htmlPreviewError: error.status ? error.message : 'The ZIP could not be extracted.',
      updatedAt: new Date().toISOString()
    });
    throw error;
  }
}

function previewContentHeaders(contentType) {
  const headers = {
    'cache-control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'content-security-policy':
      "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' data: blob:; connect-src 'none'; frame-ancestors 'self'",
    'x-content-type-options': 'nosniff'
  };

  if (contentType) headers['content-type'] = contentType;
  return headers;
}

async function handleHtml5Preview(path, res) {
  const match = path.match(/^\/html5\/([^/]+)\/(.+)$/);
  if (!match) {
    sendJson(res, 404, { error: 'HTML5 preview not found' });
    return;
  }

  const adId = decodeURIComponent(match[1]);
  const requestedPath = normalizeZipPath(decodeURIComponent(match[2]));
  if (!adId || !requestedPath) throw httpError(400, 'Invalid HTML5 preview path.');

  const snapshot = await db.collection('ads').doc(adId).get();
  if (!snapshot.exists) throw httpError(404, 'Ad not found.');

  const ad = snapshot.data();
  if (ad.type !== 'html5' || ad.htmlPreviewStatus !== 'ready' || !ad.htmlPreviewBasePath) {
    throw httpError(404, 'HTML5 preview is not ready.');
  }

  const file = bucket.file(`${ad.htmlPreviewBasePath}/${requestedPath}`);
  const [exists] = await file.exists();
  if (!exists) throw httpError(404, 'HTML5 preview asset not found.');

  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  const contentType = metadata.contentType || html5MimeTypes[extensionForPath(requestedPath)] || 'application/octet-stream';

  res.status(200).set(previewContentHeaders(contentType)).send(buffer);
}

exports.api = onRequest(async (req, res) => {
  const path = apiPath(req);

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    if (req.method === 'GET' && path === '/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'ad-archive-api',
        serverTime: new Date().toISOString()
      });
      return;
    }

    if (req.method === 'GET' && path === '/stats') {
      const [ads, profiles] = await Promise.all([collectionCount('ads'), collectionCount('profiles')]);
      sendJson(res, 200, {
        ads,
        profiles,
        serverTime: new Date().toISOString()
      });
      return;
    }

    if (req.method === 'GET' && path === '/me') {
      const user = await requireUser(req);
      const [profileSnapshot, stateSnapshot] = await Promise.all([
        db.collection('profiles').doc(user.uid).get(),
        db.collection('userState').doc(user.uid).get()
      ]);

      sendJson(res, 200, {
        uid: user.uid,
        email: user.email || null,
        profile: profileSnapshot.exists ? profileSnapshot.data() : null,
        userState: stateSnapshot.exists ? stateSnapshot.data() : null
      });
      return;
    }

    if (path === '/html5/extract') {
      await handleHtml5Extraction(req, res);
      return;
    }

    if (req.method === 'GET' && path.startsWith('/html5/')) {
      await handleHtml5Preview(path, res);
      return;
    }

    sendJson(res, 404, {
      error: 'Not found',
      path
    });
  } catch (error) {
    logger.error('API request failed', {
      path,
      method: req.method,
      message: error.message
    });

    sendJson(res, error.status || 500, {
      error: error.status ? error.message : 'Internal server error'
    });
  }
});
