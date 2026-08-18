import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

function authErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Check the password and try again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/unauthorized-domain":
      return "This domain is not allowed in Identity Platform. Add localhost in the Firebase console.";
    case "auth/operation-not-allowed":
      return "This sign-in method is disabled. Enable Email and Google in Identity Platform.";
    default:
      return error instanceof Error ? error.message : "Could not sign in.";
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const created = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
    return created.user;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/email-already-in-use") {
      const existing = await signInWithEmailAndPassword(firebaseAuth(), email, password);
      return existing.user;
    }
    throw error;
  }
}

export { authErrorMessage };
