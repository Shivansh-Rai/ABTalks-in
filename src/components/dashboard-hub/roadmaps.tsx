import Link from "next/link";
import type { Domain } from "@prisma/client";
import { isProgramEnabled } from "@/lib/feature-flags";
import { PROGRAM_AI_COHORT_BASE } from "@/features/program/constants";
import {
  HUB_CARD_CTA_CLASS,
  HUB_CARD_GRID_CLASS,
  HUB_CARD_HOVER_CLASS,
  HUB_CONTAINER_CLASS,
  HUB_SECTION_CLASS,
} from "@/components/dashboard-hub/nav-items";
import { cn } from "@/lib/utils";

const ROADMAPS: { domain: Domain; label: string; path: string }[] = [
  { domain: "AI", label: "Artificial Intelligence", path: "/ai" },
  { domain: "DS", label: "Data Science", path: "/ds" },
  { domain: "SE", label: "Software Engineering", path: "/se" },
];

type RoadmapsProps = {
  joinedDomains: Domain[];
  abandonedDomains: Domain[];
  hasProgramMembership: boolean;
  showDatabricks?: boolean;
  showDsArchitect?: boolean;
  showPowerBi?: boolean;
};

export function Roadmaps({
  joinedDomains,
  abandonedDomains,
  hasProgramMembership,
  showDatabricks = false,
  showDsArchitect = false,
  showPowerBi = false,
}: RoadmapsProps) {
  const joined = new Set(joinedDomains);
  const abandoned = new Set(abandonedDomains);
  const showProgramPrepKit = isProgramEnabled();

  return (
    <>
      <section id="domains" className={HUB_SECTION_CLASS}>
        <div className={HUB_CONTAINER_CLASS}>
          <h2 className="font-heading text-xl font-semibold uppercase text-[#03535F]">
            CHALLENGE TRACKS
          </h2>
          <ul className={cn("mt-4", HUB_CARD_GRID_CLASS)}>
            {ROADMAPS.map(({ domain, label, path }) => {
              const isJoined = joined.has(domain);
              const isAbandoned = abandoned.has(domain);
              const href = isJoined
                ? path
                : isAbandoned
                  ? path
                  : `/register?domain=${domain}`;
              const ctaLabel = isJoined
                ? "Continue"
                : isAbandoned
                  ? "View status"
                  : "Join";
              return (
                <li
                  key={domain}
                  className={cn(
                    "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5",
                    HUB_CARD_HOVER_CLASS,
                  )}
                >
                  <p className="font-inter font-bold text-black">{label}</p>
                  <p className="mt-1 flex-1 text-sm text-[#4B4B4B]">
                    60-day challenge track
                  </p>
                  <Link href={href} className={cn(HUB_CARD_CTA_CLASS, "mt-4")}>
                    {ctaLabel}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {showProgramPrepKit ? (
        <section
          id="prep-kit"
          className={cn(HUB_SECTION_CLASS, "py-2 sm:py-4")}
        >
          <div className={HUB_CONTAINER_CLASS}>
            <h2 className="font-heading text-xl font-semibold uppercase text-[#03535F]">
              Prep Kit
            </h2>
            {/* Wraps by breakpoint — never a horizontal scroller. 1 col on
              mobile, 2 at sm, 3 at lg, all 4 inline at xl. */}
            <div className={cn("mt-4", HUB_CARD_GRID_CLASS)}>
              <div
                className={cn(
                  "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5 sm:p-6",
                  HUB_CARD_HOVER_CLASS,
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-inter text-lg font-bold text-black">
                    31 Days AI Cohort
                  </p>
                  <p className="mt-1 text-sm text-[#4B4B4B]">
                    Build and deploy a production-grade enterprise AI chatbot in
                    31 days.
                  </p>
                </div>
                <Link
                  href={
                    hasProgramMembership
                      ? `${PROGRAM_AI_COHORT_BASE}/dashboard`
                      : `${PROGRAM_AI_COHORT_BASE}/apply`
                  }
                  className={cn(HUB_CARD_CTA_CLASS, "mt-4")}
                >
                  {hasProgramMembership ? "Continue" : "Start Challenge"}
                </Link>
              </div>
              {showDatabricks ? (
                <div
                  className={cn(
                    "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5 sm:p-6",
                    HUB_CARD_HOVER_CLASS,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-inter text-lg font-bold text-black">
                      31 Days Databricks
                    </p>
                    <p className="mt-1 text-sm text-[#4B4B4B]">
                      Build a healthcare-claims Lakehouse on Databricks in 31
                      days.
                    </p>
                  </div>
                  <Link
                    href="/program/databricks"
                    className={cn(HUB_CARD_CTA_CLASS, "mt-4")}
                  >
                    Open
                  </Link>
                </div>
              ) : null}
              {showDsArchitect ? (
                <div
                  className={cn(
                    "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5 sm:p-6",
                    HUB_CARD_HOVER_CLASS,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-inter text-lg font-bold text-black">
                      10 Days Data Solutions Architect
                    </p>
                    <p className="mt-1 text-sm text-[#4B4B4B]">
                      Design AWS-first data and AI platforms in 10 days.
                    </p>
                  </div>
                  <Link
                    href="/program/ds-architect"
                    className={cn(HUB_CARD_CTA_CLASS, "mt-4")}
                  >
                    Open
                  </Link>
                </div>
              ) : null}
              {showPowerBi ? (
                <div
                  className={cn(
                    "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5 sm:p-6",
                    HUB_CARD_HOVER_CLASS,
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-inter text-lg font-bold text-black">
                      7 Days Power BI &amp; Analytics
                    </p>
                    <p className="mt-1 text-sm text-[#4B4B4B]">
                      Ship recruiter-grade Power BI dashboards in 7 days.
                    </p>
                  </div>
                  <Link
                    href="/program/powerbi"
                    className={cn(HUB_CARD_CTA_CLASS, "mt-4")}
                  >
                    Open
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
