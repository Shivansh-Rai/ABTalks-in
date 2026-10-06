import type {
  ImportOutreachStage,
  ImportOutreachStop,
  ResumeImportStatus,
} from "@prisma/client";

/**
 * The claim-and-complete email sequence as pure decisions (plan 171).
 *
 * INVITE  — step 1 when the import is registered, step 2 seven days later if
 *           still unclaimed, then stop (NO_RESPONSE). Visibility is never
 *           touched: the profile stays searchable.
 * ONBOARD — step 1 as soon as they claim, step 2 five days later only if the
 *           profile is still incomplete, then stop. Complete at any point →
 *           stop (COMPLETE).
 *
 * At most 4 emails per person, whatever happens.
 */

export const MAX_OUTREACH_EMAILS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
export const INVITE_REMINDER_AFTER_MS = 7 * DAY_MS;
export const ONBOARD_REMINDER_AFTER_MS = 5 * DAY_MS;

/* ─── Completeness ───────────────────────────────────────────────────────── */

export type CompletenessKey = "phone" | "education" | "experience" | "skills" | "links";

/** Priority order: the first missing item is the one the last reminder names. */
export const COMPLETENESS_ORDER: readonly CompletenessKey[] = [
  "phone",
  "education",
  "experience",
  "skills",
  "links",
];

export type CompletenessInput = {
  phoneVerified: boolean;
  educationCount: number;
  experienceCount: number;
  hasNoWorkExperience: boolean;
  skillCount: number;
  githubUsername: string | null;
  linkedinUrl: string | null;
};

export type Completeness = { percent: number; missing: CompletenessKey[] };

export function profileCompleteness(p: CompletenessInput): Completeness {
  const done: Record<CompletenessKey, boolean> = {
    phone: p.phoneVerified,
    education: p.educationCount >= 1,
    experience: p.experienceCount >= 1 || p.hasNoWorkExperience,
    skills: p.skillCount >= 5,
    links: Boolean(p.githubUsername?.trim()) || Boolean(p.linkedinUrl?.trim()),
  };
  const missing = COMPLETENESS_ORDER.filter((k) => !done[k]);
  const percent = Math.round(((COMPLETENESS_ORDER.length - missing.length) / COMPLETENESS_ORDER.length) * 100);
  return { percent, missing };
}

/* ─── The next step ──────────────────────────────────────────────────────── */

export type OutreachTemplate =
  | "invite"
  | "invite_reminder"
  | "onboard_welcome"
  | "onboard_reminder";

export type OutreachRowState = {
  stage: ImportOutreachStage;
  step: number;
  sentCount: number;
};

export type OutreachFacts = {
  /** null when the import row no longer exists (an admin deleted it). */
  importStatus: ResumeImportStatus | null;
  registeredAt: Date | null;
  claimedAt: Date | null;
  completeness: Completeness;
};

export type OutreachAction =
  /** Send `template` now; afterwards wait until `nextAt`, or stop with `stopAfter`. */
  | {
      kind: "send";
      template: OutreachTemplate;
      step: number;
      nextAt: Date | null;
      stopAfter: ImportOutreachStop | null;
    }
  | { kind: "wait"; until: Date }
  | { kind: "stop"; reason: ImportOutreachStop }
  | { kind: "move_to_onboard" };

export function nextOutreachAction(
  row: OutreachRowState,
  facts: OutreachFacts,
  now: Date,
): OutreachAction {
  if (row.stage === "STOPPED") return { kind: "stop", reason: "ADMIN" };
  if (row.sentCount >= MAX_OUTREACH_EMAILS) return { kind: "stop", reason: "FINISHED_SEQUENCE" };

  if (row.stage === "INVITE") {
    if (facts.importStatus === "CLAIMED") return { kind: "move_to_onboard" };
    if (facts.importStatus !== "REGISTERED") return { kind: "stop", reason: "ADMIN" };
    const base = facts.registeredAt ?? now;
    const reminderAt = new Date(base.getTime() + INVITE_REMINDER_AFTER_MS);
    if (row.step === 0) {
      return { kind: "send", template: "invite", step: 1, nextAt: reminderAt, stopAfter: null };
    }
    if (row.step === 1) {
      if (now < reminderAt) return { kind: "wait", until: reminderAt };
      return { kind: "send", template: "invite_reminder", step: 2, nextAt: null, stopAfter: "NO_RESPONSE" };
    }
    return { kind: "stop", reason: "NO_RESPONSE" };
  }

  // ONBOARD
  if (facts.importStatus !== "CLAIMED") return { kind: "stop", reason: "ADMIN" };
  if (facts.completeness.missing.length === 0) return { kind: "stop", reason: "COMPLETE" };
  const base = facts.claimedAt ?? now;
  const reminderAt = new Date(base.getTime() + ONBOARD_REMINDER_AFTER_MS);
  if (row.step === 0) {
    return { kind: "send", template: "onboard_welcome", step: 1, nextAt: reminderAt, stopAfter: null };
  }
  if (row.step === 1) {
    if (now < reminderAt) return { kind: "wait", until: reminderAt };
    return {
      kind: "send",
      template: "onboard_reminder",
      step: 2,
      nextAt: null,
      stopAfter: "FINISHED_SEQUENCE",
    };
  }
  return { kind: "stop", reason: "FINISHED_SEQUENCE" };
}
