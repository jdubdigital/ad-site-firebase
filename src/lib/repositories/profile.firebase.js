import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';
import { defaultDashboardProfile, users } from '$lib/data/catalog';
import { cleanDisplayName, createDisplayNameKey, createNameFromEmail, createSlug, createUsernameSlug } from '$lib/utils/slug';

const demoProfileName = 'Mohegan Sun';
const demoProfileSlug = 'mohegan-sun';
const demoProfileDescription = 'Public profile summary for the ads, campaigns, and creative references you share.';

function isStaticUserSlug(slug) {
  return users.some((user) => user.slug === slug);
}

function isStaticDisplayNameKey(key) {
  return users.some((user) => createDisplayNameKey(user.name) === key);
}

function cleanProfileDoc(data, uid, email) {
  const isLegacyDemoProfile =
    data?.name === demoProfileName && (!data?.description || data.description === demoProfileDescription);
  const emailSlug = createSlug(email?.split('@')[0], uid);
  const displayName = cleanDisplayName(
    !data?.name || isLegacyDemoProfile ? createNameFromEmail(email) : data.name,
    defaultDashboardProfile.name
  );
  const userSlug = createUsernameSlug(
    !data?.userSlug || data.userSlug === demoProfileSlug ? emailSlug : data.userSlug,
    emailSlug
  );

  return {
    ...defaultDashboardProfile,
    ...data,
    name: displayName,
    email: data?.email || email || defaultDashboardProfile.email,
    displayNameKey: createDisplayNameKey(data?.displayNameKey || displayName, createDisplayNameKey(displayName)),
    username: createUsernameSlug(data?.username || userSlug, userSlug),
    userSlug
  };
}

function cleanProfileForSave(profile, user) {
  const fallbackSlug = createUsernameSlug(user.email?.split('@')[0], user.uid);
  const name = cleanDisplayName(profile.name, createNameFromEmail(user.email));
  const userSlug = createUsernameSlug(profile.userSlug || profile.username || fallbackSlug, fallbackSlug);
  const displayNameKey = createDisplayNameKey(name, '');

  return {
    ...defaultDashboardProfile,
    ...profile,
    name,
    email: profile.email || user.email || defaultDashboardProfile.email,
    displayNameKey,
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

async function hasOtherLegacyProfileWithDisplayName(services, name, key, uid) {
  const { collection, getDocs, limit, query, where } = services.firestoreApi;
  const profiles = collection(services.db, 'profiles');
  const [keySnapshot, nameSnapshot] = await Promise.all([
    getDocs(query(profiles, where('displayNameKey', '==', key), limit(2))),
    getDocs(query(profiles, where('name', '==', name), limit(2)))
  ]);

  return [...keySnapshot.docs, ...nameSnapshot.docs].some((profileDoc) => profileDoc.id !== uid);
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

export async function checkDisplayNameAvailable(name, ownerUid = '') {
  const cleanName = cleanDisplayName(name, '');
  const cleanKey = createDisplayNameKey(cleanName, '');
  if (cleanName.length < 2 || !cleanKey || isStaticDisplayNameKey(cleanKey)) return false;

  const services = await getFirebaseServices();
  if (!services) return false;
  const { doc, getDoc } = services.firestoreApi;

  const displayNameSnapshot = await getDoc(doc(services.db, 'displayNames', cleanKey));
  if (displayNameSnapshot.exists() && displayNameSnapshot.data().ownerUid !== ownerUid) return false;

  return !(await hasOtherLegacyProfileWithDisplayName(services, cleanName, cleanKey, ownerUid));
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

  if (!(await checkDisplayNameAvailable(nextProfile.name, user.uid))) {
    throw new Error('That display name is already taken.');
  }

  const profileRef = doc(services.db, 'profiles', user.uid);
  const usernameRef = doc(services.db, 'usernames', nextProfile.userSlug);
  const displayNameRef = doc(services.db, 'displayNames', nextProfile.displayNameKey);

  const savedProfile = await runTransaction(services.db, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    const currentProfile = profileSnapshot.exists()
      ? cleanProfileDoc(profileSnapshot.data(), user.uid, user.email)
      : cleanProfileDoc({}, user.uid, user.email);
    const oldUsernameRef =
      currentProfile.userSlug && currentProfile.userSlug !== nextProfile.userSlug
        ? doc(services.db, 'usernames', currentProfile.userSlug)
        : null;
    const oldDisplayNameRef =
      currentProfile.displayNameKey && currentProfile.displayNameKey !== nextProfile.displayNameKey
        ? doc(services.db, 'displayNames', currentProfile.displayNameKey)
        : null;
    const usernameSnapshot = await transaction.get(usernameRef);
    const oldUsernameSnapshot = oldUsernameRef ? await transaction.get(oldUsernameRef) : null;
    const displayNameSnapshot = await transaction.get(displayNameRef);
    const oldDisplayNameSnapshot = oldDisplayNameRef ? await transaction.get(oldDisplayNameRef) : null;

    if (usernameSnapshot.exists() && usernameSnapshot.data().ownerUid !== user.uid) {
      throw new Error('That username is already taken.');
    }

    if (displayNameSnapshot.exists() && displayNameSnapshot.data().ownerUid !== user.uid) {
      throw new Error('That display name is already taken.');
    }

    if (oldUsernameRef && oldUsernameSnapshot?.exists() && oldUsernameSnapshot.data().ownerUid === user.uid) {
      transaction.delete(oldUsernameRef);
    }

    if (oldDisplayNameRef && oldDisplayNameSnapshot?.exists() && oldDisplayNameSnapshot.data().ownerUid === user.uid) {
      transaction.delete(oldDisplayNameRef);
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
      displayNameRef,
      {
        ownerUid: user.uid,
        name: nextProfile.name,
        displayNameKey: nextProfile.displayNameKey,
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
