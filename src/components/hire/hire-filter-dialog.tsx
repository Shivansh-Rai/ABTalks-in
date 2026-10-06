"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  talentEmploymentTypeSchema,
  talentWorkModeSchema,
  type JobSpec,
} from "@/lib/validations/hire";

const WORK_MODE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "ONSITE", label: "Onsite" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" },
  { value: "FLEXIBLE", label: "Flexible" },
] as const;

const EMPLOYMENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "FULL_TIME", label: "Full-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "FREELANCE", label: "Freelance" },
] as const;

const POPULAR_ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Developer",
  "Data Scientist / AI Engineer",
  "Mobile Developer (React Native / iOS / Android)",
  "DevOps / Cloud Engineer",
  "UI/UX Designer",
  "Product Manager",
  "QA / Automation Engineer",
] as const;

const POPULAR_LOCATIONS = [
  "Any / Remote",
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Chandigarh",
  "Remote - India",
  "Remote - Global",
] as const;

/**
 * Quick bands under the experience slider. The slider itself covers any other
 * span, so there is no "Any experience" preset — that is the full 0–15 range.
 * `max: "50"` is the schema's open-ended sentinel (see `isSentinelYears`).
 */
const EXPERIENCE_PRESETS = [
  { label: "Fresher", min: "0", max: "1" },
  { label: "Junior", min: "1", max: "3" },
  { label: "Mid", min: "3", max: "5" },
  { label: "Senior", min: "5", max: "8" },
  { label: "Lead", min: "8", max: "50" },
] as const;

/** Top of the slider track. Dragging here means "no upper bound". */
const EXPERIENCE_CEILING = 15;

const SUGGESTED_SKILLS = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Java",
  "Go",
  "AWS",
  "Docker",
  "PostgreSQL",
  "MongoDB",
  "Tailwind CSS",
  "GraphQL",
  "Kubernetes",
] as const;

export type HireFilterDraft = {
  title: string;
  skills: string[];
  locationCity: string;
  minExperience: string;
  maxExperience: string;
  workMode: string;
  employmentType: string;
};

const EMPTY_DRAFT: HireFilterDraft = {
  title: "",
  skills: [],
  locationCity: "",
  minExperience: "",
  maxExperience: "",
  workMode: "",
  employmentType: "",
};

function parseOptionalInt(raw: string, min: number, max: number): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
}

function extraRecord(spec: JobSpec): Record<string, unknown> {
  return spec.extra && typeof spec.extra === "object" && spec.extra !== null
    ? (spec.extra as Record<string, unknown>)
    : {};
}

/** Sentinel 0–50 years means "evidence only", not a real band — leave blank. */
function isSentinelYears(spec: JobSpec): boolean {
  return spec.minExperience === 0 && (spec.maxExperience ?? 0) >= 50;
}

/**
 * 0–0 budget is "not specified". Budget has no control in this dialog — Scout
 * sets it from the brief — but the summary still counts it.
 */
function isUnsetSalary(spec: JobSpec): boolean {
  return (
    spec.salaryMax == null ||
    (spec.salaryMax === 0 && (spec.salaryMin == null || spec.salaryMin === 0))
  );
}

export function specToFilterDraft(spec: JobSpec): HireFilterDraft {
  const city = spec.locationCity?.trim() ?? "";
  return {
    title: spec.title?.trim() ?? "",
    skills: [...(spec.mustHaveStack ?? [])],
    locationCity: !city || city === "Any" ? "" : city,
    minExperience:
      isSentinelYears(spec) || spec.minExperience == null
        ? ""
        : String(spec.minExperience),
    maxExperience:
      isSentinelYears(spec) || spec.maxExperience == null
        ? ""
        : String(spec.maxExperience),
    workMode: spec.workMode ?? "",
    employmentType: spec.employmentType ?? "",
  };
}

export function mergeFilterDraft(current: JobSpec, draft: HireFilterDraft): JobSpec {
  const skills = draft.skills.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const workMode = talentWorkModeSchema.safeParse(draft.workMode);
  const employmentType = talentEmploymentTypeSchema.safeParse(draft.employmentType);

  // `salaryMin` / `salaryMax` and `extra.openToWork` are deliberately absent:
  // this dialog has no budget or availability control, so whatever Scout parsed
  // from the brief passes through `...current` untouched.
  return {
    ...current,
    title: draft.title.trim() || undefined,
    mustHaveStack: skills.length ? skills : undefined,
    locationCity: draft.locationCity.trim() || null,
    minExperience: parseOptionalInt(draft.minExperience, 0, 50),
    maxExperience: parseOptionalInt(draft.maxExperience, 0, 50),
    workMode: workMode.success ? workMode.data : null,
    employmentType: employmentType.success ? employmentType.data : null,
  };
}

