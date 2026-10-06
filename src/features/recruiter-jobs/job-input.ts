import { z } from "zod";
import { JobType, JobWorkMode } from "@prisma/client";
import {
  JOB_SKILL_MAX_COUNT,
  JOB_SKILL_MAX_LEN,
  normalizeSkills,
} from "./lifecycle";

/** Prepend https:// when a pasted host/path has no scheme. Empty stays empty. */
export function normalizeApplyUrl(raw: unknown): string {
  if (raw == null) return "";
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Coerce pasted experience values ("2", "2 years", 2.0) to an int or null.
 * Returns NaN for values that cannot be coerced so Zod can reject them.
 */
export function coerceMinExperience(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : Number.NaN;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const leading = trimmed.match(/^(\d+)/);
    if (leading) return Number(leading[1]);
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

function normalizeSkillsInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return normalizeSkills(raw.map((item) => String(item ?? "")));
}

const workModeSchema = z.nativeEnum(JobWorkMode, {
  error: "Pick a valid work mode.",
});
const opportunityTypeSchema = z.nativeEnum(JobType, {
  error: "Pick a valid opportunity type.",
});

export const createJobInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Add a job title.")
    .max(200, "Title must be 200 characters or fewer."),
  description: z
    .string()
    .trim()
    .min(1, "Add a job description.")
    .max(20000, "Description is too long (max 20,000 characters)."),
  location: z
    .string()
    .trim()
    .max(200, "Location must be 200 characters or fewer.")
    .optional()
    .default(""),
  workMode: workModeSchema,
  opportunityType: opportunityTypeSchema,
  // Normalize (trim / truncate / dedupe / cap) before validate so pasted
  // skill blobs do not hard-fail with a generic "Invalid input".
  skills: z.preprocess(
    normalizeSkillsInput,
    z
      .array(z.string().max(JOB_SKILL_MAX_LEN))
      .max(JOB_SKILL_MAX_COUNT)
      .default([]),
  ),
  minExperience: z.preprocess(
    coerceMinExperience,
    z
      .number({ error: "Minimum experience must be a whole number." })
      .int("Minimum experience must be a whole number.")
      .min(0, "Minimum experience cannot be negative.")
      .max(50, "Minimum experience must be 50 years or fewer.")
      .nullable(),
  ).optional(),
  applyExternalUrl: z.preprocess(
    normalizeApplyUrl,
    z.union([
      z.literal(""),
      z
        .string()
        .url("Enter a valid apply URL (e.g. https://company.com/careers).")
        .max(2048, "Apply URL is too long."),
    ]),
  )
    .optional()
    .default(""),
});

export const updateJobInputSchema = createJobInputSchema
  .partial()
  .extend({ jobId: z.string().min(1, "Missing job id.") });

export type ParsedCreateJobInput = z.infer<typeof createJobInputSchema>;
export type ParsedUpdateJobInput = z.infer<typeof updateJobInputSchema>;

export function jobInputErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
