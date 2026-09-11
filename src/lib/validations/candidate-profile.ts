import { z } from "zod";
import {
  CandidateGender,
  CandidateLinkType,
  CandidatePersona,
  GradeType,
  OpportunityType,
} from "@prisma/client";
import { optionalPhoneSchema } from "@/lib/validations/phone";

/* ─── shared helpers ─────────────────────────────────────────────────────── */

/** Trim, then treat "" as absent. Sections send every field, so "" means clear. */
const emptyToNull = (s: unknown) => {
  if (typeof s !== "string") return s;
  const t = s.trim();
  return t === "" ? null : t;
};

const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().max(max).nullable().default(null));

const nullableUrl = z.preprocess(
  emptyToNull,
  z.string().url("Must be a valid URL").max(500).nullable().default(null),
);

/**
 * People and places are written with letters, not digits or punctuation soup.
 * Apostrophes, hyphens, periods and spaces stay legal — "D'Souza",
 * "Thiruvananthapuram", "Jammu & Kashmir" and "St. Xavier" are all real.
 */
const LETTERS_ONLY = /^[\p{L}][\p{L}\s.'\-&]*$/u;

const personName = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => v === "" || LETTERS_ONLY.test(v), {
      message: `${label} cannot contain numbers or symbols`,
    });

/** Optional place name: blank is fine, but if written it must read like a place. */
const nullablePlace = (max: number, label: string) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .max(max)
      .refine((v) => LETTERS_ONLY.test(v), {
        message: `${label} cannot contain numbers or symbols`,
      })
      .nullable()
      .default(null),
  );

const MONTH = z.coerce.number().int().min(1).max(12);
const YEAR = z.coerce.number().int().min(1950).max(2040);

const nullableMonth = z.preprocess(emptyToNull, MONTH.nullable().default(null));
const nullableYear = z.preprocess(emptyToNull, YEAR.nullable().default(null));

/** Only `collegeId` round-trips a real id — repeatable rows are replaced wholesale. */
const nullableCuid = z.preprocess(
  emptyToNull,
  z.string().cuid().nullable().default(null),
);

/**
 * GitHub is stored as a bare username on `CandidateProfile.githubUsername`.
 * The editor accepts either the handle or any form of profile URL; both land on
 * the handle. Adding a second `githubUrl` column for form convenience would
 * create a fifth place the same fact lives.
 */
export function normalizeGithubUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const urlish = /^(?:https?:\/\/)?(?:www\.)?github\.com\/(.*)$/i.exec(trimmed);
  if (urlish) {
    // Take the first path segment, dropping query/hash and any trailing path.
    candidate = (urlish[1] ?? "").split(/[/?#]/)[0] ?? "";
  } else if (trimmed.startsWith("@")) {
    candidate = trimmed.slice(1);
  }

  candidate = candidate.trim();
  if (!candidate) return null;
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(candidate)) {
    return null;
  }
  return candidate;
}

const githubField = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t === "" ? null : t;
}, z
  .string()
  .nullable()
  .default(null)
  .superRefine((value, ctx) => {
    if (value === null) return;
    if (normalizeGithubUsername(value) === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a GitHub username or profile URL",
      });
    }
  })
  .transform((value) => (value === null ? null : normalizeGithubUsername(value))));

/* ─── Basic information ──────────────────────────────────────────────────── */

/**
 * Basic information.
 *
 * Full name is the ONLY hard requirement here, because it is the only one of
 * these the candidate could not skip at /register. Everything else is optional
 * and filled in whenever the candidate wants — a half-filled profile is a real
 * state, not an error.
 */
