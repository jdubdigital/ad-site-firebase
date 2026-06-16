import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';
import { defaultDashboardProfile, users } from '$lib/data/catalog';
import { createSlug, createUsernameSlug } from '$lib/utils/slug';

const demoProfileSlug = 'mohegan-sun';

function isStaticUserSlug(slug) {
  return users.some((user) => user.slug === slug);
}

function cleanProfileDoc(data, uid, email) {
  const emailSlug = createSlug(email?.split('@')[0], uid);
  const userSlug = createUsernameSlug(
    !data?.userSlug || data.userSlug === demoProfileSlug ? emailSlug : data.userSlug,
    emailSlug
  );
  const username = createUsernameSlug(data?.username || userSlug, userSlug);
  const publicName = username || userSlug || defaultDashboardProfile.userSlug;

  return {
    ...defaultDashboardProfile,
    ...data,
    name: publicName,
    email: data?.email || email || defaultDashboardProfile.email,
    username,
    userSlug
  };
}

function cleanProfileForSave(profile, user) {
  const fallbackSlug = createUsernameSlug(user.email?.split('@')[0], user.uid);
  const userSlug = createUsernameSlug(profile.userSlug || profile.username || fallbackSlug, fallbackSlug);

  return {
    ...defaultDashboardProfile,
    ...profile,
    name: userSlug,
    email: profile.email || user.email || defaultDashboardProfile.email,
    username: userSlug,
    userSlug
  };
}

async function hasOtherLegacyProfileWithSlug(services, slug, uid) {
  const { collection, getDocs, limit, query, where } = services.firestoreApi;
  const snapshot = await getDocs(
    query(collection(services.db, 'profiles'), where('userSlug', '==', slug), limit(2))
  );

  return snapshot.docs.some((profileDoc) => profileDoc.id !== uid);
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
  const { doc, getDoc } = services.firestoreApi;

  const snapshot = await getDoc(doc(services.db, 'profiles', user.uid));
  if (!snapshot.exists()) {
    return cleanProfileDoc({}, user.uid, user.email);
  }

  return cleanProfileDoc(snapshot.data(), user.uid, user.email);
}

export async function checkUserSlugAvailable(slug, ownerUid = '') {
  const cleanSlug = createUsernameSlug(slug, '');
  if (!cleanSlug || isStaticUserSlug(cleanSlug)) return false;

  const services = await getFirebaseServices();
  if (!services) return false;
  const { doc, getDoc } = services.firestoreApi;

  const usernameSnapshot = await getDoc(doc(services.db, 'usernames', cleanSlug));
  if (usernameSnapshot.exists() && usernameSnapshot.data().ownerUid !== ownerUid) return false;

  return !(await hasOtherLegacyProfileWithSlug(services, cleanSlug, ownerUid));
}

export async function setDashboardProfile(profile) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return;
  const { doc, runTransaction, serverTimestamp } = services.firestoreApi;
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

    transaction.set(
      profileRef,
      {
        ...nextProfile,
        ownerUid: user.uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    return {
      ...nextProfile,
      ownerUid: user.uid
    };
  });

  await syncProfileToAds(services, savedProfile, user.uid);
  return savedProfile;
}

export async function getPublicProfileBySlug(slug) {
  const services = await getFirebaseServices();
  if (!services || !slug) return null;
  const { collection, getDocs, limit, query, where } = services.firestoreApi;

  const snapshot = await getDocs(
    query(collection(services.db, 'profiles'), where('userSlug', '==', slug), limit(1))
  );
  if (snapshot.empty) return null;

  const profileDoc = snapshot.docs[0];
  return cleanProfileDoc(profileDoc.data(), profileDoc.id, profileDoc.data().email);
}
