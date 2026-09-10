import type { ReactNode } from "react";
import { HackathonHeader } from "@/components/hackathon/hackathon-header";

/**
 * Hackathon app routes (dashboard, submission). Design System v2 is light-only,
 * so these render on the shared light surface with Outfit headings and Inter
 * body text — the retired display / mono / seven-segment faces are gone.
 */
export default function HackathonLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F4F4] font-content text-black antialiased">
      <HackathonHeader />
      {children}
    </div>
  );
}
