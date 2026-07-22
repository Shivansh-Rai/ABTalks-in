import type { Metadata } from "next";
import { Deliverables } from "@/components/hackathon/deliverables";
import { Faq } from "@/components/hackathon/faq";
import { FinalCta } from "@/components/hackathon/final-cta";
import { Hero } from "@/components/hackathon/hero";
import { HowItWorks } from "@/components/hackathon/how-it-works";
import { Prizes } from "@/components/hackathon/prizes";
import { Rules } from "@/components/hackathon/rules";
import { ThemeSection } from "@/components/hackathon/theme-section";
import { Timeline } from "@/components/hackathon/timeline";

export const metadata: Metadata = {
  title: "ABTalks Vibe Code Hackathon | 48 Hours, Pure Vibe Coding",
  description:
    "Build anything in 48 hours using AI. Solo or teams of 3. Free to enter. Open to all Indian college students.",
};

export default function HackathonPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Hero />
      <ThemeSection />
      <HowItWorks />
      <Timeline />
      <Deliverables />
      <Rules />
      <Prizes />
      <Faq />
      <FinalCta />
    </main>
  );
}
