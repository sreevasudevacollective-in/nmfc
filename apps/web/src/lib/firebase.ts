import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  initializeAuth,
  getAuth,
  type Auth,
} from "firebase/auth";

function firebaseWebConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Missing Firebase web config. Copy apps/web/.env.example to apps/web/.env.local and restart npm run dev:web.",
    );
  }

  return { apiKey, authDomain, projectId, appId };
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseAuth() {
  if (!auth) {
    if (!app) {
      app = getApps()[0] ?? initializeApp(firebaseWebConfig());
    }
    try {
      // localStorage, not IndexedDB — Google popup hides the tab and IndexedDB
      // persistence throws "Database is closing/hidden".
      auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      auth = getAuth(app);
    }
  }
  return auth;
}

export function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export function firebaseConfigError(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
  if (code === "auth/email-already-in-use") {
    return "An account already exists for this email. Sign in instead.";
  }
  if (code === "auth/weak-password") {
    return "Password must be at least 8 characters.";
  }
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Email or password is incorrect. If you are new, use Sign up.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Google sign-in was cancelled.";
  }
  if (code === "auth/popup-blocked") {
    return "The browser blocked the Google popup. Allow popups for localhost:3001 and try again.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Add localhost to Identity Platform authorized domains.";
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "This email is already used with a different sign-in method. Use email/password.";
  }
  if (err instanceof Error && err.message.includes("Database is closing/hidden")) {
    return "Google sign-in was interrupted. Refresh and try again.";
  }
  if (err instanceof Error) return err.message;
  return "Could not sign in.";
}
