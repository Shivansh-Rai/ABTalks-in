import "server-only";
import { writeClient } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { writeAudit } from "@/features/admin/audit";
import { notifyDataRightsRequest } from "@/features/legal/notify-data-request";
import { applyVisibilityChange } from "@/repositories/visibility";
import {
  getOutreachImportFacts,
  getOutreachPerson,
  getOutreachRowByImportId,
  listDueOutreach,
  markOutreachFailed,
  markOutreachSent,
  moveOutreachToOnboard,
  moveOutreachToOnboardForUser,
  recordOutreachClick,
  setOutreachNextSendAt,
  stopOutreachForImport,
  stopOutreachRow,
  upsertOutreachEnrollment,
  type DueOutreachRow,
  type OutreachPerson,
} from "@/repositories/resume-import";
import { signClaimToken, verifyClaimToken } from "@/features/resume/import/outreach-token";
import {
  nextOutreachAction,
  profileCompleteness,
  type Completeness,
} from "@/features/resume/import/outreach-steps";
import { renderOutreachEmail } from "@/features/resume/import/outreach-templates";

/**
 * Claim-and-complete emails for imported students (plan 171).
 *
 * Off unless `IMPORT_OUTREACH_ENABLED === "true"`. Every entry point here is
 * safe to call from registration, sign-in and the cron: errors are logged,
 * never thrown into the caller, and nothing here touches parsing or the
 * import queue.
 */

const MAX_SEND_FAILURES = 3;
/**
 * Not a daily limit — a time budget. The 09:00 IST cron shares one 300 s
 * function with the résumé drain (up to 230 s), so the email run stops after
 * this long and anything left is picked up by the next run. Invites don't
 * wait for the run (they go at registration), so this rarely bites.
 */
const RUN_BUDGET_MS = 60_000;
const RUN_PAGE = 200;

export function isOutreachEnabled(): boolean {
  return process.env.IMPORT_OUTREACH_ENABLED === "true";
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://abtalks.in").replace(/\/+$/, "");
}

