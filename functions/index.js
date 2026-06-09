const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10
});

if (!getApps().length) initializeApp();

const auth = getAuth();
const db = getFirestore();

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
