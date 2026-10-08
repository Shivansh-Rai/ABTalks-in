export const PRACTICE_BASE = "/practice";

/** Every coding practice challenge. Add a slug here and a content folder. */
export const PRACTICE_PROGRAM_SLUGS = ["arrays-strings"] as const;
export type PracticeProgramSlug = (typeof PRACTICE_PROGRAM_SLUGS)[number];

export function isPracticeProgramSlug(
  value: string,
): value is PracticeProgramSlug {
  return (PRACTICE_PROGRAM_SLUGS as readonly string[]).includes(value);
}

/**
 * Day boundaries for coding practice: a new day opens at 00:00 UTC, which is
 * 05:30 IST. Read this, never hard-code the zone. It is a deliberate exception
 * to the IST boundary the other challenge tracks use.
 */
export const PRACTICE_TZ = "UTC";

export const PRACTICE_QUESTIONS_PER_DAY = 2;
export const PRACTICE_MAX_CODE_CHARS = 50_000;
export const PRACTICE_RUN_COOLDOWN_MS = 3_000;
export const PRACTICE_SUBMIT_COOLDOWN_MS = 10_000;

export function cohortSlugFor(programSlug: string): string {
  return `${programSlug}-open`;
}

/** Deterministic Activity id for one question, e.g. `act_dsa_as_d01_q1`. */
export function practiceActivityId(
  idCode: string,
  day: number,
  slot: number,
): string {
  return `act_dsa_${idCode}_d${String(day).padStart(2, "0")}_q${slot}`;
}
