"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseConfigError, getFirebaseAuth } from "@/lib/firebase";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Application = {
  id: string;
  status: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  weightClass: string;
  reviewNotes: string;
};

async function authHeaders(user: User) {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function ApplicationRow({
  application,
  user,
  onDecided,
}: {
  application: Application;
  user: User;
  onDecided: (id: string) => void;
}) {
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  async function decide(action: "accept" | "reject") {
    setPending(action);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/admin/applications/${application.id}/${action}`, {
        method: "POST",
        headers: await authHeaders(user),
        body: action === "reject" ? JSON.stringify({ reviewNotes: notes || undefined }) : undefined,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Could not ${action} application.`);
      onDecided(application.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${action} application.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <li className="rounded-sm border border-line px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-foreground">
          {application.firstName} {application.lastName}
          {application.nickname ? ` "${application.nickname}"` : ""}
        </p>
        <p className="text-sm text-muted">{application.weightClass || "No weight class"}</p>
      </div>
      <p className="mt-1 text-sm text-muted">{application.email}</p>

      <input
        className="mt-3 w-full rounded-sm border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        placeholder="Notes for rejection (optional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => decide("accept")}
        >
          {pending === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          type="button"
          className="rounded-sm border border-line px-4 py-2 text-sm disabled:opacity-50"
          disabled={pending !== null}
          onClick={() => decide("reject")}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </li>
  );
}

function PendingApplications({ user }: { user: User }) {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/v1/admin/applications?status=PENDING_REVIEW`, {
        headers: await authHeaders(user),
      });
      const data = (await res.json()) as { applications?: Application[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load applications.");
      setApplications(data.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
      setApplications(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (error) {
    return <p className="mt-10 max-w-xl text-sm text-red-400">{error}</p>;
  }

  if (applications === null) {
    return <p className="mt-10 text-sm text-muted">Loading applications…</p>;
  }

  if (applications.length === 0) {
    return <p className="mt-10 text-sm text-muted">No applications pending review.</p>;
  }

  return (
    <ul className="mt-10 space-y-4">
      {applications.map((application) => (
        <ApplicationRow
          key={application.id}
          application={application}
          user={user}
          onDecided={() => setApplications((prev) => prev?.filter((a) => a.id !== application.id) ?? null)}
        />
      ))}
    </ul>
  );
}

export function AdminDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [configError, setConfigError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    try {
      const auth = getFirebaseAuth();
      return onAuthStateChanged(auth, setUser);
    } catch (err) {
      setConfigError(firebaseConfigError(err));
      setUser(null);
    }
  }, []);

  // A 403 from the list endpoint is the only signal that "signed in, not an admin"
  // exists — probe once on sign-in rather than guessing from client-side role state
  // the client never has (role lives in Postgres, not on the Firebase token).
  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/v1/admin/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForbidden(res.status === 403);
    })();
  }, [user]);

  if (configError) {
    return <p className="mt-10 max-w-xl text-sm text-red-400">{configError}</p>;
  }

  if (user === undefined) {
    return <p className="mt-10 text-sm text-muted">Checking session…</p>;
  }

  if (!user?.email) {
    return <p className="mt-10 text-sm text-muted">Sign in at /apply, then return here.</p>;
  }

  if (forbidden) {
    return (
      <p className="mt-10 max-w-xl text-sm text-red-400">
        Signed in as {user.email}, but this account is not an admin.
      </p>
    );
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
      <PendingApplications user={user} />
    </div>
  );
}
