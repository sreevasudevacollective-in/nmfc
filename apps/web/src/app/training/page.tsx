import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";

export const metadata: Metadata = { title: "Fighter Training" };

export default function TrainingPage() {
  return (
    <PageIntro title="Fighter Training">
      <p>
        Camps, striking, grappling, and fight-week prep. Program details and schedules will
        land here.
      </p>
    </PageIntro>
  );
}
