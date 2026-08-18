import type { ReactNode } from "react";

export function PageIntro({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4 space-y-4 text-muted leading-relaxed">{children}</div>
    </section>
  );
}
