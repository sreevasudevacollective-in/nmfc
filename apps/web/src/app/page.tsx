import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <p className="text-xs tracking-[0.25em] text-accent uppercase">No Mercy Fighting Championship</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
            The roster. The gym. The fight night.
          </h1>
          <p className="mt-6 max-w-lg text-muted leading-relaxed">
            NMFC lists the public roster. Apply to join — applications are reviewed before
            anyone goes live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/fighters"
              className="rounded-sm border border-line px-4 py-2 text-sm hover:border-foreground"
            >
              View fighters
            </Link>
            <Link
              href="/apply"
              className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-background"
            >
              Apply as a fighter
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">Fighters</h2>
          <p className="mt-2 text-sm text-muted">Public profiles after admin acceptance.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">Apply</h2>
          <p className="mt-2 text-sm text-muted">Submit an application. Review happens in admin.</p>
        </div>
      </section>
    </div>
  );
}
