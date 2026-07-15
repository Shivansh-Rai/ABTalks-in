import Link from "next/link";
import { requireProgramMember } from "@/lib/program-auth";
import { ProgramNav } from "@/components/program/program-nav";

const navItems = [
  { href: "/program/dashboard", label: "Dashboard" },
  { href: "/program/curriculum", label: "Curriculum" },
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
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <Link
            href="/program/dashboard"
            className="font-display shrink-0 text-base font-semibold tracking-tight"
          >
            <span className="text-primary">AI</span> Cohort
          </Link>
          <ProgramNav items={navItems} />
        </div>
      </header>
      <main className="container mx-auto min-w-0 px-4 py-6">{children}</main>
    </div>
  );
}
