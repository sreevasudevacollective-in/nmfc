"use client";

import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { firebaseConfigError, getFirebaseAuth, googleProvider } from "@/lib/firebase";

type Mode = "signup" | "signin";

const fieldClass =
  "mt-1 w-full rounded-sm border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent";

function errCode(err: unknown) {
  return typeof err === "object" && err && "code" in err ? String(err.code) : "";
}

export function SignUpPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function goTo(next: Mode, message: string) {
    setMode(next);
    setError(null);
    setNotice(message);
  }

  async function lookupMethods(emailAddress: string) {
    try {
      return await fetchSignInMethodsForEmail(getFirebaseAuth(), emailAddress);
    } catch {
      return null;
    }
  }

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      await signInWithPopup(getFirebaseAuth(), googleProvider());
    } catch (err) {
      setError(firebaseConfigError(err));
    } finally {
      setPending(false);
    }
  }

  async function onEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    setEmail(emailAddress);

    try {
      const auth = getFirebaseAuth();
      const methods = await lookupMethods(emailAddress);

      if (mode === "signup") {
        if (methods && methods.length > 0) {
          goTo("signin", "An account already exists for this email. Sign in.");
          return;
        }
        if (password !== confirm) {
          setError("Passwords do not match.");
          return;
        }
        try {
          await createUserWithEmailAndPassword(auth, emailAddress, password);
        } catch (err) {
          if (errCode(err) === "auth/email-already-in-use") {
            goTo("signin", "An account already exists for this email. Sign in.");
            return;
          }
          throw err;
        }
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, emailAddress, password);
      } catch (err) {
        const code = errCode(err);
        if (code === "auth/user-not-found") {
          goTo("signup", "No account for this email. Sign up.");
          return;
        }
        throw err;
      }
    } catch (err) {
      setError(firebaseConfigError(err));
    } finally {
      setPending(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    <div className="mt-10 max-w-md">
      <div className="flex border-b border-line text-sm">
        <button
          type="button"
          className={`px-4 py-2 ${isSignUp ? "border-b-2 border-accent text-foreground" : "text-muted"}`}
          onClick={() => {
            setMode("signup");
            setError(null);
            setNotice(null);
          }}
        >
          Sign up
        </button>
        <button
          type="button"
          className={`px-4 py-2 ${!isSignUp ? "border-b-2 border-accent text-foreground" : "text-muted"}`}
          onClick={() => {
            setMode("signin");
            setError(null);
            setNotice(null);
          }}
        >
          Sign in
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {isSignUp
          ? "Create an account with Google or email, then submit your fighter application."
          : "Sign in to continue your application or check your status."}
      </p>

      {notice ? <p className="mt-3 text-sm text-accent">{notice}</p> : null}

      <button
        type="button"
        onClick={onGoogle}
        disabled={pending}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-sm border border-line bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
      >
        <GoogleMark />
        {isSignUp ? "Sign up with Google" : "Sign in with Google"}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs tracking-wide text-muted uppercase">
        <span className="h-px flex-1 bg-line" />
        or email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={onEmail} className="grid gap-3">
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            className={fieldClass}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            className={fieldClass}
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
          />
        </label>
        {isSignUp ? (
          <label className="block text-sm">
            <span className="text-muted">Confirm password</span>
            <input
              className={fieldClass}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
        ) : null}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {pending ? "Please wait…" : isSignUp ? "Sign up with email" : "Sign in with email"}
        </button>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.9 26.8 37 24 37c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.1 7.3l.1.1 6.2 5.2C37.3 41.3 44 36 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
