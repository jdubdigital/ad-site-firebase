import { getFirebaseServices } from '$lib/firebase/client';

export function listenToAuth(callback) {
  let unsubscribe = () => {};

  getFirebaseServices()
    .then((services) => {
      if (!services) {
        callback(null);
        return;
      }
      unsubscribe = services.authApi.onAuthStateChanged(services.auth, callback);
    })
    .catch(() => callback(null));

  return () => unsubscribe();
}

export async function signIn(email, password) {
  const services = await getFirebaseServices();
  if (!services) throw new Error('Firebase is not configured.');

  const credential = await services.authApi.signInWithEmailAndPassword(services.auth, email, password);
  return credential.user;
}

export async function createAccount(email, password) {
  const services = await getFirebaseServices();
  if (!services) throw new Error('Firebase is not configured.');

  const credential = await services.authApi.createUserWithEmailAndPassword(services.auth, email, password);
  return credential.user;
}

export async function signOut() {
  const services = await getFirebaseServices();
  if (!services) return;
  await services.authApi.signOut(services.auth);
}
