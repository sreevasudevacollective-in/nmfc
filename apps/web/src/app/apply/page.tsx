import type { Metadata } from "next";
import { ApplyFlow } from "./apply-flow";

export const metadata: Metadata = { title: "Apply as a fighter" };

export default function ApplyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Apply as a fighter</h1>
      <p className="mt-4 max-w-xl text-muted leading-relaxed">
        Anyone can create an account, then apply. You will not appear on Fighters until an
        admin reviews, verifies, and accepts the application.
      </p>
      <ApplyFlow />
    </section>
  );
}
