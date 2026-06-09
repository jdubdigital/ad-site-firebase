import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';
import { safeFileName } from '$lib/utils/slug';

async function stateRef() {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return null;
  return {
    services,
    ref: services.firestoreApi.doc(services.db, 'userState', user.uid)
  };
}

async function uploadAdAsset(file) {
  if (!file) return '';

  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return '';
  const { getDownloadURL, ref, uploadBytes } = services.storageApi;

  const fileRef = ref(services.storage, `ads/${user.uid}/${Date.now()}-${safeFileName(file.name)}`);
  await uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream'
  });
  return getDownloadURL(fileRef);
}

function normalizeRemoteAd(id, data, likedIds) {
  return {
    id,
    ...data,
    source: 'firebase',
    liked: likedIds.includes(id),
    submittedAt: data.submittedAt || data.createdAt?.toDate?.().toISOString?.() || new Date().toISOString()
  };
}

export async function getLikedAdIds() {
  const state = await stateRef();
  if (!state) return null;

  const snapshot = await state.services.firestoreApi.getDoc(state.ref);
  return snapshot.exists() ? snapshot.data().likedAdIds || [] : [];
}

export async function setLikedAdIds(ids) {
  const state = await stateRef();
  if (!state) return;
  const { serverTimestamp, setDoc } = state.services.firestoreApi;

  await setDoc(
    state.ref,
    {
      likedAdIds: ids,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function loadAds(likedIdsOverride = null) {
  const services = await getFirebaseServices();
  if (!services) return null;
  const { collection, getDocs, orderBy, query } = services.firestoreApi;

  const likedIds = likedIdsOverride || (await getLikedAdIds()) || [];
  const snapshot = await getDocs(query(collection(services.db, 'ads'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map((adDoc) => normalizeRemoteAd(adDoc.id, adDoc.data(), likedIds));
}

export async function createSubmittedAd(adValues, file) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) throw new Error('Sign in before submitting ads.');
  const { addDoc, collection, serverTimestamp } = services.firestoreApi;

  const uploadedUrl = await uploadAdAsset(file);
  const ad = {
    ...adValues,
    mediaUrl: uploadedUrl || adValues.mediaUrl || '',
    mediaFileName: file?.name || adValues.mediaFileName || '',
    likes: 0,
    ownerUid: user.uid,
    source: 'firebase',
    createdAt: serverTimestamp(),
    submittedAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(services.db, 'ads'), ad);
  return {
    ...ad,
    id: docRef.id,
    liked: false
  };
}

export async function persistEditedAd(ad, file) {
  const services = await getFirebaseServices();
  if (!services) return;
  const { doc, serverTimestamp, updateDoc } = services.firestoreApi;

  const uploadedUrl = await uploadAdAsset(file);
  const updates = {
    ...ad,
    mediaUrl: uploadedUrl || ad.mediaUrl || '',
    mediaFileName: file?.name || ad.mediaFileName || '',
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(services.db, 'ads', String(ad.id)), updates);
}

export async function persistDeletedAd(ad) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) throw new Error('Sign in before deleting posts.');
  const { deleteDoc, doc } = services.firestoreApi;

  await deleteDoc(doc(services.db, 'ads', String(ad.id)));
}

export async function persistAdLike(adId, liked) {
  const services = await getFirebaseServices();
  if (!services || typeof adId !== 'string') return;
  const { doc, increment, serverTimestamp, updateDoc } = services.firestoreApi;

  await updateDoc(doc(services.db, 'ads', adId), {
    likes: increment(liked ? 1 : -1),
    updatedAt: serverTimestamp()
  });
}
