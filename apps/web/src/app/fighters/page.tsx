import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Fighters" };

type PublicFighter = {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  weightClass: string | null;
  gym: string | null;
  hometown: string | null;
};

const apiBase = process.env.API_URL ?? "http://localhost:4000";

async function loadFighters(): Promise<PublicFighter[]> {
  try {
    const res = await fetch(`${apiBase}/fighters`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return (await res.json()) as PublicFighter[];
  } catch {
    return [];
  }
}

export default async function FightersPage() {
  const fighters = await loadFighters();

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fighters</h1>
          <p className="mt-2 max-w-xl text-muted">
            Only accepted athletes appear here. To join the roster, apply and wait for review.
          </p>
        </div>
        <Link href="/apply" className="text-sm text-accent hover:underline">
          Apply as a fighter
        </Link>
      </div>

      {fighters.length === 0 ? (
        <p className="mt-12 text-sm text-muted">No fighters listed yet.</p>
      ) : (
        <ul className="mt-12 divide-y divide-line border-y border-line">
          {fighters.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <div>
                <p className="font-medium">
                  {f.firstName} {f.lastName}
                  {f.nickname ? <span className="text-muted"> “{f.nickname}”</span> : null}
                </p>
                <p className="text-sm text-muted">
                  {[f.weightClass, f.hometown, f.gym].filter(Boolean).join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
