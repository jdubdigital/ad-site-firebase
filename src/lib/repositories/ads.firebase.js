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

async function uploadAdAsset(file, onProgress) {
  if (!file) return null;

  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return null;
  const { getDownloadURL, ref, uploadBytes, uploadBytesResumable } = services.storageApi;

  const path = `ads/${user.uid}/${Date.now()}-${safeFileName(file.name)}`;
  const fileRef = ref(services.storage, path);
  const metadata = {
    contentType: file.type || 'application/octet-stream'
  };

  if (uploadBytesResumable) {
    await new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file, metadata);
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
          onProgress?.({ stage: 'upload', progress });
        },
        reject,
        resolve
      );
    });
  } else {
    onProgress?.({ stage: 'upload', progress: 0.15 });
    await uploadBytes(fileRef, file, metadata);
    onProgress?.({ stage: 'upload', progress: 1 });
  }

  return {
    url: await getDownloadURL(fileRef),
    path,
    contentType: file.type || 'application/octet-stream'
  };
}

async function requestHtml5Extraction(adId, onProgress) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error('Sign in before extracting programmatic ZIP previews.');

  onProgress?.({ stage: 'extract', progress: 0.2 });

  const response = await fetch('/api/html5/extract', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ adId })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'The programmatic ZIP could not be extracted.');
  }

  onProgress?.({ stage: 'extract', progress: 1 });
  return body;
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

export async function createSubmittedAd(adValues, file, options = {}) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) throw new Error('Sign in before submitting ads.');
  const { addDoc, collection, deleteDoc, serverTimestamp } = services.firestoreApi;

  options.onProgress?.({ stage: 'prepare', progress: 0.2 });
  const uploadedAsset = await uploadAdAsset(file, options.onProgress);
  options.onProgress?.({ stage: 'save', progress: 0.35 });

  const ad = {
    ...adValues,
    mediaUrl: uploadedAsset?.url || adValues.mediaUrl || '',
    mediaStoragePath: uploadedAsset?.path || adValues.mediaStoragePath || '',
    mediaContentType: uploadedAsset?.contentType || adValues.mediaContentType || '',
    mediaFileName: file?.name || adValues.mediaFileName || '',
    likes: 0,
    ownerUid: user.uid,
    source: 'firebase',
    createdAt: serverTimestamp(),
    submittedAt: new Date().toISOString()
  };

  const docRef = await addDoc(collection(services.db, 'ads'), ad);
  options.onProgress?.({ stage: 'save', progress: 1 });
  let previewFields = {};

  if (ad.type === 'html5' && ad.mediaStoragePath) {
    try {
      previewFields = await requestHtml5Extraction(docRef.id, options.onProgress);
    } catch (error) {
      await deleteDoc(docRef).catch(() => {});
      throw error;
    }
  }

  return {
    ...ad,
    ...previewFields,
    id: docRef.id,
    liked: false
  };
}

export async function persistEditedAd(ad, file, options = {}) {
  const services = await getFirebaseServices();
  if (!services) return;
  const { doc, serverTimestamp, updateDoc } = services.firestoreApi;

  options.onProgress?.({ stage: 'prepare', progress: 0.2 });
  const uploadedAsset = await uploadAdAsset(file, options.onProgress);
  options.onProgress?.({ stage: 'save', progress: 0.35 });

  const updates = {
    ...ad,
    mediaUrl: uploadedAsset?.url || ad.mediaUrl || '',
    mediaStoragePath: uploadedAsset?.path || ad.mediaStoragePath || '',
    mediaContentType: uploadedAsset?.contentType || ad.mediaContentType || '',
    mediaFileName: file?.name || ad.mediaFileName || '',
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(services.db, 'ads', String(ad.id)), updates);
  options.onProgress?.({ stage: 'save', progress: 1 });

  if (updates.type === 'html5' && uploadedAsset?.path) {
    const previewFields = await requestHtml5Extraction(String(ad.id), options.onProgress);
    return {
      ...updates,
      ...previewFields
    };
  }

  return updates;
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
