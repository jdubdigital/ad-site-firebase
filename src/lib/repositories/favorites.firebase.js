import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';

async function stateRef() {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return null;
  return {
    services,
    ref: services.firestoreApi.doc(services.db, 'userState', user.uid)
  };
}

export async function getFavoriteUsers() {
  const state = await stateRef();
  if (!state) return null;

  const snapshot = await state.services.firestoreApi.getDoc(state.ref);
  return snapshot.exists() ? snapshot.data().favoriteUsers || [] : [];
}

export async function setFavoriteUsers(slugs) {
  const state = await stateRef();
  if (!state) return;
  const { serverTimestamp, setDoc } = state.services.firestoreApi;

  await setDoc(
    state.ref,
    {
      favoriteUsers: slugs,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
