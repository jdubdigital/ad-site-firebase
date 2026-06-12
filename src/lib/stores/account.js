import { writable } from 'svelte/store';
import { isFirebaseConfigured } from '$lib/firebase/client';
import * as firebaseAccount from '$lib/repositories/account.firebase';

export const signedInEmail = writable('');
export const authUser = writable(null);
export const authReady = writable(!isFirebaseConfigured);

export function initializeAccount(onChange = () => {}) {
  if (!isFirebaseConfigured) {
    authReady.set(true);
    return () => {};
  }

  return firebaseAccount.listenToAuth((user) => {
    authUser.set(user);
    signedInEmail.set(user?.email || '');
    authReady.set(true);
    onChange(user);
  });
}

export async function signIn(email, password) {
  if (isFirebaseConfigured) {
    const user = await firebaseAccount.signIn(email, password);
    authUser.set(user);
    signedInEmail.set(user.email || email);
    return user;
  }

  signedInEmail.set(email);
  return { email };
}

export async function createAccount(email, password) {
  if (isFirebaseConfigured) {
    const user = await firebaseAccount.createAccount(email, password);
    authUser.set(user);
    signedInEmail.set(user.email || email);
    return user;
  }

  signedInEmail.set(email);
  return { email };
}

export async function deleteCurrentAccount() {
  if (isFirebaseConfigured) {
    await firebaseAccount.deleteCurrentAccount();
  }

  authUser.set(null);
  signedInEmail.set('');
}

export async function signOut() {
  if (isFirebaseConfigured) {
    await firebaseAccount.signOut();
  }

  authUser.set(null);
  signedInEmail.set('');
}