export const basicInfoSchema = z.object({
  fullName: personName(200, "Full name").min(1, "Full name is required"),
  phone: optionalPhoneSchema,
  headline: nullableText(160),
  summary: nullableText(2000),
  locationCity: nullablePlace(120, "City"),
  locationRegion: nullablePlace(120, "State / region"),
  /** Stored as ISO-3166-1 alpha-2; the editor shows country NAMES and maps back. */
  countryCode: z.preprocess(
    emptyToNull,
    z
      .string()
      .length(2, "Pick a country from the list")
      .toUpperCase()
      .nullable()
      .default(null),
  ),
  gender: z.preprocess(
    emptyToNull,
    z.enum(CandidateGender).nullable().default(null),
  ),
  primaryPersona: z.enum(CandidatePersona),
});

export type BasicInfoInput = z.infer<typeof basicInfoSchema>;

/**
 * Nothing in the profile is mandatory except what /register already collected.
 * A section therefore has to tell an EMPTY row from a partial one: an empty row
 * is dropped silently (the editor always renders one blank card), while a row
 * with anything in it is kept exactly as typed.
 */
/**
 * A row that has been started still needs its ANCHOR — the one fact without
 * which the row cannot be stored or read back (a role with no employer and no
 * start date is not a role, and `CandidateExperience.startedOn` is NOT NULL).
 * This is not the same as a mandatory field: you are never forced to add a row.
 */
function requireAnchor(
  ctx: z.RefinementCtx,
  filled: boolean,
  path: string,
  message: string,
): void {
  if (filled) return;
  ctx.addIssue({ code: "custom", path: [path], message });
}

function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => {
    if (v === null || v === undefined || v === false) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
}

/** Education starts no earlier than 2000 and never in the future. */
export const EDUCATION_MIN_YEAR = 2000;
/** A course runs at most five years past the year it started. */
export const EDUCATION_MAX_SPAN_YEARS = 5;

/* ─── Experience ─────────────────────────────────────────────────────────── */

const experienceRowSchema = z
  .object({
    companyName: z.string().trim().max(200).default(""),
    title: z.string().trim().max(200).default(""),
    employmentType: nullableText(60),
    locationCity: nullablePlace(120, "Location"),
    startMonth: nullableMonth,
    startYear: nullableYear,
    endMonth: nullableMonth,
    endYear: nullableYear,
    isCurrent: z.coerce.boolean().default(false),
    description: nullableText(4000),
  })
  .superRefine((row, ctx) => {
    if (isBlankRow(row)) return;
    requireAnchor(ctx, row.companyName !== "", "companyName", "Add the employer");
    requireAnchor(
      ctx,
      row.startYear !== null,
      "startYear",
      "Add the year this role started",
    );
    // A role that is still running has no end date by definition.
    if (row.isCurrent) return;
    if (row.startYear === null || row.endYear === null) return;
    const start = row.startYear * 12 + (row.startMonth ?? 1);
    const end = row.endYear * 12 + (row.endMonth ?? 12);
    if (end < start) {
      ctx.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "This role cannot end before it started",
      });
    }
  });

export const experienceSectionSchema = z
  .object({
    hasNoWorkExperience: z.coerce.boolean().default(false),
    rows: z
      .array(experienceRowSchema)
      .max(25, "You can add up to 25 roles")
      .transform((rows) => rows.filter((r) => !isBlankRow(r))),
  })
  .transform((value) =>
    value.hasNoWorkExperience
      ? { hasNoWorkExperience: true, rows: [] as typeof value.rows }
      : { hasNoWorkExperience: false, rows: value.rows },
  );

export type ExperienceRowInput = z.infer<typeof experienceRowSchema>;

/* ─── Education ──────────────────────────────────────────────────────────── */

