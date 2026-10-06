import Link from "next/link";
import { BookOpen } from "lucide-react";
import { COURSES } from "@/features/courses/registry";
import { HUB_CARD_CTA_CLASS, HUB_CARD_HOVER_CLASS, HUB_HEADING_CLASS } from "@/components/dashboard-hub/nav-items";
import { cn } from "@/lib/utils";

/** Dashboard "Learn" section: one tile per free course. Server component. */
export function LearnCourses() {
  return (
    <section id="learn" className="scroll-mt-20 px-4 py-6 sm:px-6">
      <h2 className={HUB_HEADING_CLASS}>Learn</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:ml-4 lg:grid-cols-3 xl:max-w-[1240px]">
        {COURSES.map((c) => (
          <li key={c.slug} className={cn("flex flex-col justify-between rounded-2xl border border-[#E0E0E0] bg-white p-5", HUB_CARD_HOVER_CLASS)}>
            <div className="flex gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF6F6] text-[#03535F]">
                <BookOpen className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-inter font-bold text-black">{c.title}</p>
                <p className="mt-1 text-sm text-[#4B4B4B]">{c.tagline}</p>
                <p className="mt-1 text-xs text-[#6B7280]">Free · {c.modules.length} modules · interactive diagrams</p>
              </div>
            </div>
            <Link href={`/learn/${c.slug}`} className={cn(HUB_CARD_CTA_CLASS, "mt-3 self-end")}>
              Start learning
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
