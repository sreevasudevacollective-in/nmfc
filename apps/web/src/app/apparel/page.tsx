import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Apparel & Training Gear" };

export default function ApparelPage() {
  return (
    <PageIntro title="Apparel & Training Gear">
      <p>
        Fight-week kits, gym wear, and training gear. Catalog and ordering will follow.
      </p>
    </PageIntro>
  );
}
