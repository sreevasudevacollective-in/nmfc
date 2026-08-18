import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <PageIntro title="About Us">
      <p>
        No Mercy Fighting Championship is a combat sports promotion. This site is the public
        home for the roster, training, and partners.
      </p>
    </PageIntro>
  );
}
