"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { ApplyForm } from "./apply-form";
import { SignUpPanel } from "./sign-up-panel";
import { firebaseConfigError, getFirebaseAuth } from "@/lib/firebase";

export function ApplyFlow() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      return onAuthStateChanged(auth, setUser);
    } catch (err) {
      setConfigError(firebaseConfigError(err));
      setUser(null);
    }
  }, []);

  if (configError) {
    return (
      <p className="mt-10 max-w-xl text-sm text-red-400">
        {configError} Enable Email/password and Google in Identity Platform, add{" "}
        <code className="text-foreground">localhost</code> as an authorized domain, then
        restart <code className="text-foreground">npm run dev:web</code>.
      </p>
    );
  }

  if (user === undefined) {
    return <p className="mt-10 text-sm text-muted">Checking session…</p>;
  }

  if (!user?.email) {
    return <SignUpPanel />;
  }

  return (
    <div className="mt-10">
      <p className="text-sm text-muted">
        Signed in as <span className="text-foreground">{user.email}</span>
        {" · "}
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => signOut(getFirebaseAuth())}
        >
          Sign out
        </button>
      </p>
      <ApplyForm user={user} />
    </div>
  );
}
