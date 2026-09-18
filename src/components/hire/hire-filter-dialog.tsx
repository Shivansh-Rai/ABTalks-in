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
  { value: "", label: "Not set" },
  { value: "ONSITE", label: "Onsite" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" },
  { value: "FLEXIBLE", label: "Flexible" },
] as const;

const EMPLOYMENT_OPTIONS = [
  { value: "", label: "Not set" },
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
  "Mobile Developer (React Native / iOS / Android)",
  "DevOps / Cloud Engineer",
  "Data Scientist / AI Engineer",
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

const EXPERIENCE_OPTIONS = [
  { label: "Any experience", min: "", max: "" },
  { label: "Fresher / Entry (0-1 yrs)", min: "0", max: "1" },
  { label: "Junior (1-3 yrs)", min: "1", max: "3" },
  { label: "Mid-level (3-5 yrs)", min: "3", max: "5" },
  { label: "Senior (5-8 yrs)", min: "5", max: "8" },
  { label: "Lead / Principal (8+ yrs)", min: "8", max: "50" },
] as const;

const BUDGET_OPTIONS = [
  { value: "", label: "No budget limit" },
  { value: "6", label: "Up to ₹6 LPA" },
  { value: "10", label: "Up to ₹10 LPA" },
  { value: "15", label: "Up to ₹15 LPA" },
  { value: "20", label: "Up to ₹20 LPA" },
  { value: "30", label: "Up to ₹30 LPA" },
  { value: "50", label: "Up to ₹50 LPA" },
  { value: "75", label: "Up to ₹75 LPA" },
  { value: "100", label: "₹1 Cr+ (₹100 LPA)" },
] as const;

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
  salaryMaxLpa: string;
  openToWork: boolean;
};

const EMPTY_DRAFT: HireFilterDraft = {
  title: "",
  skills: [],
  locationCity: "",
  minExperience: "",
  maxExperience: "",
  workMode: "",
  employmentType: "",
  salaryMaxLpa: "",
  openToWork: false,
};

function rupeesToLpa(rupees: number): number {
  const lakhs = rupees / 100_000;
  return Number.isInteger(lakhs) ? lakhs : Math.round(lakhs * 10) / 10;
}

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

/** 0–0 budget is "not specified". */
function isUnsetSalary(spec: JobSpec): boolean {
  return (
    spec.salaryMax == null ||
    (spec.salaryMax === 0 && (spec.salaryMin == null || spec.salaryMin === 0))
  );
}

export function specToFilterDraft(spec: JobSpec): HireFilterDraft {
  const extra = extraRecord(spec);
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
    salaryMaxLpa: isUnsetSalary(spec) ? "" : String(rupeesToLpa(spec.salaryMax!)),
    openToWork: extra.openToWork === true,
  };
}

export function mergeFilterDraft(current: JobSpec, draft: HireFilterDraft): JobSpec {
  const extra = { ...extraRecord(current) };
  if (draft.openToWork) extra.openToWork = true;
  else delete extra.openToWork;

  const skills = draft.skills.map((s) => s.trim()).filter(Boolean).slice(0, 20);
  const lpaRaw = draft.salaryMaxLpa.trim();
  const lpa = lpaRaw === "" ? null : Number(lpaRaw);
  const salaryMax =
    lpa == null || !Number.isFinite(lpa) || lpa <= 0
      ? null
      : Math.round(lpa * 100_000);
  const workMode = talentWorkModeSchema.safeParse(draft.workMode);
  const employmentType = talentEmploymentTypeSchema.safeParse(draft.employmentType);

  return {
    ...current,
    title: draft.title.trim() || undefined,
    mustHaveStack: skills.length ? skills : undefined,
    locationCity: draft.locationCity.trim() || null,
    minExperience: parseOptionalInt(draft.minExperience, 0, 50),
    maxExperience: parseOptionalInt(draft.maxExperience, 0, 50),
    workMode: workMode.success ? workMode.data : null,
    employmentType: employmentType.success ? employmentType.data : null,
    salaryMax,
    extra,
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

  // Check which experience preset matches
  const currentExpPreset = EXPERIENCE_OPTIONS.find(
    (e) => e.min === draft.minExperience && e.max === draft.maxExperience
  ) ? `${draft.minExperience}-${draft.maxExperience}` : "custom";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="hire-app hire-filter-dialog sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>Edit filters</DialogTitle>
          <DialogDescription>
            Choose from popular options or customize fields. Empty means any.
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
          {/* Role / Designation with dropdown suggestions */}
          <div className="hire-filter-field">
            <span>Target Role</span>
            <div className="hire-filter-input-group">
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
            </div>
          </div>

          {/* Skills with tags and quick suggestions */}
          <fieldset className="hire-filter-field">
            <legend>Must-Have Skills</legend>
            {draft.skills.length > 0 && (
              <div className="hire-filter-skills">
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
              </div>
            )}
            <input
              type="text"
              value={skillText}
              maxLength={60}
              placeholder="Type skill & press Enter, or click suggestions below"
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
            {/* Quick Skill Suggestions */}
            <div className="hire-filter-suggestions">
              <span className="hire-filter-suggestions__label">Suggested:</span>
              <div className="hire-filter-suggestions__list">
                {SUGGESTED_SKILLS.filter(
                  (s) => !draft.skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
                ).slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="hire-filter-sugg-btn"
                    onClick={() => addSkill(s)}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          {/* Location with dropdown suggestions */}
          <div className="hire-filter-field">
            <span>Location</span>
            <div className="hire-filter-input-group">
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
            </div>
          </div>

          {/* Experience Range with preset dropdown */}
          <div className="hire-filter-field">
            <span>Experience Level</span>
            <select
              value={currentExpPreset}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") return;
                const found = EXPERIENCE_OPTIONS.find(
                  (opt) => `${opt.min}-${opt.max}` === val
                );
                if (found) {
                  setDraft((d) => ({
                    ...d,
                    minExperience: found.min,
                    maxExperience: found.max,
                  }));
                }
              }}
            >
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option
                  key={`${opt.min}-${opt.max}`}
                  value={`${opt.min}-${opt.max}`}
                >
                  {opt.label}
                </option>
              ))}
              {currentExpPreset === "custom" && (
                <option value="custom">Custom experience ({draft.minExperience || "0"} - {draft.maxExperience || "50+"} yrs)</option>
              )}
            </select>
          </div>

          <div className="hire-filter-row">
            <label className="hire-filter-field">
              <span>Work mode</span>
              <select
                value={draft.workMode}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, workMode: e.target.value }))
                }
              >
                {WORK_MODE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="hire-filter-field">
              <span>Employment type</span>
              <select
                value={draft.employmentType}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, employmentType: e.target.value }))
                }
              >
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Budget Ceiling dropdown */}
          <label className="hire-filter-field">
            <span>Budget Ceiling (CTC / Salary)</span>
            <select
              value={draft.salaryMaxLpa}
              onChange={(e) =>
                setDraft((d) => ({ ...d, salaryMaxLpa: e.target.value }))
              }
            >
              {BUDGET_OPTIONS.map((b) => (
                <option key={b.value || "none"} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>

          <label className="hire-filter-check">
            <input
              type="checkbox"
              checked={draft.openToWork}
              onChange={(e) =>
                setDraft((d) => ({ ...d, openToWork: e.target.checked }))
              }
            />
            Only candidates immediately open to work
          </label>

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
              Reset filters
            </button>
            <button type="submit" className="hire-filter-apply" disabled={pending}>
              {pending ? "Applying…" : "Apply Filters"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
