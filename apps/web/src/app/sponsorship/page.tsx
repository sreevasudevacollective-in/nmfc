import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Sponsorship Opportunities" };

export default function SponsorshipPage() {
  return (
    <PageIntro title="Sponsorship Opportunities">
      <p>
        Partner with NMFC on events, athletes, and year-round presence. Packages and a
        contact path will be published here.
      </p>
    </PageIntro>
  );
}
