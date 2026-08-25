import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-4 max-w-xl text-muted leading-relaxed">
        Review pending fighter applications. Accepting one creates a public Fighter profile;
        rejecting one leaves the applicant a note.
      </p>
      <AdminDashboard />
    </section>
  );
}
