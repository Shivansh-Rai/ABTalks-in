import type { Metadata } from "next";
import { Deliverables } from "@/components/hackathon/deliverables";
import { Faq } from "@/components/hackathon/faq";
import { HackathonHeader } from "@/components/hackathon/hackathon-header";
import { Hero } from "@/components/hackathon/hero";
import { HowItWorks } from "@/components/hackathon/how-it-works";
import { Prizes } from "@/components/hackathon/prizes";
import { Rules } from "@/components/hackathon/rules";
import { Timeline } from "@/components/hackathon/timeline";

export const metadata: Metadata = {
  title: "ABTalks Vibe Code Hackathon | 48 Hours, Pure Vibe Coding",
  description:
    "Build anything in 48 hours using AI. Solo or teams of 3. Free to enter. Open to all Indian college students.",
};

export default function HackathonPage() {
  return (
    <div className="origin-top bg-black" style={{ zoom: 0.9 }}>
      <HackathonHeader />
      <main className="min-h-screen bg-black text-white">
        <Hero />
        {/* Mobile-only: zoom bottom sections out 20% */}
        <div className="origin-top max-md:[zoom:0.8] md:[zoom:1]">
          <HowItWorks />
          <Timeline />
          <Deliverables />
          <Rules />
          <Prizes />
          <Faq />
        </div>
      </main>
    </div>
  );
}
