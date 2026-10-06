import type { Metadata } from "next";
import Link from "next/link";
import { COURSES } from "@/features/courses/registry";
import { HUB_CARD_CTA_CLASS, HUB_CARD_HOVER_CLASS } from "@/components/dashboard-hub/nav-items";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Learn | ABTalks",
  description: "Free, in-depth technical courses with interactive diagrams.",
};

export default function LearnIndexPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold uppercase text-[#03535F]">Learn</h1>
      <p className="mt-1 text-sm text-[#4B4B4B]">Free, in-depth courses. Read at your own pace; progress is saved in this browser.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {COURSES.map((c) => (
          <li key={c.slug} className={cn("flex flex-col justify-between rounded-2xl border border-[#E0E0E0] bg-white p-6", HUB_CARD_HOVER_CLASS)}>
            <div>
              <p className="font-bold text-black">{c.title}</p>
              <p className="mt-1 text-sm text-[#4B4B4B]">{c.tagline}</p>
              <p className="mt-2 text-xs text-[#6B7280]">
                {c.modules.length} modules · {c.level}
              </p>
            </div>
            <Link href={`/learn/${c.slug}`} className={cn(HUB_CARD_CTA_CLASS, "mt-4 self-end")}>
              Open course
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
