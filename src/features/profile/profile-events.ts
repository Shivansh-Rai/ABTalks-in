import "server-only";

import { createHash } from "node:crypto";
import { formatInTimeZone } from "date-fns-tz";
import type { CandidateProfileEventType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { IST } from "@/lib/date-utils";
import { logger } from "@/lib/logger";

/**
 * Profile performance events (plan 120).
 *
 * The only writer of `CandidateProfileEvent`. Analytics must never break a
 * recruiter's click or an admin's decision — every write is try/catch and
 * log-and-swallow.
 */

export type ViewerKeyInput =
  | { kind: "user"; userId: string }
  | {
      kind: "guest";
      ip: string;
      userAgent: string;
      /** YYYY-MM-DD in Asia/Kolkata. */
      dayKey: string;
      /** `HIRE_VIEW_SALT` (or empty). Combined with dayKey as the daily salt. */
      salt: string;
    };

/** IST calendar key used for the per-day dedupe unique constraint. */
export function istDayKey(now: Date = new Date()): string {
  return formatInTimeZone(now, IST, "yyyy-MM-dd");
}

/**
 * Viewer identity for dedupe.
 *
 * Signed-in → `u:<userId>`. Guest → `g:` + sha256(salt+day+ip+ua).slice(0,32).
 * The hash rotates daily, so it dedupes within the day and cannot be linked
 * across days or to a person. Raw IP / UA are never stored.
 */
export function viewerKeyFor(input: ViewerKeyInput): string {
  if (input.kind === "user") {
    return `u:${input.userId}`;
  }
  const dailySalt = `${input.salt}${input.dayKey}`;
  const digest = createHash("sha256")
    .update(`${dailySalt}${input.ip}${input.userAgent}`)
    .digest("hex")
    .slice(0, 32);
  return `g:${digest}`;
}

export function hireViewSalt(): string {
  return process.env.HIRE_VIEW_SALT ?? "";
}

async function recordEvent(opts: {
  candidateUserId: string;
  type: CandidateProfileEventType;
  viewerKey: string;
  dayKey?: string;
}): Promise<void> {
  const dayKey = opts.dayKey ?? istDayKey();
  try {
    await prisma.candidateProfileEvent.upsert({
      where: {
        candidateUserId_type_viewerKey_dayKey: {
          candidateUserId: opts.candidateUserId,
          type: opts.type,
          viewerKey: opts.viewerKey,
          dayKey,
        },
      },
      create: {
        candidateUserId: opts.candidateUserId,
        type: opts.type,
        viewerKey: opts.viewerKey,
        dayKey,
        occurredAt: new Date(),
      },
      // Unique hit = already counted today. Empty update is an intentional no-op.
      update: {},
    });
  } catch (error) {
    logger.error("[profile-events] record failed", {
      type: opts.type,
      candidateUserId: opts.candidateUserId,
      error: String(error),
    });
  }
}

/** Recruiter (or guest) opened the candidate's details inspector on /hire. */
export async function recordDetailView(opts: {
  candidateUserId: string;
  viewerKey: string;
  dayKey?: string;
}): Promise<void> {
  await recordEvent({ ...opts, type: "DETAIL_VIEW" });
}

/**
 * A resume was genuinely unlocked for this viewer.
 *
 * Today that means CONTACT_SHARED. When billing lands, call this from the
 * resume-view path too — the counter needs no other change.
 */
export async function recordResumeUnlock(opts: {
  candidateUserId: string;
  viewerKey: string;
  dayKey?: string;
}): Promise<void> {
  await recordEvent({ ...opts, type: "RESUME_UNLOCK" });
}