export function claimUrlFor(importId: string, userId: string, now: Date = new Date()): string {
  return `${appUrl()}/claim/${signClaimToken(importId, userId, now)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your résumé email";
  return `${local.slice(0, 1)}***@${domain}`;
}

function completenessOf(person: OutreachPerson): Completeness {
  const p = person.profile;
  return profileCompleteness({
    phoneVerified: p?.phoneVerified ?? false,
    educationCount: p?.educationCount ?? 0,
    experienceCount: p?.experienceCount ?? 0,
    hasNoWorkExperience: p?.hasNoWorkExperience ?? false,
    skillCount: p?.skillCount ?? 0,
    githubUsername: p?.githubUsername ?? null,
    linkedinUrl: p?.linkedinUrl ?? null,
  });
}

function firstNameOf(person: OutreachPerson): string {
  const full = person.profile?.fullName?.trim() || person.name?.trim() || "";
  return full.split(/\s+/)[0] ?? "";
}

export type OutreachRunResult = { sent: number; skipped: number; failed: number; stopped: number };

function emptyResult(): OutreachRunResult {
  return { sent: 0, skipped: 0, failed: 0, stopped: 0 };
}

/**
 * Decide and act for ONE sequence row: send the email that is due, wait,
 * move to onboarding, or stop. Shared by the immediate invite and the daily
 * run, so both follow exactly the same rules (`nextOutreachAction`).
 */
async function processOutreachRow(row: DueOutreachRow, now: Date, result: OutreachRunResult): Promise<void> {
  try {
    const facts = await getOutreachImportFacts(row.importId);
    const person = await getOutreachPerson(row.userId);
    if (!facts || !person || person.deletedAt || person.disabledAt) {
      await stopOutreachRow(row.id, "ADMIN", now);
      result.stopped++;
      return;
    }
    const completeness = completenessOf(person);
    const action = nextOutreachAction(
      row,
      {
        importStatus: facts.status,
        registeredAt: facts.registeredAt,
        claimedAt: facts.claimedAt,
        completeness,
      },
      now,
    );

    if (action.kind === "stop") {
      await stopOutreachRow(row.id, action.reason, now);
      result.stopped++;
      return;
    }
    if (action.kind === "wait") {
      await setOutreachNextSendAt(row.id, action.until);
      return;
    }
    if (action.kind === "move_to_onboard") {
      await moveOutreachToOnboard(row.id, now);
      return;
    }

    const email = renderOutreachEmail(action.template, {
      firstName: firstNameOf(person),
      email: person.email,
      claimUrl: claimUrlFor(row.importId, row.userId, now),
      profileUrl: `${appUrl()}/profile`,
      completeness,
    });
    const res = await sendEmail({
      to: person.email,
      toName: person.profile?.fullName ?? person.name ?? undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      kind: `resume_import.outreach.${action.template}`,
      subjectType: "ResumeImport",
      subjectId: row.importId,
    });
    if (res.ok) {
      await markOutreachSent(row.id, {
        step: action.step,
        deliveryId: res.deliveryId,
        now,
        nextSendAt: action.nextAt,
        stopReason: action.stopAfter,
      });
      result.sent++;
    } else if (res.skipped) {
      // No key or a test address: leave the row due, burn no step.
      result.skipped++;
    } else {
      // Still due: the next 09:00 run retries it. Three failures → BOUNCED.
      const stopped = await markOutreachFailed(row.id, now, now, MAX_SEND_FAILURES);
      result.failed++;
      if (stopped) result.stopped++;
    }
  } catch (error) {
    result.failed++;
    logger.error("[resume-import] outreach row failed", { outreachId: row.id, error: String(error) });
  }
}

/* ─── Entry points ───────────────────────────────────────────────────────── */

/**
 * A REGISTERED import enters the sequence and its invite goes out NOW — not
 * at the next 09:00 run. Reminders and onboarding still wait for the run.
 * Never throws: registration must not fail because of an email.
 */
export async function enrollOutreach(
  importId: string,
  userId: string,
  opts: { sendNow?: boolean } = {},
): Promise<void> {
  if (!isOutreachEnabled()) return;
  try {
    const now = new Date();
    await upsertOutreachEnrollment(importId, userId, now);
    // The backfill button enrols hundreds at once and sends them in the
    // background run instead (`sendNow: false`).
    if (opts.sendNow === false) return;
    const row = await getOutreachRowByImportId(importId);
    // Only a fresh row: an import already in the sequence is never re-sent.
    if (row && row.stage === "INVITE" && row.step === 0) {
      await processOutreachRow(row, now, emptyResult());
    }
  } catch (error) {
    logger.error("[resume-import] outreach enroll failed", { importId, error: String(error) });
  }
}

/** The import was just claimed: start onboarding (sent at the next 09:00 run). Never throws. */
export async function startOnboardingAfterClaim(userId: string): Promise<void> {
  try {
    const moved = await moveOutreachToOnboardForUser(userId, new Date());
    if (moved > 0) logger.info("[resume-import] outreach moved to onboarding", { userId });
  } catch (error) {
    logger.error("[resume-import] outreach onboarding move failed", { userId, error: String(error) });
  }
}

/**
 * The daily 09:00 IST run: reminders, onboarding, and any invite that could
 * not go out at registration. No daily limit — it works through everything
 * that is due, one email at a time, until `RUN_BUDGET_MS` runs out.
 */
export async function runImportOutreach(now: Date = new Date()): Promise<OutreachRunResult> {
  const result = emptyResult();
  if (!isOutreachEnabled()) return result;

  const started = Date.now();
  const seen = new Set<string>();
  while (Date.now() - started < RUN_BUDGET_MS) {
    const due = (await listDueOutreach(now, RUN_PAGE)).filter((r) => !seen.has(r.id));
    if (due.length === 0) break;
    for (const row of due) {
      if (Date.now() - started >= RUN_BUDGET_MS) break;
      seen.add(row.id);
      await processOutreachRow(row, now, result);
    }
  }

  logger.info("[resume-import] outreach run", result);
  return result;
}

/* ─── The public claim page ─────────────────────────────────────────────── */

export type ClaimPreview =
  | { kind: "invalid" }
  | { kind: "claimed" }
  | { kind: "gone" }
  | {
      kind: "open";
      maskedEmail: string;
      fullName: string;
      headline: string | null;
      topSkills: string[];
      completeness: Completeness;
    };

/** Read for `/claim/[token]`. Records the first click. */
export async function loadClaimPreview(token: string): Promise<ClaimPreview> {
  const verified = verifyClaimToken(token);
  if (!verified.ok) return { kind: "invalid" };
  const facts = await getOutreachImportFacts(verified.importId);
  if (!facts || facts.registeredUserId !== verified.userId) return { kind: "invalid" };
  if (facts.status === "CLAIMED") return { kind: "claimed" };
  if (facts.status !== "REGISTERED") return { kind: "gone" };
  const person = await getOutreachPerson(verified.userId);
  if (!person || person.deletedAt || person.disabledAt) return { kind: "gone" };

  try {
    await recordOutreachClick(verified.importId, new Date());
  } catch (error) {
    logger.error("[resume-import] outreach click not recorded", { error: String(error) });
  }

  return {
    kind: "open",
    maskedEmail: maskEmail(person.email),
    fullName: person.profile?.fullName ?? person.name ?? "",
    headline: person.profile?.headline ?? null,
    topSkills: person.profile?.topSkills ?? [],
    completeness: completenessOf(person),
  };
}

export type RemoveResult = { ok: true } | { ok: false; message: string };

/**
 * "Remove my data" from the claim page. Only while the import is still
 * REGISTERED and the token names the user it registered. Hides the profile
 * from recruiters at once, stops every email, files an erasure request for an
 * admin to finish, and soft-deletes the account ONLY when this import created
 * it — an account that existed before the import is never deleted here.
 */
export async function removeImportedProfile(token: string): Promise<RemoveResult> {
  const verified = verifyClaimToken(token);
  if (!verified.ok) return { ok: false, message: "This link is no longer valid." };
  const facts = await getOutreachImportFacts(verified.importId);
  if (!facts || facts.status !== "REGISTERED" || facts.registeredUserId !== verified.userId) {
    return { ok: false, message: "This link is no longer valid." };
  }
  const person = await getOutreachPerson(verified.userId);
  if (!person || person.deletedAt) return { ok: false, message: "This link is no longer valid." };

  const now = new Date();
  const request = await writeClient().$transaction(async (tx) => {
    await applyVisibilityChange(tx, { userId: verified.userId, kind: "admin_withdraw", at: now });
    await stopOutreachForImport(verified.importId, "REMOVED", now, tx);
    if (!facts.linkedExisting) {
      await tx.user.update({
        where: { id: verified.userId },
        data: { deletedAt: now },
        select: { id: true },
      });
    }
    const created = await tx.dataRightsRequest.create({
      data: {
        userId: verified.userId,
        email: person.email,
        type: "ERASURE",
        message: facts.linkedExisting
          ? "Removed via the imported-profile link (plan 171). Recruiter visibility withdrawn; the account existed before the import and was NOT deleted."
          : "Removed via the imported-profile link (plan 171). Recruiter visibility withdrawn and the imported account soft-deleted. Finish the erasure.",
      },
      select: { id: true },
    });
    await writeAudit(tx, {
      actorUserId: verified.userId,
      targetUserId: verified.userId,
      entityType: "ResumeImport",
      entityId: verified.importId,
      actionType: "RESUME_IMPORT_SUBJECT_REMOVED",
      reason: "Subject used Remove my data on the claim page",
      metadata: { linkedExisting: facts.linkedExisting, dataRightsRequestId: created.id },
    });
    return created;
  });

  await notifyDataRightsRequest({
    id: request.id,
    email: person.email,
    type: "ERASURE",
    message: "Remove my data — imported profile (plan 171).",
  });
  logger.info("[resume-import] subject removed imported profile", {
    importId: verified.importId,
    linkedExisting: facts.linkedExisting,
  });
  return { ok: true };
}
