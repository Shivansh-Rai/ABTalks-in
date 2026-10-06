import Link from "next/link";
import type { JobType, JobWorkMode } from "@prisma/client";
import { ArrowRight, Check } from "lucide-react";
import type { SectionStatus } from "@/features/profile/completeness";
import type { StageData } from "@/features/dashboard/get-stage-data";
import { cn } from "@/lib/utils";
import { ScoreDonut } from "./score-donut";
import { OpenToWorkBar } from "./open-to-work-bar";
import { JOB_TYPE_LABEL, WORK_MODE_LABEL } from "@/components/jobs/job-ui";
import { Accent, ArrowLink, PILL_SOLID, StageHeader } from "./stage-ui";

/** One open role, as the dashboard shows it. Plain data (Server → Server). */
export type DashboardJob = {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  workMode: JobWorkMode | null;
  type: JobType;
  skills: string[];
  /** The job's skills that are also on the candidate's profile. */
  matched: string[];
  postedLabel: string;
  /** Posted in the last 3 days. */
  isNew: boolean;
  applied: boolean;
};

type GetHiredPanelProps = {
  profile: StageData["profile"];
  jobs: DashboardJob[];
};

export function GetHiredPanel({ profile, jobs }: GetHiredPanelProps) {
  const { score, sections, openToWork } = profile;

  return (
    <div className="space-y-6">
      <StageHeader
        title="Let recruiters"
        accent="find you."
        sub="Your profile is where your proof comes together. Fill it in, then apply."
        aside={
          <>
            <OpenToWorkBar initial={openToWork} />
            <Link href="#build-skills" className={cn(PILL_SOLID, "cta-hop")}>
              Start building skills today
            </Link>
          </>
        }
      />

      <ScoreBreakdown score={score} sections={sections} />

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="font-heading text-xl font-bold text-black">
              Roles that <Accent>fit you</Accent>
            </h3>
            <p className="mt-1 text-sm text-[#4B4B4B]">Open now, ranked by how many of your skills they ask for.</p>
          </div>
          {jobs.length > 0 ? <ArrowLink href="/jobs">All jobs</ArrowLink> : null}
        </div>
        {jobs.length > 0 ? (
          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#4B4B4B]">No open roles right now. New ones show up here as soon as they&apos;re posted.</p>
        )}
      </section>
    </div>
  );
}

function ScoreBreakdown({ score, sections }: { score: number; sections: SectionStatus[] }) {
  // Up next: the incomplete section with the most still to earn.
  const next = sections
    .filter((s) => !s.complete)
    .sort((a, b) => b.weight * (1 - b.fraction) - a.weight * (1 - a.fraction))[0];

  return (
    <section>
      <h3 className="font-heading text-xl font-bold text-black">
        What makes up your <Accent>score</Accent>
      </h3>
      <ScoreDonut score={score} sections={sections} nextKey={next?.key ?? null} />
    </section>
  );
}

/** Descriptions are recruiter-written markdown-ish text; show it as one plain paragraph. */
function plainExcerpt(text: string): string {
  return text
    .replace(/[#*_`>|]+/g, " ")
    .replace(/^\s*[-•]\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function JobCard({ job }: { job: DashboardJob }) {
  const meta = [
    job.location,
    job.workMode ? WORK_MODE_LABEL[job.workMode] : null,
    JOB_TYPE_LABEL[job.type],
  ].filter((v): v is string => Boolean(v));
  const excerpt = plainExcerpt(job.description);
  const matched = new Set(job.matched);
  // Matching skills first, so the reason to apply is the first thing you see.
  const skills = [...job.matched, ...job.skills.filter((sk) => !matched.has(sk))];

  return (
    <article className="group relative flex flex-col border border-[#E6E9E9] bg-white">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center bg-[#03535F] font-heading text-base font-bold text-white"
              aria-hidden="true"
            >
              {job.company.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#353535]">{job.company}</p>
              <p className="text-[11px] text-[#8F8F8F]">{job.postedLabel}</p>
            </div>
          </div>
          {job.isNew ? (
            <span className="shrink-0 bg-[#FFF3D6] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8A6100]">New</span>
          ) : null}
        </div>

        <h4 className="mt-4 font-heading text-xl font-bold leading-snug text-black">
          {/* Stretched link: the whole card opens the role. */}
          <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 group-hover:text-[#03535F]">
            {job.title}
          </Link>
        </h4>
        <p className="mt-1 text-[13px] text-[#4B4B4B]">{meta.join(" · ")}</p>

        {job.skills.length > 0 ? (
          <p className={cn("mt-4 text-[13px] font-semibold", job.matched.length > 0 ? "text-[#03535F]" : "text-[#8F8F8F]")}>
            {job.matched.length > 0
              ? `You have ${job.matched.length} of ${job.skills.length} skills they want`
              : "Add these skills to your profile to stand out"}
          </p>
        ) : null}
        {skills.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.slice(0, 5).map((skill) =>
              matched.has(skill) ? (
                <span key={skill} className="inline-flex items-center gap-1 bg-[#DDF7EE] px-2 py-1 text-[11px] font-semibold text-[#03535F]">
                  <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                  {skill}
                </span>
              ) : (
                <span key={skill} className="border border-[#E0E5E5] px-2 py-1 text-[11px] font-medium text-[#6B6B6B]">
                  {skill}
                </span>
              ),
            )}
            {skills.length > 5 ? <span className="px-1 py-1 text-[11px] text-[#8F8F8F]">+{skills.length - 5}</span> : null}
          </div>
        ) : null}

        {excerpt ? <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[#4B4B4B]">{excerpt}</p> : null}
      </div>

      {job.applied ? (
        <div className="flex h-12 items-center justify-center gap-1.5 border-t border-[#E6E9E9] bg-[#F4FBF8] text-sm font-semibold text-[#197E23]">
          <Check aria-hidden="true" className="size-4" />
          Applied
        </div>
      ) : (
        <div className="flex h-12 items-center justify-between bg-[#03535F] px-5 text-sm font-semibold text-white transition-colors group-hover:bg-[#076573]">
          Apply now
          <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
        </div>
      )}
    </article>
  );
}