const educationRowSchema = z
  .object({
    institutionName: z.string().trim().max(200).default(""),
    collegeId: nullableCuid,
    degree: nullableText(160),
    fieldOfStudy: nullableText(160),
    startMonth: nullableMonth,
    startYear: nullableYear,
    endMonth: nullableMonth,
    graduationYear: nullableYear,
    isCurrent: z.coerce.boolean().default(false),
    gradeType: z.preprocess(
      emptyToNull,
      z.enum(GradeType).nullable().default(null),
    ),
    grade: nullableText(40),
    description: nullableText(4000),
  })
  .superRefine((row, ctx) => {
    if (isBlankRow(row)) return;
    requireAnchor(
      ctx,
      row.institutionName !== "",
      "institutionName",
      "Add the school or college",
    );
    const thisYear = new Date().getFullYear();
    if (row.startYear !== null) {
      if (row.startYear < EDUCATION_MIN_YEAR || row.startYear > thisYear) {
        ctx.addIssue({
          code: "custom",
          path: ["startYear"],
          message: `Start year must be between ${EDUCATION_MIN_YEAR} and ${thisYear}`,
        });
        return;
      }
    }
    // "Currently studying here" and an end year are mutually exclusive, and a
    // course that has not ended cannot have one.
    if (row.isCurrent) return;
    if (row.startYear === null || row.graduationYear === null) return;
    if (row.graduationYear > row.startYear + EDUCATION_MAX_SPAN_YEARS) {
      ctx.addIssue({
        code: "custom",
        path: ["graduationYear"],
        message: `End year cannot be more than ${EDUCATION_MAX_SPAN_YEARS} years after the start year`,
      });
      return;
    }
    const start = row.startYear * 12 + (row.startMonth ?? 1);
    const end = row.graduationYear * 12 + (row.endMonth ?? 12);
    if (end < start) {
      ctx.addIssue({
        code: "custom",
        path: ["graduationYear"],
        message: "End date cannot be before the start date",
      });
    }
  });

export const educationSectionSchema = z.object({
  rows: z
    .array(educationRowSchema)
    .max(15, "You can add up to 15 education entries")
    .transform((rows) => rows.filter((r) => !isBlankRow(r))),
});

export type EducationRowInput = z.infer<typeof educationRowSchema>;

/* ─── Projects ───────────────────────────────────────────────────────────── */

const projectRowSchema = z
  .object({
    title: z.string().trim().max(200).default(""),
    description: nullableText(4000),
    techStack: z
      .array(z.string().trim().min(1).max(60))
      .max(20, "You can add up to 20 tech stack entries")
      .default([]),
    repoUrl: nullableUrl,
    liveUrl: nullableUrl,
  })
  .superRefine((row, ctx) => {
    if (isBlankRow(row)) return;
    requireAnchor(ctx, row.title !== "", "title", "Add the project name");
  });

export const projectSectionSchema = z.object({
  rows: z
    .array(projectRowSchema)
    .max(25, "You can add up to 25 projects")
    .transform((rows) => rows.filter((r) => !isBlankRow(r))),
});

export type ProjectRowInput = z.infer<typeof projectRowSchema>;

/* ─── Skills ─────────────────────────────────────────────────────────────── */

/**
 * A claim is a skill id and nothing else.
 *
 * Self-rating was removed: it was the candidate grading themselves, it was
 * never evidence, and it competed for meaning with ABTalks Verified Skills —
 * which are derived from curriculum + completion in
 * features/profile/get-verified-skills.ts.
 */
const skillClaimSchema = z.object({
  skillId: z.string().cuid(),
});

export const skillSectionSchema = z.object({
  claims: z
    .array(skillClaimSchema)
    .max(60, "You can add up to 60 skills")
    .refine(
      (rows) => new Set(rows.map((r) => r.skillId)).size === rows.length,
      "Duplicate skill",
    ),
});

export type SkillClaimInput = z.infer<typeof skillClaimSchema>;

export const resolveSkillSchema = z.object({
  name: z.string().trim().min(1, "Skill name is required").max(80),
});

/* ─── Certifications ─────────────────────────────────────────────────────── */

