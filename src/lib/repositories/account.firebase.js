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

export async function deleteCurrentAccount() {
  const services = await getFirebaseServices();
  const user = services?.auth.currentUser;
  if (!services || !user) return;

  await services.authApi.deleteUser(user);
}

export async function wipeCurrentAccount() {
  const services = await getFirebaseServices();
  const user = services?.auth.currentUser;
  if (!services || !user) throw new Error('Sign in before deleting your account.');

  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      'content-type': 'application/json'
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Unable to delete this account.');
  }

  await services.authApi.signOut(services.auth).catch(() => {});
  return body;
}

export async function signOut() {
  const services = await getFirebaseServices();
  if (!services) return;
  await services.authApi.signOut(services.auth);
}
