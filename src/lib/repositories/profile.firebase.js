import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';
import { defaultDashboardProfile, users } from '$lib/data/catalog';
import { cleanDisplayName, createSlug, createUsernameSlug } from '$lib/utils/slug';

const demoProfileSlug = 'mohegan-sun';

function isStaticUserSlug(slug) {
  return users.some((user) => user.slug === slug);
}

function cleanProfileDoc(data, uid, email, recoveredName = '') {
  const { email: _privateEmail, ...publicData } = data || {};
  const emailSlug = createSlug(email?.split('@')[0], uid);
  const userSlug = createUsernameSlug(
    !publicData.userSlug || publicData.userSlug === demoProfileSlug ? emailSlug : publicData.userSlug,
    emailSlug
  );
  const username = createUsernameSlug(publicData.username || userSlug, userSlug);
  const storedName = cleanDisplayName(publicData.name, '');
  const nameWasForcedToUsername = !storedName || storedName === username || storedName === userSlug;
  const publicName = cleanDisplayName(
    nameWasForcedToUsername ? recoveredName || storedName : storedName,
    username || userSlug || defaultDashboardProfile.name
  );

  return {
    ...defaultDashboardProfile,
    ...publicData,
    name: publicName,
    username,
    userSlug
  };
}

function cleanProfileForSave(profile, user) {
  const { email: _privateEmail, ...publicProfile } = profile || {};
  const fallbackSlug = createUsernameSlug(user.email?.split('@')[0], user.uid);
  const userSlug = createUsernameSlug(publicProfile.userSlug || publicProfile.username || fallbackSlug, fallbackSlug);
  const name = cleanDisplayName(publicProfile.name, userSlug);

  return {
    ...defaultDashboardProfile,
    ...publicProfile,
    name,
    username: userSlug,
    userSlug
  };
}

async function recoverLegacyDisplayName(services, data) {
  const storedName = cleanDisplayName(data?.name, '');
  const userSlug = createUsernameSlug(data?.userSlug || data?.username, '');
  const username = createUsernameSlug(data?.username || userSlug, userSlug);
  const needsRecovery = !storedName || storedName === username || storedName === userSlug;

  if (!needsRecovery || !data?.displayNameKey) return '';

  const { doc, getDoc } = services.firestoreApi;
  const displayNameSnapshot = await getDoc(doc(services.db, 'displayNames', data.displayNameKey));
  return cleanDisplayName(displayNameSnapshot.data()?.name, '');
}

async function syncProfileToAds(services, profile, uid) {
  const { collection, getDocs, query, serverTimestamp, where, writeBatch } = services.firestoreApi;
  const snapshot = await getDocs(query(collection(services.db, 'ads'), where('ownerUid', '==', uid)));
  if (snapshot.empty) return;

  const batch = writeBatch(services.db);
  snapshot.docs.forEach((adDoc) => {
    batch.update(adDoc.ref, {
      userSlug: profile.userSlug,
      userName: profile.name,
      userType: profile.type,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

export async function getDashboardProfile() {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return null;
  const { deleteField, doc, getDoc, updateDoc } = services.firestoreApi;

  const profileRef = doc(services.db, 'profiles', user.uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    return cleanProfileDoc({}, user.uid, user.email);
  }

  const data = snapshot.data();
  const recoveredName = await recoverLegacyDisplayName(services, data);

  if (Object.prototype.hasOwnProperty.call(data, 'email')) {
    await updateDoc(profileRef, { email: deleteField() }).catch(() => {});
  }

  return cleanProfileDoc(data, user.uid, user.email, recoveredName);
}

export async function checkUserSlugAvailable(slug, ownerUid = '') {
  const cleanSlug = createUsernameSlug(slug, '');
  if (!cleanSlug || isStaticUserSlug(cleanSlug)) return false;

  const services = await getFirebaseServices();
  if (!services) return false;
  const { doc, getDoc } = services.firestoreApi;

  const usernameSnapshot = await getDoc(doc(services.db, 'usernames', cleanSlug));
  return !usernameSnapshot.exists() || usernameSnapshot.data().ownerUid === ownerUid;
}

export async function setDashboardProfile(profile) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return;
  const { deleteField, doc, runTransaction, serverTimestamp } = services.firestoreApi;
  const nextProfile = cleanProfileForSave(profile, user);

  if (!(await checkUserSlugAvailable(nextProfile.userSlug, user.uid))) {
    throw new Error('That username is already taken.');
  }

  const profileRef = doc(services.db, 'profiles', user.uid);
  const usernameRef = doc(services.db, 'usernames', nextProfile.userSlug);

  const savedProfile = await runTransaction(services.db, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const currentProfile = profileSnapshot.exists()
      ? cleanProfileDoc(profileSnapshot.data(), user.uid, user.email)
      : cleanProfileDoc({}, user.uid, user.email);

    if (profileSnapshot.exists() && currentProfile.userSlug !== nextProfile.userSlug) {
      throw new Error('Username cannot be changed after account creation.');
    }

    const usernameSnapshot = await transaction.get(usernameRef);

    if (usernameSnapshot.exists() && usernameSnapshot.data().ownerUid !== user.uid) {
      throw new Error('That username is already taken.');
    }

    transaction.set(
      usernameRef,
      {
        ownerUid: user.uid,
        username: nextProfile.username,
        userSlug: nextProfile.userSlug,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const profileWrite = {
      ...nextProfile,
      ownerUid: user.uid,
      updatedAt: serverTimestamp()
    };
    if (profileSnapshot.exists()) profileWrite.email = deleteField();

    transaction.set(profileRef, profileWrite, { merge: true });

    return {
      ...nextProfile,
      ownerUid: user.uid
    };
  });

  await syncProfileToAds(services, savedProfile, user.uid);
  return savedProfile;
}

export async function getPublicProfileBySlug(slug) {
  if (!slug) return null;

  const response = await fetch(`/api/profile?slug=${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Unable to load this public profile.');
  }

  return body.profile || null;
}

export async function getProfileLikeCount() {
  const user = await getCurrentFirebaseUser();
  if (!user) return 0;

  const response = await fetch('/api/profile-likes', {
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`
    }
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || 'Unable to load profile likes.');
  }

  return Math.max(0, Number(body.count) || 0);
}
