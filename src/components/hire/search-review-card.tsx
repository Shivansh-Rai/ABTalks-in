"use client";

/**
 * The pause on a long first search: what Scout read from the brief, split into
 * Filters (who is in) and Criteria (the skills it ranks on), with a count of
 * matching candidates. Nothing runs until the recruiter presses Run search.
 *
 * Display only. The spec comes from the Gemini brief parse the composer already
 * makes; editing goes through the existing Edit filters dialog.
 */
import { Fragment, type ReactNode } from "react";
import { ListFilter, Sparkles } from "lucide-react";
import { canonicalSkillName } from "@/lib/skill-catalog";
import type { JobSpec } from "@/lib/validations/hire";

export type ReviewCount =
  | { state: "loading" }
  | { state: "done"; value: number; partial: boolean }
  | { state: "error" };

type Props = {
  spec: JobSpec;
  count: ReviewCount;
  pending: boolean;
  onEdit: () => void;
  onRun: () => void;
  onReset: () => void;
};

const WORK_MODE: Record<string, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  FLEXIBLE: "Flexible",
};

/** Years as a recruiter would say them. Null for none, or for "evidence only". */
function experienceLabel(spec: JobSpec): string | null {
  const lo = spec.minExperience;
  const hi = spec.maxExperience;
  if (lo == null && hi == null) return null;
  if (lo === 0 && (hi ?? 0) >= 50) return null;
  if (lo != null && (hi == null || hi >= 50)) return `${lo}+ years`;
  if (lo == null && hi != null) return `Up to ${hi} years`;
  if (lo === hi) return `${lo} years`;
  return `${lo} to ${hi} years`;
}

function skillLabel(raw: string): string {
  const name = canonicalSkillName(raw);
  return name === name.toLowerCase()
    ? name.charAt(0).toUpperCase() + name.slice(1)
    : name;
}

function countLabel(count: ReviewCount): string | null {
  if (count.state !== "done") return null;
  const n = count.value.toLocaleString("en-IN");
  const noun = count.value === 1 ? "match" : "matches";
  return count.partial ? `(at least ${n} ${noun})` : `(${n} ${noun})`;
}

export function SearchReviewCard({
  spec,
  count,
  pending,
  onEdit,
  onRun,
  onReset,
}: Props) {
  const title = spec.title?.trim() || null;
  const city = spec.locationCity?.trim();
  const showCity = Boolean(city) && city !== "Any" && spec.workMode !== "REMOTE";
  const place = showCity
    ? city!
    : spec.workMode
      ? WORK_MODE[spec.workMode] ?? null
      : null;
  const years = experienceLabel(spec);

  // Everything the sentence does not name goes behind "+N more filters".
  const more: string[] = [];
  if (showCity && spec.workMode) more.push("Work mode");
  if (spec.seniority) more.push("Seniority");
  if (spec.employmentType) more.push("Employment type");
  if (spec.noticePeriodDays != null) more.push("Notice period");
  if (spec.requiresDegree != null) more.push("Degree");
  if (spec.salaryMin != null || spec.salaryMax != null) more.push("Budget");

  const sentence: ReactNode[] = [];
  if (title) sentence.push(<span className="hire-filter-chip">{title}</span>);
  if (place) {
    sentence.push(<span className="hire-review__word">in</span>);
    sentence.push(<span className="hire-filter-chip">{place}</span>);
  }
  if (years) {
    sentence.push(<span className="hire-review__word">with</span>);
    sentence.push(<span className="hire-filter-chip">{years}</span>);
    sentence.push(<span className="hire-review__word">of experience</span>);
  }
  if (more.length > 0) {
    sentence.push(
      <button
        type="button"
        className="hire-filter-chip hire-filter-chip--more hire-review__more"
        title={more.join(", ")}
        onClick={onEdit}
      >
        +{more.length} more {more.length === 1 ? "filter" : "filters"}
      </button>,
    );
  }

  const skills = spec.mustHaveStack ?? [];
  const counted = countLabel(count);

  return (
    <div className="hire-review" role="group" aria-label="Review this search">
      <section className="hire-review__panel">
        <div className="hire-review__head">
          <p className="hire-review__lead">
            I&apos;ve set these{" "}
            <span className="hire-review__tag">
              <ListFilter className="hire-review__icon" aria-hidden="true" />
              Filters
            </span>{" "}
            based on what you&apos;re looking for
            {count.state === "loading" && (
              <span
                className="hire-review__count-skel"
                role="status"
                aria-label="Counting matching candidates"
              />
            )}
            {counted && (
              <span className="hire-review__count" role="status">
                {" "}
                {counted}
              </span>
            )}
          </p>
          <button type="button" className="hire-review__edit" onClick={onEdit}>
            Edit filters
          </button>
        </div>
        {sentence.length > 0 ? (
          <div className="hire-review__chips">
            {sentence.map((node, i) => (
              <Fragment key={i}>{node}</Fragment>
            ))}
          </div>
        ) : (
          <p className="hire-review__empty">No filters set</p>
        )}
      </section>

      {skills.length > 0 && (
        <section className="hire-review__panel">
          <div className="hire-review__head">
            <p className="hire-review__lead">
              Added these{" "}
              <span className="hire-review__tag">
                <Sparkles className="hire-review__icon" aria-hidden="true" />
                Criteria
              </span>{" "}
              to rank your matches
            </p>
            <button type="button" className="hire-review__edit" onClick={onEdit}>
              Edit criteria
            </button>
          </div>
          <div className="hire-review__chips">
            {skills.map((s) => (
              <span key={s} className="hire-filter-chip">
                {skillLabel(s)}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="hire-review__actions">
        <button
          type="button"
          className="hire-review__reset"
          onClick={onReset}
          disabled={pending}
        >
          Reset search
        </button>
        <button
          type="button"
          className="hire-review__run"
          onClick={onRun}
          disabled={pending}
        >
          Run search
        </button>
      </div>
    </div>
  );
}
