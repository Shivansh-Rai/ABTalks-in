import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Domain } from "@prisma/client";

const ROADMAPS: { domain: Domain; label: string; path: string }[] = [
  { domain: "AI", label: "Artificial Intelligence", path: "/ai" },
  { domain: "DS", label: "Data Science", path: "/ds" },
  { domain: "SE", label: "Software Engineering", path: "/se" },
];

type RoadmapsProps = {
  enrolledDomains: Domain[];
};

export function Roadmaps({ enrolledDomains }: RoadmapsProps) {
  const enrolled = new Set(enrolledDomains);

  return (
    <section className="scroll-mt-20 px-4 py-8 sm:px-6">
      <h2 className="font-display text-xl font-semibold text-black">
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
              <p className="font-display font-semibold text-black">{label}</p>
              <p className="mt-1 flex-1 text-sm text-neutral-500">
                60-day challenge track
              </p>
              <Link
                href={isEnrolled ? path : "/challenges"}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:underline"
              >
                {isEnrolled ? "Continue" : "Join"}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
