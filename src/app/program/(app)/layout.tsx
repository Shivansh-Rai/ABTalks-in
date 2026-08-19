import Link from "next/link";
import Image from "next/image";
import { requireProgramMember } from "@/lib/program-auth";
import { ProgramNav } from "@/components/program/program-nav";

const navItems = [
  { href: "/program/dashboard", label: "Dashboard" },
  { href: "/program/videos", label: "Videos" },
  { href: "/program/leaderboard", label: "Leaderboard" },
];

export default async function ProgramAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireProgramMember();

  return (
    <div className="min-h-svh bg-[#FBF9F7] font-content text-[#111111]">
      <header className="sticky top-0 z-40 border-b border-[#E0E0E0] bg-white/95 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3 md:gap-6 md:py-4">
          <Link href="/" className="shrink-0" aria-label="ABTalks home">
            <Image
              src="/abtalks-logo.png"
              alt="ABTalks"
              width={160}
              height={42}
              className="h-8 w-auto md:h-9"
              priority
            />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/program/dashboard"
              className="shrink-0 text-base font-semibold tracking-tight"
            >
              <span className="text-[#E05226]">AI</span>{" "}
              <span className="text-[#111111]">Cohort</span>
            </Link>
          </div>
          <ProgramNav items={navItems} />
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-[1536px] px-4 py-6">
        {children}
      </main>
    </div>
  );
}
