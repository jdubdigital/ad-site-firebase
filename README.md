# Ad Archive SvelteKit

This is the SvelteKit version of the original single-file prototype.

The app runs without Firebase credentials by falling back to local browser storage. When Firebase public env vars are present, it uses Firebase Auth, Firestore, and Storage for signed-in user data:

- mock catalog data lives in `src/lib/data`
- browser persistence lives in `src/lib/repositories/*.local.js`
- Firebase persistence lives in `src/lib/repositories/*.firebase.js`
- Firebase client setup lives in `src/lib/firebase/client.js`
- UI state lives in Svelte stores under `src/lib/stores`
- routes are real SvelteKit routes for `/`, `/dashboard`, `/user/[slug]`, and `/submit`

## Firebase Setup

1. Create a Firebase project.
2. Enable Email/Password in Firebase Authentication.
3. Create a Cloud Firestore database.
4. Enable Firebase Storage.
5. Copy `.env.example` to `.env` and fill in the web app config values from Firebase.
6. Deploy the included rules:

```bash
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules,storage
```

The app expects this data layout:

- `ads/{adId}` for submitted ads
- `profiles/{uid}` for dashboard profiles
- `userState/{uid}` for liked ads and favorite users
- `ads/{uid}/{fileName}` in Storage for uploaded creative assets

## Commands

```bash
npm install
npm run dev
npm run check
npm run build
npm run deploy:hosting
```

## Firebase Hosting

The app is configured as a static SvelteKit app for Firebase Hosting with a `200.html` SPA fallback, so deep links such as `/dashboard` and `/user/[slug]` resolve through the client router.

Live Firebase Hosting URL:

```text
https://ad-archive-34f6c.web.app
```
