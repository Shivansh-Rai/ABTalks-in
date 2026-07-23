import "@fontsource/dseg7-classic/400.css";
import "@fontsource/dseg7-classic/700.css";
import { Bitcount_Prop_Single, IBM_Plex_Mono } from "next/font/google";
import type { ReactNode } from "react";

const bitcount = Bitcount_Prop_Single({
  subsets: ["latin"],
  variable: "--font-hackathon-display",
  weight: "400",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-hackathon-mono",
  weight: ["400", "500", "600", "700"],
});

export default function HackathonLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${bitcount.variable} ${plexMono.variable} min-h-screen bg-black text-white antialiased`}
    >
      {children}
    </div>
  );
}
