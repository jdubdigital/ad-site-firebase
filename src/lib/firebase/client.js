import { browser } from '$app/environment';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_APP_ID,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET
} from '$env/static/public';

const firebaseConfig = {
  apiKey: PUBLIC_FIREBASE_API_KEY,
  authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: PUBLIC_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId
);

let servicesPromise;

export async function getFirebaseServices() {
  if (!browser || !isFirebaseConfigured) return null;
  if (servicesPromise) return servicesPromise;

  servicesPromise = Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
    import('firebase/storage')
  ]).then(([appApi, authApi, firestoreApi, storageApi]) => {
    const app = appApi.getApps().length ? appApi.getApps()[0] : appApi.initializeApp(firebaseConfig);
    const auth = authApi.getAuth(app);
    authApi.setPersistence(auth, authApi.browserLocalPersistence).catch(() => {});

    return {
      app,
      auth,
      db: firestoreApi.getFirestore(app),
      storage: storageApi.getStorage(app),
      authApi,
      firestoreApi,
      storageApi
    };
  });

  return servicesPromise;
}

export async function getCurrentFirebaseUser() {
  return (await getFirebaseServices())?.auth.currentUser || null;
}
