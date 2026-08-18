"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "firebase/auth";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STEPS = ["Identity", "Fighting", "Profile", "Contact"] as const;

const weightClasses = [
  { value: "", label: "Select weight class" },
  { value: "FLYWEIGHT", label: "Flyweight" },
  { value: "BANTAMWEIGHT", label: "Bantamweight" },
  { value: "FEATHERWEIGHT", label: "Featherweight" },
  { value: "LIGHTWEIGHT", label: "Lightweight" },
  { value: "WELTERWEIGHT", label: "Welterweight" },
  { value: "MIDDLEWEIGHT", label: "Middleweight" },
  { value: "LIGHT_HEAVYWEIGHT", label: "Light heavyweight" },
  { value: "HEAVYWEIGHT", label: "Heavyweight" },
];

const fieldClass =
  "mt-1 w-full rounded-sm border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

type Draft = {
  status: string;
  draftStep: number;
  firstName: string;
  lastName: string;
  nickname: string;
  dob: string;
  weightClass: string;
  heightCm: string | number;
  reachCm: string | number;
  gym: string;
  hometown: string;
  instagram: string;
  bio: string;
  phone: string;
  address: string;
};

const emptyDraft: Draft = {
  status: "DRAFT",
  draftStep: 1,
  firstName: "",
  lastName: "",
  nickname: "",
  dob: "",
  weightClass: "",
  heightCm: "",
  reachCm: "",
  gym: "",
  hometown: "",
  instagram: "",
  bio: "",
  phone: "",
  address: "",
};

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  children,
}: {
  label: string;
  name?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  children?: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children ?? (
        <input
          className={fieldClass}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
        />
      )}
    </label>
  );
}

async function authHeaders(user: User) {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function formToPayload(form: HTMLFormElement, step: number) {
  const data = Object.fromEntries(new FormData(form).entries());
  return { ...data, draftStep: step };
}

export function ApplyForm({ user }: { user: User }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/applications/me`, {
          headers: await authHeaders(user),
        });
        const data = (await res.json()) as { application?: Draft | null; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not load application.");
        if (cancelled) return;
        if (data.application) {
          setDraft(data.application);
          setStep(Math.min(4, Math.max(1, data.application.draftStep || 1)));
        } else {
          setDraft(emptyDraft);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load application.");
        if (!cancelled) setDraft(emptyDraft);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function save(form: HTMLFormElement, nextStep: number, submit = false) {
    setError(null);
    setNotice(null);
    setPending(true);
    const payload = formToPayload(form, nextStep);
    try {
      const path = submit ? "/v1/applications/me/submit" : "/v1/applications/me";
      const res = await fetch(`${apiBase}${path}`, {
        method: submit ? "POST" : "PUT",
        headers: await authHeaders(user),
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Draft & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setDraft(data);
      setStep(submit ? 4 : nextStep);
      if (submit) setNotice(null);
      else setNotice("Draft saved. You can sign out and continue later.");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function onNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Math.min(4, step + 1);
    await save(event.currentTarget, next);
  }

  async function onSaveLater(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(event.currentTarget, step);
  }

  async function onSubmitFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save(event.currentTarget, 4, true);
  }

  if (loading || !draft) {
    return <p className="mt-8 text-sm text-muted">Loading your application…</p>;
  }

  if (draft.status === "PENDING_REVIEW") {
    return (
      <p className="mt-8 rounded-sm border border-line px-4 py-6 text-sm text-muted">
        Application received and under review. You will not appear on Fighters until an admin
        accepts it.
      </p>
    );
  }

  if (draft.status === "ACCEPTED") {
    return (
      <p className="mt-8 rounded-sm border border-line px-4 py-6 text-sm text-muted">
        Your application was accepted. You are on the public roster.
      </p>
    );
  }

  if (draft.status === "REJECTED") {
    return (
      <p className="mt-8 rounded-sm border border-line px-4 py-6 text-sm text-muted">
        This application was not accepted. Contact the promotion if you want to apply again.
      </p>
    );
  }

  return (
    <form
      key={`${draft.status}-${step}`}
      onSubmit={step === 4 ? onSubmitFinal : onNext}
      className="mt-8 grid max-w-xl gap-4"
    >
      <div className="flex gap-2 text-xs tracking-wide text-muted uppercase">
        {STEPS.map((label, index) => (
          <span key={label} className={index + 1 === step ? "text-accent" : undefined}>
            {index + 1}. {label}
          </span>
        ))}
      </div>

      {step === 1 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" required defaultValue={draft.firstName} />
            <Field label="Last name" name="lastName" required defaultValue={draft.lastName} />
          </div>
          <Field label="Nickname" name="nickname" defaultValue={draft.nickname} />
          <Field label="Date of birth" name="dob" type="date" defaultValue={draft.dob} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <label className="block text-sm">
            <span className="text-muted">Weight class</span>
            <select className={fieldClass} name="weightClass" defaultValue={draft.weightClass}>
              {weightClasses.map((option) => (
                <option key={option.value || "none"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Height (cm)" name="heightCm" type="number" defaultValue={draft.heightCm} />
            <Field label="Reach (cm)" name="reachCm" type="number" defaultValue={draft.reachCm} />
          </div>
          <Field label="Gym" name="gym" defaultValue={draft.gym} />
          <Field label="Hometown" name="hometown" defaultValue={draft.hometown} />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Field label="Instagram" name="instagram" defaultValue={draft.instagram} />
          <label className="block text-sm">
            <span className="text-muted">Bio</span>
            <textarea className={`${fieldClass} min-h-28`} name="bio" rows={4} defaultValue={draft.bio} />
          </label>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Field label="Phone" name="phone" type="tel" defaultValue={draft.phone} />
          <Field label="Address" name="address" defaultValue={draft.address} />
        </>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {notice ? <p className="text-sm text-accent">{notice}</p> : null}

      <div className="mt-2 flex flex-wrap gap-3">
        {step > 1 ? (
          <button
            type="button"
            className="rounded-sm border border-line px-4 py-2 text-sm"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : step === 4 ? "Submit for review" : "Save and continue"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="text-sm text-muted hover:text-foreground disabled:opacity-50"
          onClick={(event) => {
            const form = (event.currentTarget as HTMLButtonElement).form;
            if (form) void onSaveLater({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>);
          }}
        >
          Save draft and continue later
        </button>
      </div>
    </form>
  );
}