/** Role, first 1–2 skills, city — then a +N count for the rest. */
export function filterSummary(spec: JobSpec): { chips: string[]; more: number } {
  const chips: string[] = [];
  if (spec.title?.trim()) chips.push(spec.title.trim());
  const skills = spec.mustHaveStack ?? [];
  chips.push(...skills.slice(0, 2));
  const city = spec.locationCity?.trim();
  if (city && city !== "Any") chips.push(city);

  let more = Math.max(0, skills.length - 2);
  if (!isSentinelYears(spec) && (spec.minExperience != null || spec.maxExperience != null)) {
    more += 1;
  }
  if (spec.workMode) more += 1;
  if (spec.employmentType) more += 1;
  if (!isUnsetSalary(spec)) more += 1;
  if (extraRecord(spec).openToWork === true) more += 1;
  return { chips, more };
}

/** Draft years → slider handle positions. Blank means the open end. */
function draftToYears(draft: HireFilterDraft): { lo: number; hi: number } {
  const rawLo = parseOptionalInt(draft.minExperience, 0, 50);
  const rawHi = parseOptionalInt(draft.maxExperience, 0, 50);
  const lo = rawLo == null ? 0 : Math.min(rawLo, EXPERIENCE_CEILING);
  const hi = rawHi == null ? EXPERIENCE_CEILING : Math.min(rawHi, EXPERIENCE_CEILING);
  return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
}

/** Handle positions → draft years. Full span is "any"; the top is open-ended. */
function yearsToDraft(lo: number, hi: number): { min: string; max: string } {
  if (lo <= 0 && hi >= EXPERIENCE_CEILING) return { min: "", max: "" };
  return { min: String(lo), max: hi >= EXPERIENCE_CEILING ? "50" : String(hi) };
}

function experienceLabel(lo: number, hi: number): string {
  if (lo <= 0 && hi >= EXPERIENCE_CEILING) return "Any experience";
  if (hi >= EXPERIENCE_CEILING) return `${lo}+ yrs`;
  if (lo === hi) return `${lo} yrs`;
  return `${lo} – ${hi} yrs`;
}

function countActive(draft: HireFilterDraft): number {
  let n = 0;
  if (draft.title.trim()) n += 1;
  if (draft.skills.length) n += 1;
  if (draft.locationCity.trim()) n += 1;
  if (draft.minExperience || draft.maxExperience) n += 1;
  if (draft.workMode) n += 1;
  if (draft.employmentType) n += 1;
  return n;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spec: JobSpec;
  pending: boolean;
  onApply: (next: JobSpec) => void;
};

