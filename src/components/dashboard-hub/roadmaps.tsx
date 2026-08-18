import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Domain } from "@prisma/client";
import { isProgramEnabled } from "@/lib/feature-flags";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROADMAPS: { domain: Domain; label: string; path: string }[] = [
  { domain: "AI", label: "Artificial Intelligence", path: "/ai" },
  { domain: "DS", label: "Data Science", path: "/ds" },
  { domain: "SE", label: "Software Engineering", path: "/se" },
];

type RoadmapsProps = {
  enrolledDomains: Domain[];
  hasProgramMembership: boolean;
};

export function Roadmaps({
  enrolledDomains,
  hasProgramMembership,
}: RoadmapsProps) {
  const enrolled = new Set(enrolledDomains);
  const showProgramPrepKit = isProgramEnabled();

  return (
    <>
      <section className="scroll-mt-20 px-4 py-8 sm:px-6">
        <h2 className="ml-4 font-heading text-xl font-semibold uppercase text-[#e05226]">
          Roadmaps
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {ROADMAPS.map(({ domain, label, path }) => {
            const isEnrolled = enrolled.has(domain);
            return (
              <li
                key={domain}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <p className="font-heading font-semibold text-black">{label}</p>
                <p className="mt-1 flex-1 text-sm text-[#555555]">
                  60-day challenge track
                </p>
                <Link
                  href={isEnrolled ? path : "/challenges"}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:text-[#e05226]"
                >
                  {isEnrolled ? "Continue" : "Join"}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {showProgramPrepKit ? (
        <section className="px-4 py-2 sm:px-6 sm:py-4">
          <h2 className="ml-4 font-heading text-xl font-semibold uppercase text-[#e05226]">
            AI Prep Kit
          </h2>
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-heading text-lg font-semibold text-black">
                  31 Days AI Cohort
                </p>
                <p className="mt-1 text-sm text-[#555555]">
                  Live cohort roadmap, projects, and guided prep for working
                  professionals.
                </p>
              </div>
              <Link
                href="/program"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "shrink-0 bg-[#e05226] text-white hover:bg-[#c44720]",
                )}
              >
                {hasProgramMembership ? "Continue" : "Start"}
              </Link>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
