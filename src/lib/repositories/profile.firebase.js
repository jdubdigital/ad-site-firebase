import { getCurrentFirebaseUser, getFirebaseServices } from '$lib/firebase/client';
import { defaultDashboardProfile } from '$lib/data/catalog';
import { createNameFromEmail, createSlug } from '$lib/utils/slug';

const demoProfileName = 'Mohegan Sun';
const demoProfileSlug = 'mohegan-sun';
const demoProfileDescription = 'Public profile summary for the ads, campaigns, and creative references you share.';

function cleanProfileDoc(data, uid, email) {
  const isLegacyDemoProfile =
    data?.name === demoProfileName && (!data?.description || data.description === demoProfileDescription);
  const emailSlug = createSlug(email?.split('@')[0], uid);

  return {
    ...defaultDashboardProfile,
    ...data,
    name: !data?.name || isLegacyDemoProfile ? createNameFromEmail(email) : data.name,
    email: data?.email || email || defaultDashboardProfile.email,
    userSlug: !data?.userSlug || data.userSlug === demoProfileSlug ? emailSlug : data.userSlug
  };
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

export async function setDashboardProfile(profile) {
  const services = await getFirebaseServices();
  const user = await getCurrentFirebaseUser();
  if (!services || !user) return;
  const { doc, serverTimestamp, setDoc } = services.firestoreApi;

  await setDoc(
    doc(services.db, 'profiles', user.uid),
    {
      ...profile,
      email: profile.email || user.email,
      ownerUid: user.uid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
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
