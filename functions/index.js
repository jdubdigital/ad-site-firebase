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
  'bin',
  'gif',
  'glb',
  'gltf',
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
  bin: 'application/octet-stream',
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json; charset=utf-8',
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

function pathMatchesSize(path, size) {
  if (!size) return false;
  const normalizedSize = String(size).toLowerCase().replace(/\s+/g, '');
  const normalizedPath = String(path || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const [width, height] = normalizedSize.split('x');

  return (
    normalizedPath.includes(normalizedSize) ||
    (width && height && new RegExp(`(^|\\D)${width}\\D+${height}(\\D|$)`).test(normalizedPath))
  );
}

function selectEntryPath(paths, preferredSize = '') {
  const htmlPaths = paths.filter((path) => ['html', 'htm'].includes(extensionForPath(path)));
  if (!htmlPaths.length) return '';

  const matchingSizePaths = preferredSize ? htmlPaths.filter((path) => pathMatchesSize(path, preferredSize)) : [];
  if (matchingSizePaths.length) {
    return (
      matchingSizePaths.find((path) => path.toLowerCase().endsWith('/index.html')) ||
      matchingSizePaths.find((path) => path.toLowerCase().endsWith('/index.htm')) ||
      matchingSizePaths[0]
    );
  }

  return (
    htmlPaths.find((path) => path.toLowerCase() === 'index.html') ||
    htmlPaths.find((path) => path.toLowerCase() === 'index.htm') ||
    htmlPaths.find((path) => path.toLowerCase().endsWith('/index.html')) ||
    htmlPaths.find((path) => path.toLowerCase().endsWith('/index.htm')) ||
    htmlPaths[0]
  );
}

async function extractHtml5Archive(adId, storagePath, preferredSize = '') {
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

  const entryPath = selectEntryPath(files.map((file) => file.path), preferredSize);
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
    htmlPreviewStatus: 'ready',
    htmlPreviewPreferredSize: preferredSize || null
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
    const previewFields = await extractHtml5Archive(adId, ad.mediaStoragePath || '', ad.size || '');
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

async function deleteDocsInQuery(querySnapshot) {
  if (querySnapshot.empty) return;

  const docs = querySnapshot.docs.slice();
  while (docs.length) {
    const batch = db.batch();
    docs.splice(0, 400).forEach((docSnapshot) => batch.delete(docSnapshot.ref));
    await batch.commit();
  }
}

async function deleteFilesByPrefix(prefix) {
  if (!prefix) return;

  try {
    await bucket.deleteFiles({ prefix, force: true });
  } catch (error) {
    logger.warn('Storage prefix delete skipped', { prefix, message: error.message });
  }
}

async function handleAccountDeletion(req, res) {
  if (req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const user = await requireUser(req);
  const profileRef = db.collection('profiles').doc(user.uid);
  const userStateRef = db.collection('userState').doc(user.uid);
  const [profileSnapshot, userAdsSnapshot, usernamesSnapshot, displayNamesSnapshot] = await Promise.all([
    profileRef.get(),
    db.collection('ads').where('ownerUid', '==', user.uid).get(),
    db.collection('usernames').where('ownerUid', '==', user.uid).get(),
    db.collection('displayNames').where('ownerUid', '==', user.uid).get()
  ]);

  const html5PreviewPrefixes = [
    ...new Set(
      userAdsSnapshot.docs
        .map((docSnapshot) => docSnapshot.data()?.htmlPreviewBasePath || `html5Previews/${docSnapshot.id}`)
        .filter(Boolean)
    )
  ];

  await Promise.all([
    deleteFilesByPrefix(`ads/${user.uid}/`),
    deleteFilesByPrefix(`avatars/${user.uid}/`),
    ...html5PreviewPrefixes.map((prefix) => deleteFilesByPrefix(`${prefix}/`))
  ]);

  await Promise.all([
    deleteDocsInQuery(userAdsSnapshot),
    deleteDocsInQuery(usernamesSnapshot),
    deleteDocsInQuery(displayNamesSnapshot),
    profileSnapshot.exists ? profileRef.delete() : Promise.resolve(),
    userStateRef.delete().catch(() => {})
  ]);

  await auth.deleteUser(user.uid);

  sendJson(res, 200, {
    ok: true,
    deletedAds: userAdsSnapshot.size,
    deletedAt: new Date().toISOString()
  });
}

function previewContentHeaders(contentType) {
  const headers = {
    'cache-control': contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'content-security-policy':
      "default-src https: data: blob:; script-src https: 'unsafe-inline' data: blob:; style-src https: 'unsafe-inline'; img-src https: data: blob:; font-src https: data:; media-src https: data: blob:; connect-src https: data: blob:; worker-src https: blob:; model-src https: data: blob:; frame-ancestors 'self'",
    'access-control-allow-origin': '*',
    'cross-origin-resource-policy': 'cross-origin',
    'x-content-type-options': 'nosniff'
  };

  if (contentType) headers['content-type'] = contentType;
  return headers;
}

function html5PreviewBootstrap() {
  return `<script>
(function () {
  var RUNTIME_UPDATE = 'AD_ARCHIVE_RUNTIME_UPDATE';
  var RUNTIME_LOG = 'AD_ARCHIVE_RUNTIME_LOG';
  var RUNTIME_READY = 'AD_ARCHIVE_RUNTIME_READY';
  var listeners = {};
  var mraidListeners = {};
  var safeFrameListeners = [];
  var runtimeState = {};
  var mraidState = 'default';
  var mraidViewable = false;
  var windowScrollAccessorsInstalled = false;
  var documentScrollAccessorsInstalled = false;
  var bodyScrollAccessorsInstalled = false;
  var lastViewportWidth = 0;
  var lastViewportHeight = 0;

  function serialize(value, depth) {
    if (depth > 2) return '[Object]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return value.slice(0, 8).map(function (item) {
        return serialize(item, depth + 1);
      });
    }
    if (typeof value === 'function') return '[Function]';
    if (value && value.nodeType) return '[Element]';

    var output = {};
    Object.keys(value)
      .slice(0, 12)
      .forEach(function (key) {
        output[key] = serialize(value[key], depth + 1);
      });
    return output;
  }

  function argsList(args) {
    return Array.prototype.slice.call(args || []).map(function (item) {
      return serialize(item, 0);
    });
  }

  function post(type, body) {
    try {
      window.parent.postMessage(
        Object.assign(
          {
            type: type,
            timestamp: Date.now()
          },
          body || {}
        ),
        '*'
      );
    } catch (error) {}
  }

  function log(api, method, args, message) {
    post(RUNTIME_LOG, {
      level: 'info',
      api: api,
      method: method,
      args: argsList(args),
      message: message || ''
    });
  }

  function event(name) {
    return name;
  }

  function emit(name, detail) {
    var callbacks = listeners[name] || [];
    var customEvent;
    try {
      customEvent = new CustomEvent(name, { bubbles: true, cancelable: true, detail: detail || {} });
    } catch (error) {
      customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent(name, true, true, detail || {});
    }
    if (detail && typeof detail === 'object') {
      Object.keys(detail).forEach(function (key) {
        try {
          customEvent[key] = detail[key];
        } catch (error) {}
      });
    }
    callbacks.slice().forEach(function (callback) {
      try {
        callback(customEvent);
      } catch (error) {
        setTimeout(function () {
          throw error;
        });
      }
    });
  }

  function emitMraid(name) {
    var callbacks = mraidListeners[name] || [];
    var args = Array.prototype.slice.call(arguments, 1);
    callbacks.slice().forEach(function (callback) {
      try {
        callback.apply(null, args);
      } catch (error) {
        setTimeout(function () {
          throw error;
        });
      }
    });
  }

  function currentPosition() {
    return {
      x: Math.round(runtimeState.adLeft || 0),
      y: Math.round(runtimeState.adTop || 0),
      width: Math.round(runtimeState.adWidth || window.innerWidth || 0),
      height: Math.round(runtimeState.adHeight || window.innerHeight || 0)
    };
  }

  function pagePosition() {
    return {
      x: Math.round(runtimeState.adPageLeft || runtimeState.adLeft || 0),
      y: Math.round(runtimeState.adPageTop || runtimeState.adTop || 0),
      left: Math.round(runtimeState.adPageLeft || runtimeState.adLeft || 0),
      top: Math.round(runtimeState.adPageTop || runtimeState.adTop || 0)
    };
  }

  function viewportDimensions() {
    return {
      width: Math.round(runtimeState.viewportWidth || window.innerWidth || 0),
      height: Math.round(runtimeState.viewportHeight || window.innerHeight || 0)
    };
  }

  function safeFrameGeometry() {
    var viewport = viewportDimensions();
    var position = currentPosition();
    var visiblePercent = Math.round(runtimeState.visiblePercent || 0);
    return {
      win: {
        t: 0,
        l: 0,
        b: viewport.height,
        r: viewport.width,
        w: viewport.width,
        h: viewport.height
      },
      self: {
        t: Math.round(runtimeState.adTop || 0),
        l: Math.round(runtimeState.adLeft || 0),
        b: Math.round(runtimeState.adBottom || 0),
        r: Math.round(runtimeState.adRight || 0),
        x: position.x,
        y: position.y,
        w: position.width,
        h: position.height,
        iv: visiblePercent
      },
      exp: {
        t: 0,
        l: 0,
        b: 0,
        r: 0,
        xs: false,
        yx: false
      },
      meta: {
        scrollX: Math.round(runtimeState.scrollX || 0),
        scrollY: Math.round(runtimeState.scrollY || 0),
        visiblePercent: visiblePercent,
        creativeScale: runtimeState.creativeScale || 1
      }
    };
  }

  function runtimeDetail() {
    return Object.assign({}, runtimeState, {
      scrollTop: Math.round(runtimeState.scrollY || 0),
      scrollLeft: Math.round(runtimeState.scrollX || 0),
      windowWidth: Math.round(runtimeState.windowWidth || runtimeState.viewportWidth || window.innerWidth || 0),
      windowHeight: Math.round(runtimeState.windowHeight || runtimeState.viewportHeight || window.innerHeight || 0),
      creativeFramePercentY: Math.max(0, Math.min(1, Number(runtimeState.creativeFramePercentY) || 0)),
      creativeFramePercentX: Math.max(0, Math.min(1, Number(runtimeState.creativeFramePercentX) || 0)),
      pageOffset: {
        x: Math.round(runtimeState.scrollX || 0),
        y: Math.round(runtimeState.scrollY || 0)
      },
      viewport: viewportDimensions(),
      position: currentPosition(),
      pagePosition: pagePosition(),
      geometry: safeFrameGeometry()
    });
  }

  function installScrollAccessors() {
    function defineGetter(target, name, getter) {
      try {
        Object.defineProperty(target, name, {
          configurable: true,
          get: getter
        });
      } catch (error) {}
    }

    if (!windowScrollAccessorsInstalled) {
      windowScrollAccessorsInstalled = true;
      defineGetter(window, 'pageYOffset', function () {
        return runtimeState.scrollY || 0;
      });
      defineGetter(window, 'scrollY', function () {
        return runtimeState.scrollY || 0;
      });
      defineGetter(window, 'pageXOffset', function () {
        return runtimeState.scrollX || 0;
      });
      defineGetter(window, 'scrollX', function () {
        return runtimeState.scrollX || 0;
      });
    }
    if (document.documentElement && !documentScrollAccessorsInstalled) {
      documentScrollAccessorsInstalled = true;
      defineGetter(document.documentElement, 'scrollTop', function () {
        return runtimeState.scrollY || 0;
      });
      defineGetter(document.documentElement, 'scrollLeft', function () {
        return runtimeState.scrollX || 0;
      });
    }
    if (document.body && !bodyScrollAccessorsInstalled) {
      bodyScrollAccessorsInstalled = true;
      defineGetter(document.body, 'scrollTop', function () {
        return runtimeState.scrollY || 0;
      });
      defineGetter(document.body, 'scrollLeft', function () {
        return runtimeState.scrollX || 0;
      });
    }
  }

  function dispatchBrowserEvent(target, name, detail) {
    try {
      target.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail: detail || {} }));
      return;
    } catch (error) {}
    try {
      var customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent(name, true, true, detail || {});
      target.dispatchEvent(customEvent);
    } catch (error) {}
  }

  function dispatchHostScrollSignals() {
    var detail = runtimeDetail();

    emit(window.studio.events.StudioEvent.HOSTPAGE_SCROLL, detail);
    emit('hostpagescroll', detail);
    dispatchBrowserEvent(document, 'hostpagescroll', detail);
    dispatchBrowserEvent(window, 'hostpagescroll', detail);
    dispatchBrowserEvent(window, 'adArchiveHostScroll', detail);

    try {
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
    } catch (error) {}

    safeFrameListeners.slice().forEach(function (callback) {
      try {
        callback(safeFrameGeometry());
      } catch (error) {
        setTimeout(function () {
          throw error;
        });
      }
    });
  }

  function dispatchViewportSignalIfNeeded() {
    var viewport = viewportDimensions();
    if (viewport.width === lastViewportWidth && viewport.height === lastViewportHeight) return;
    lastViewportWidth = viewport.width;
    lastViewportHeight = viewport.height;
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (error) {}
  }

  window.__AD_ARCHIVE_RUNTIME = window.__AD_ARCHIVE_RUNTIME || runtimeState;
  installScrollAccessors();
  window.addEventListener('message', function (event) {
    var data = event.data || {};
    if (data.type !== RUNTIME_UPDATE) return;

    runtimeState = Object.assign({}, data);
    window.__AD_ARCHIVE_RUNTIME = runtimeState;
    installScrollAccessors();

    try {
      window.dispatchEvent(new CustomEvent('adArchiveRuntimeUpdate', { detail: runtimeState }));
    } catch (error) {
      var customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent('adArchiveRuntimeUpdate', false, false, runtimeState);
      window.dispatchEvent(customEvent);
    }

    if (runtimeState.isVisible) {
      emit(window.studio.events.StudioEvent.VISIBLE, runtimeState);
    }
    dispatchHostScrollSignals();
    dispatchViewportSignalIfNeeded();

    var nextViewable = Boolean(runtimeState.visiblePercent >= 50);
    if (nextViewable !== mraidViewable) {
      mraidViewable = nextViewable;
      emitMraid('viewableChange', mraidViewable);
    }
    emitMraid('exposureChange', runtimeState.visiblePercent || 0, currentPosition(), []);
  });

  window.studio = window.studio || {};
  window.studio.events = window.studio.events || {};
  window.studio.events.StudioEvent = window.studio.events.StudioEvent || {
    INIT: event('init'),
    VISIBLE: event('visible'),
    PAGE_LOADED: event('pageLoaded'),
    EXPAND_START: event('expandstart'),
    EXPAND_FINISH: event('expandfinish'),
    COLLAPSE_START: event('collapsestart'),
    COLLAPSE_FINISH: event('collapsefinish'),
    FULLSCREEN_EXPAND_START: event('fullscreenexpandstart'),
    FULLSCREEN_EXPAND_FINISH: event('fullscreenexpandfinish'),
    FULLSCREEN_COLLAPSE_START: event('fullscreencollapsestart'),
    FULLSCREEN_COLLAPSE_FINISH: event('fullscreencollapsefinish'),
    FULLSCREEN_DIMENSIONS: event('fullscreendimensions'),
    FULLSCREEN_SUPPORT: event('fullscreensupport'),
    HOSTPAGE_SCROLL: event('hostpagescroll'),
    HOST_PAGE_SCROLL: event('hostpagescroll'),
    PAGE_SCROLL: event('hostpagescroll')
  };
  window.studio.module = window.studio.module || { ModuleId: { GDN: 'gdn' } };
  window.studio.sdk = window.studio.sdk || {};
  window.studio.sdk.gdn = window.studio.sdk.gdn || {
    getConfig: function () {
      return {
        isInCreativeToolsetContext: function () {
          return false;
        },
        isInterstitial: function (callback) {
          callback(false);
        }
      };
    }
  };
  window.studio.video = window.studio.video || { Reporter: { attach: function () {}, detach: function () {} } };

  var Enabler = window.Enabler || {
    addEventListener: function (name, callback) {
      log('Enabler', 'addEventListener', arguments);
      listeners[name] = listeners[name] || [];
      listeners[name].push(callback);
      if (name === window.studio.events.StudioEvent.INIT || name === window.studio.events.StudioEvent.VISIBLE || name === window.studio.events.StudioEvent.PAGE_LOADED) {
        setTimeout(function () {
          emit(name);
        }, 0);
      }
    },
    removeEventListener: function (name, callback) {
      log('Enabler', 'removeEventListener', arguments);
      listeners[name] = (listeners[name] || []).filter(function (item) {
        return item !== callback;
      });
    },
    isInitialized: function () {
      log('Enabler', 'isInitialized', arguments);
      return true;
    },
    isVisible: function () {
      log('Enabler', 'isVisible', arguments);
      return runtimeState.isVisible !== false;
    },
    isPageLoaded: function () {
      log('Enabler', 'isPageLoaded', arguments);
      return true;
    },
    isServingInLiveEnvironment: function () {
      log('Enabler', 'isServingInLiveEnvironment', arguments);
      return false;
    },
    loadModule: function (_moduleId, callback) {
      log('Enabler', 'loadModule', arguments);
      if (callback) setTimeout(callback, 0);
    },
    queryFullscreenSupport: function () {
      log('Enabler', 'queryFullscreenSupport', arguments);
      setTimeout(function () {
        emit(window.studio.events.StudioEvent.FULLSCREEN_SUPPORT, { supported: false });
      }, 0);
    },
    getPageOffset: function (callback) {
      log('Enabler', 'getPageOffset', arguments);
      var offset = pagePosition();
      if (typeof callback === 'function') setTimeout(function () { callback(offset.x, offset.y); }, 0);
      return offset;
    },
    getHostPageOffset: function (callback) {
      log('Enabler', 'getHostPageOffset', arguments);
      var offset = pagePosition();
      if (typeof callback === 'function') setTimeout(function () { callback(offset.x, offset.y); }, 0);
      return offset;
    },
    getViewportDimensions: function (callback) {
      log('Enabler', 'getViewportDimensions', arguments);
      var viewport = viewportDimensions();
      if (typeof callback === 'function') setTimeout(function () { callback(viewport.width, viewport.height); }, 0);
      return viewport;
    },
    getContainerDimensions: function (callback) {
      log('Enabler', 'getContainerDimensions', arguments);
      var position = currentPosition();
      var dimensions = { width: position.width, height: position.height };
      if (typeof callback === 'function') setTimeout(function () { callback(dimensions.width, dimensions.height); }, 0);
      return dimensions;
    },
    getVisibleGeometry: function (callback) {
      log('Enabler', 'getVisibleGeometry', arguments);
      var geometry = safeFrameGeometry();
      if (typeof callback === 'function') setTimeout(function () { callback(geometry); }, 0);
      return geometry;
    },
    exit: function () {
      log('Enabler', 'exit', arguments, 'Exit captured; no navigation performed.');
    },
    exitOverride: function () {
      log('Enabler', 'exitOverride', arguments, 'Exit captured; no navigation performed.');
    },
    dynamicExit: function () {
      log('Enabler', 'dynamicExit', arguments, 'Exit captured; no navigation performed.');
    },
    counter: function () {
      log('Enabler', 'counter', arguments);
    },
    startTimer: function () {
      log('Enabler', 'startTimer', arguments);
    },
    stopTimer: function () {
      log('Enabler', 'stopTimer', arguments);
    },
    reportManualClose: function () {
      log('Enabler', 'reportManualClose', arguments);
    },
    requestExpand: function () {
      log('Enabler', 'requestExpand', arguments);
      emit(window.studio.events.StudioEvent.EXPAND_START);
      emit(window.studio.events.StudioEvent.EXPAND_FINISH);
    },
    finishExpand: function () {
      log('Enabler', 'finishExpand', arguments);
    },
    requestCollapse: function () {
      log('Enabler', 'requestCollapse', arguments);
      emit(window.studio.events.StudioEvent.COLLAPSE_START);
      emit(window.studio.events.StudioEvent.COLLAPSE_FINISH);
    },
    finishCollapse: function () {
      log('Enabler', 'finishCollapse', arguments);
    },
    requestFullscreenExpand: function () {
      log('Enabler', 'requestFullscreenExpand', arguments);
      emit(window.studio.events.StudioEvent.FULLSCREEN_EXPAND_START);
      emit(window.studio.events.StudioEvent.FULLSCREEN_EXPAND_FINISH);
    },
    finishFullscreenExpand: function () {
      log('Enabler', 'finishFullscreenExpand', arguments);
    },
    requestFullscreenCollapse: function () {
      log('Enabler', 'requestFullscreenCollapse', arguments);
      emit(window.studio.events.StudioEvent.FULLSCREEN_COLLAPSE_START);
      emit(window.studio.events.StudioEvent.FULLSCREEN_COLLAPSE_FINISH);
    },
    finishFullscreenCollapse: function () {
      log('Enabler', 'finishFullscreenCollapse', arguments);
    },
    setResponsiveExpanding: function () {
      log('Enabler', 'setResponsiveExpanding', arguments);
    },
    setResponsiveSize: function () {
      log('Enabler', 'setResponsiveSize', arguments);
    },
    setRushSimulatedLocalEvents: function () {
      log('Enabler', 'setRushSimulatedLocalEvents', arguments);
    }
  };

  window.Enabler = window.Enabler || Enabler;
  window.studio.Enabler = window.studio.Enabler || window.Enabler;
  window.clickTag = window.clickTag || '#ad-archive-clicktag';

  var nativeOpen = window.open;
  window.open = function () {
    log('window', 'open', arguments, 'Popup blocked in Ad Archive preview.');
    return null;
  };
  window.open.__adArchiveNativeOpen = nativeOpen;

  window.dataLayer = window.dataLayer || [];
  if (!window.dataLayer.__adArchiveWrapped) {
    var nativeDataLayerPush = window.dataLayer.push;
    window.dataLayer.push = function () {
      log('dataLayer', 'push', arguments);
      return nativeDataLayerPush.apply(window.dataLayer, arguments);
    };
    window.dataLayer.__adArchiveWrapped = true;
  }
  window.google_tag_manager = window.google_tag_manager || {};

  window.mraid = window.mraid || {
    getState: function () {
      log('mraid', 'getState', arguments);
      return mraidState;
    },
    isViewable: function () {
      log('mraid', 'isViewable', arguments);
      return mraidViewable;
    },
    getVersion: function () {
      log('mraid', 'getVersion', arguments);
      return '3.0';
    },
    getPlacementType: function () {
      log('mraid', 'getPlacementType', arguments);
      return 'inline';
    },
    getMaxSize: function () {
      log('mraid', 'getMaxSize', arguments);
      return {
        width: runtimeState.viewportWidth || window.innerWidth || 0,
        height: runtimeState.viewportHeight || window.innerHeight || 0
      };
    },
    getScreenSize: function () {
      log('mraid', 'getScreenSize', arguments);
      return {
        width: runtimeState.viewportWidth || window.innerWidth || 0,
        height: runtimeState.viewportHeight || window.innerHeight || 0
      };
    },
    getSize: function () {
      log('mraid', 'getSize', arguments);
      return {
        width: runtimeState.creativeWidth || runtimeState.adWidth || window.innerWidth || 0,
        height: runtimeState.creativeHeight || runtimeState.adHeight || window.innerHeight || 0
      };
    },
    getCurrentPosition: function () {
      log('mraid', 'getCurrentPosition', arguments);
      return currentPosition();
    },
    getDefaultPosition: function () {
      log('mraid', 'getDefaultPosition', arguments);
      return currentPosition();
    },
    addEventListener: function (name, callback) {
      log('mraid', 'addEventListener', arguments);
      mraidListeners[name] = mraidListeners[name] || [];
      mraidListeners[name].push(callback);
      if (name === 'ready') setTimeout(callback, 0);
    },
    removeEventListener: function (name, callback) {
      log('mraid', 'removeEventListener', arguments);
      mraidListeners[name] = (mraidListeners[name] || []).filter(function (item) {
        return item !== callback;
      });
    },
    open: function () {
      log('mraid', 'open', arguments, 'Open captured; no popup or navigation performed.');
    },
    expand: function () {
      log('mraid', 'expand', arguments);
      mraidState = 'expanded';
      emitMraid('stateChange', mraidState);
    },
    close: function () {
      log('mraid', 'close', arguments);
      mraidState = 'default';
      emitMraid('stateChange', mraidState);
    },
    resize: function () {
      log('mraid', 'resize', arguments);
    },
    supports: function (feature) {
      log('mraid', 'supports', arguments);
      return ['sms', 'tel', 'calendar', 'storePicture', 'inlineVideo'].indexOf(feature) !== -1;
    },
    useCustomClose: function () {
      log('mraid', 'useCustomClose', arguments);
    },
    setResizeProperties: function () {
      log('mraid', 'setResizeProperties', arguments);
    },
    getResizeProperties: function () {
      log('mraid', 'getResizeProperties', arguments);
      return {
        width: runtimeState.creativeWidth || runtimeState.adWidth || 0,
        height: runtimeState.creativeHeight || runtimeState.adHeight || 0,
        offsetX: 0,
        offsetY: 0,
        customClosePosition: 'top-right',
        allowOffscreen: false
      };
    }
  };

  window.$sf = window.$sf || {
    ext: {
      geom: function () {
        log('$sf.ext', 'geom', arguments);
        return safeFrameGeometry();
      },
      inViewPercentage: function () {
        log('$sf.ext', 'inViewPercentage', arguments);
        return Math.round(runtimeState.visiblePercent || 0);
      },
      expand: function () {
        log('$sf.ext', 'expand', arguments);
      },
      collapse: function () {
        log('$sf.ext', 'collapse', arguments);
      },
      register: function () {
        log('$sf.ext', 'register', arguments);
        var callback = Array.prototype.slice.call(arguments).find(function (item) {
          return typeof item === 'function';
        });
        if (callback && safeFrameListeners.indexOf(callback) === -1) safeFrameListeners.push(callback);
        if (callback) setTimeout(function () {
          callback(safeFrameGeometry());
        }, 0);
      },
      unregister: function () {
        log('$sf.ext', 'unregister', arguments);
        safeFrameListeners = [];
      },
      status: function () {
        log('$sf.ext', 'status', arguments);
        return 'expanded';
      }
    },
    env: {
      isMobile: false
    }
  };

  function wakeCreative() {
    installScrollAccessors();
    if (document.body) document.body.style.opacity = '';
    window.dispatchEvent(new Event('WebComponentsReady'));
    window.dispatchEvent(new Event('adinitialized'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(wakeCreative, 0);
    });
  } else {
    setTimeout(wakeCreative, 0);
  }
  setTimeout(wakeCreative, 80);
  post(RUNTIME_READY, {
    apis: {
      clickTag: Boolean(window.clickTag),
      Enabler: Boolean(window.Enabler),
      mraid: Boolean(window.mraid),
      safeFrame: Boolean(window.$sf),
      dataLayer: Boolean(window.dataLayer)
    }
  });
})();
</script>`;
}

function prepareHtmlPreview(buffer, contentType) {
  if (!contentType.startsWith('text/html')) return buffer;

  const html = buffer.toString('utf8');
  const bootstrap = html5PreviewBootstrap();
  if (html.includes('data-ad-archive-html5-preview-shim')) return buffer;

  const script = bootstrap.replace('<script>', '<script data-ad-archive-html5-preview-shim>');
  if (/<head[^>]*>/i.test(html)) return Buffer.from(html.replace(/<head[^>]*>/i, (match) => `${match}${script}`));
  return Buffer.from(`${script}${html}`);
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

  res.status(200).set(previewContentHeaders(contentType)).send(prepareHtmlPreview(buffer, contentType));
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

    if (path === '/account') {
      await handleAccountDeletion(req, res);
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