export function HireFilterDialog({
  open,
  onOpenChange,
  spec,
  pending,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<HireFilterDraft>(() => specToFilterDraft(spec));
  const [skillText, setSkillText] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(specToFilterDraft(spec));
      setSkillText("");
    }
  }, [open, spec]);

  function withAddedSkills(base: HireFilterDraft, raw: string): HireFilterDraft {
    const pieces = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return base;
    const next = [...base.skills];
    for (const p of pieces) {
      if (next.length >= 20) break;
      if (next.some((s) => s.toLowerCase() === p.toLowerCase())) continue;
      next.push(p);
    }
    return { ...base, skills: next };
  }

  function addSkill(raw: string) {
    setDraft((d) => withAddedSkills(d, raw));
    setSkillText("");
  }

  const years = draftToYears(draft);

  function setYears(lo: number, hi: number) {
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    const next = yearsToDraft(a, b);
    setDraft((d) => ({ ...d, minExperience: next.min, maxExperience: next.max }));
  }

  const activeCount = countActive(draft);
  const trackLeft = (years.lo / EXPERIENCE_CEILING) * 100;
  const trackWidth = ((years.hi - years.lo) / EXPERIENCE_CEILING) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hire-app hire-filter-dialog sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            Edit filters
            {activeCount > 0 && (
              <span className="hire-filter-count">{activeCount} active</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Empty means any. Drag the handles to set a range.
          </DialogDescription>
        </DialogHeader>

        <form
          className="hire-filter-form"
          onSubmit={(e) => {
            e.preventDefault();
            const next = withAddedSkills(draft, skillText);
            setDraft(next);
            setSkillText("");
            onApply(mergeFilterDraft(spec, next));
          }}
        >
          {/* Role — free text with a datalist, plus one-tap popular roles */}
          <div className="hire-filter-section hire-filter-field">
            <span>Target role</span>
            <input
              type="text"
              list="hire-popular-roles"
              value={draft.title}
              maxLength={200}
              placeholder="Select or type role (e.g. Frontend Engineer)"
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <datalist id="hire-popular-roles">
              {POPULAR_ROLES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <div className="hire-filter-pills">
              {POPULAR_ROLES.slice(0, 4).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="hire-filter-pill"
                  aria-pressed={draft.title === r}
                  onClick={() =>
                    setDraft((d) => ({ ...d, title: d.title === r ? "" : r }))
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Skills — tag field with removable chips */}
          <fieldset className="hire-filter-section hire-filter-field">
            <legend>Must-have skills</legend>
            <div className="hire-filter-tagbox">
              {draft.skills.map((s) => (
                <span key={s} className="hire-filter-chip">
                  {s}
                  <button
                    type="button"
                    className="hire-filter-chip__x"
                    aria-label={`Remove ${s}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        skills: d.skills.filter((x) => x !== s),
                      }))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                className="hire-filter-tagbox__input"
                value={skillText}
                maxLength={60}
                placeholder={
                  draft.skills.length ? "Add another" : "Type a skill, press Enter"
                }
                onChange={(e) => setSkillText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSkill(skillText);
                  }
                  if (e.key === "Backspace" && !skillText && draft.skills.length) {
                    setDraft((d) => ({ ...d, skills: d.skills.slice(0, -1) }));
                  }
                }}
                onBlur={() => {
                  if (skillText.trim()) addSkill(skillText);
                }}
              />
            </div>
            <div className="hire-filter-suggestions">
              <span className="hire-filter-suggestions__label">Suggested</span>
              <div className="hire-filter-suggestions__list">
                {SUGGESTED_SKILLS.filter(
                  (s) =>
                    !draft.skills.some(
                      (existing) => existing.toLowerCase() === s.toLowerCase()
                    )
                )
                  .slice(0, 8)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="hire-filter-pill"
                      onClick={() => addSkill(s)}
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            </div>
          </fieldset>

          {/* Experience — dual-handle range over 0..15+, with quick bands */}
          <div className="hire-filter-section hire-filter-field">
            <div className="hire-filter-legendrow">
              <span className="hire-filter-field__label">Experience</span>
              <span className="hire-filter-readout" aria-live="polite">
                {experienceLabel(years.lo, years.hi)}
              </span>
            </div>
            <div className="hire-filter-range">
              <span className="hire-filter-range__track" aria-hidden="true" />
              <span
                className="hire-filter-range__fill"
                aria-hidden="true"
                style={{ left: `${trackLeft}%`, width: `${trackWidth}%` }}
              />
              <input
                type="range"
                min={0}
                max={EXPERIENCE_CEILING}
                step={1}
                value={years.lo}
                aria-label="Minimum years of experience"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setYears(Number(e.target.value), years.hi)
                }
              />
              <input
                type="range"
                min={0}
                max={EXPERIENCE_CEILING}
                step={1}
                value={years.hi}
                aria-label="Maximum years of experience"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setYears(years.lo, Number(e.target.value))
                }
              />
            </div>
            <div className="hire-filter-ticks" aria-hidden="true">
              <span>0</span>
              <span>5</span>
              <span>10</span>
              <span>15+</span>
            </div>
            <div className="hire-filter-pills">
              {EXPERIENCE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="hire-filter-pill"
                  aria-pressed={
                    draft.minExperience === p.min && draft.maxExperience === p.max
                  }
                  onClick={() =>
                    setDraft((d) =>
                      d.minExperience === p.min && d.maxExperience === p.max
                        ? { ...d, minExperience: "", maxExperience: "" }
                        : { ...d, minExperience: p.min, maxExperience: p.max }
                    )
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location — free text with a datalist, plus popular cities */}
          <div className="hire-filter-section hire-filter-field">
            <span>Location</span>
            <input
              type="text"
              list="hire-popular-locations"
              value={draft.locationCity}
              maxLength={80}
              placeholder="Select or type city (e.g. Bengaluru, Remote)"
              onChange={(e) =>
                setDraft((d) => ({ ...d, locationCity: e.target.value }))
              }
            />
            <datalist id="hire-popular-locations">
              {POPULAR_LOCATIONS.map((loc) => (
                <option key={loc} value={loc === "Any / Remote" ? "" : loc}>
                  {loc}
                </option>
              ))}
            </datalist>
            <div className="hire-filter-pills">
              {POPULAR_LOCATIONS.slice(1, 6).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className="hire-filter-pill"
                  aria-pressed={draft.locationCity === loc}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      locationCity: d.locationCity === loc ? "" : loc,
                    }))
                  }
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Work mode + employment type — one tap each, "Any" clears */}
          <fieldset className="hire-filter-section hire-filter-field">
            <legend>Work mode</legend>
            <div className="hire-filter-pills">
              {WORK_MODE_OPTIONS.map((o) => (
                <button
                  key={o.value || "any"}
                  type="button"
                  className="hire-filter-pill"
                  aria-pressed={draft.workMode === o.value}
                  onClick={() => setDraft((d) => ({ ...d, workMode: o.value }))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="hire-filter-section hire-filter-field">
            <legend>Employment type</legend>
            <div className="hire-filter-pills">
              {EMPLOYMENT_OPTIONS.map((o) => (
                <button
                  key={o.value || "any"}
                  type="button"
                  className="hire-filter-pill"
                  aria-pressed={draft.employmentType === o.value}
                  onClick={() =>
                    setDraft((d) => ({ ...d, employmentType: o.value }))
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="hire-filter-actions">
            <button
              type="button"
              className="hire-filter-reset"
              disabled={pending}
              onClick={() => {
                setDraft({ ...EMPTY_DRAFT });
                setSkillText("");
              }}
            >
              Reset all
            </button>
            <button type="submit" className="hire-filter-apply" disabled={pending}>
              {pending ? "Applying…" : "Apply filters"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