const certificationRowSchema = z
  .object({
    name: z.string().trim().max(200).default(""),
    issuer: z.string().trim().max(200).default(""),
    issuedMonth: nullableMonth,
    issuedYear: nullableYear,
    expiresMonth: nullableMonth,
    expiresYear: nullableYear,
    credentialUrl: nullableUrl,
  })
  .superRefine((row, ctx) => {
    if (isBlankRow(row)) return;
    requireAnchor(ctx, row.name !== "", "name", "Add the certification name");
    // A certificate cannot have been issued in a month that has not happened.
    if (row.issuedYear !== null) {
      const now = new Date();
      const issued = row.issuedYear * 12 + (row.issuedMonth ?? 1);
      const current = now.getFullYear() * 12 + (now.getMonth() + 1);
      if (issued > current) {
        ctx.addIssue({
          code: "custom",
          path: ["issuedYear"],
          message: "The issue date cannot be in the future",
        });
        return;
      }
    }
    if (row.issuedYear === null || row.expiresYear === null) return;
    const issued = row.issuedYear * 12 + (row.issuedMonth ?? 1);
    const expires = row.expiresYear * 12 + (row.expiresMonth ?? 12);
    if (expires < issued) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresYear"],
        message: "This certificate cannot expire before it was issued",
      });
    }
  });

export type CertificationRowInput = z.infer<typeof certificationRowSchema>;

/**
 * Accomplishments saves the certification list and the awards prose together —
 * the section is one form with one Save, so it is one boundary.
 *
 * Verified Accomplishments are NOT in here: they are derived from platform
 * records and there is no write path for them by design.
 */
/** Product cap: ten is more than anyone reads, and a list is not a resume. */
export const MAX_CERTIFICATIONS = 10;

export const accomplishmentsSchema = z.object({
  rows: z
    .array(certificationRowSchema)
    .transform((rows) => rows.filter((r) => !isBlankRow(r)))
    .refine((rows) => rows.length <= MAX_CERTIFICATIONS, {
      message: `You can add up to ${MAX_CERTIFICATIONS} certifications`,
    }),
  awards: nullableText(4000),
});

export type AccomplishmentsInput = z.infer<typeof accomplishmentsSchema>;

/* ─── Links ──────────────────────────────────────────────────────────────── */

const extraLinkSchema = z
  .object({
    type: z.enum(CandidateLinkType),
    label: nullableText(80),
    url: z.string().trim().url("Must be a valid URL").max(500),
  })
  .superRefine((row, ctx) => {
    if (row.type === CandidateLinkType.OTHER && !row.label) {
      ctx.addIssue({
        code: "custom",
        path: ["label"],
        message: "Add a label for this link",
      });
    }
  });

export const linksSectionSchema = z.object({
  linkedinUrl: nullableUrl,
  githubUsername: githubField,
  portfolioUrl: nullableUrl,
  /**
   * Optional, and absent from the Links form since plan 106 moved the resume
   * into its own profile section. It stays in the schema so any older client
   * still round-trips it, but a Links save that omits it must NOT clear the
   * resume the candidate uploaded — see `saveLinks`.
   */
  resumeUrl: nullableUrl.optional(),
  extra: z.array(extraLinkSchema).max(15, "At most 15 additional links"),
});

export type ExtraLinkInput = z.infer<typeof extraLinkSchema>;
export type LinksInput = z.infer<typeof linksSectionSchema>;

/* ─── Career preferences ─────────────────────────────────────────────────── */

/**
 * Employment preference only. This section can never change recruiter
 * discoverability — that is `CandidateVisibility.searchableByRecruiters`, which
 * no field here touches.
 */
export const preferencesSchema = z.object({
  openToWork: z.coerce.boolean().default(false),
  preferredRoles: z
    .array(z.string().trim().min(1).max(120))
    .max(10, "At most 10 roles")
    .default([]),
  preferredLocations: z
    .array(z.string().trim().min(1).max(120))
    .max(10, "At most 10 locations")
    .default([]),
  opportunityTypes: z.array(z.enum(OpportunityType)).max(5).default([]),
  remotePreference: nullableText(40),
  willingToRelocate: z.coerce.boolean().default(false),
  noticePeriodDays: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(365).nullable().default(null),
  ),
  availableFromMonth: nullableMonth,
  availableFromYear: nullableYear,
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
