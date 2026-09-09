import "server-only";

import { prisma } from "@/lib/db";
import { reqLogger } from "@/lib/logger";
import { captureFailure } from "@/lib/observability/capture";
import { logContact } from "@/lib/observability/domain-log";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Whether this recruiter may see this candidate's real identity and contact
 * details.
 *
 * Derived from the request status, never stored as its own flag. A second
 * "contactVisible" boolean is a field that can be left switched on by a bug, a
 * bad backfill, or a status change that forgot to clear it; there is nothing to
 * forget when the answer is computed from the decision itself.
 *
 * One rule, one place. Every surface that could reveal a name, an email, a
 * phone number or a profile link asks this — nothing decides locally.
 *
 * Keyed on the candidate's *user* id rather than their program member id, which
 * is the only key both pools have: a challenge participant has no ProgramMember
 * row, and a rule that cannot name half the candidates is not one rule.
 */
export async function hasContactAccess(
  recruiterUserId: string,
  candidateUserId: string,
): Promise<boolean> {
  // T-259: this is the gate that decides whether a real name, email or phone
  // number is about to be shown to a recruiter, so every answer is recorded.
  // Ids only - the whole point of the log is to prove who was allowed to see
  // what, which it cannot do if it leaks the thing being protected.
  const requestId = await getRequestId();
  const log = reqLogger(requestId, {
    route: "hire:hasContactAccess",
    recruiterId: recruiterUserId,
    candidateId: candidateUserId,
  });
  logContact("contact.resolve", {
    outcome: "attempt",
    recruiterId: recruiterUserId,
    candidateId: candidateUserId,
    log,
  });

  try {
    const shared = await prisma.talentEngagementRequest.findFirst({
      where: {
        recruiterUserId,
        candidateUserId,
        status: "CONTACT_SHARED",
      },
      select: { id: true },
    });
    logContact("contact.resolve", {
      // `refused` is "this recruiter has no access", which is the normal answer
      // for most pairs - not a fault, and it must not read as one.
      outcome: shared ? "success" : "refused",
      recruiterId: recruiterUserId,
      candidateId: candidateUserId,
      unlockId: shared?.id,
      log,
    });
    return shared !== null;
  } catch (error) {
    await captureFailure(error, {
      event: "contact.resolve.failed",
      message: "contact access check failed",
      log,
      tags: {
        requestId,
        recruiterId: recruiterUserId,
        candidateId: candidateUserId,
        route: "hire:hasContactAccess",
      },
      extra: { area: "contact", op: "contact.resolve", outcome: "failed" },
    });
    // Fail closed. An error here must never read as "yes".
    return false;
  }
}

/** The same question for a page rendering many candidates at once. */
export async function contactAccessFor(
  recruiterUserId: string,
  candidateUserIds: string[],
): Promise<Set<string>> {
  if (candidateUserIds.length === 0) return new Set();

  const requestId = await getRequestId();
  const log = reqLogger(requestId, {
    route: "hire:contactAccessFor",
    recruiterId: recruiterUserId,
  });
  logContact("contact.resolve", {
    outcome: "attempt",
    recruiterId: recruiterUserId,
    candidateCount: candidateUserIds.length,
    log,
  });

  try {
    const rows = await prisma.talentEngagementRequest.findMany({
      where: {
        recruiterUserId,
        candidateUserId: { in: candidateUserIds },
        status: "CONTACT_SHARED",
      },
      select: { candidateUserId: true },
    });

    const granted = new Set(
      rows
        .map((r) => r.candidateUserId)
        .filter((id): id is string => id !== null),
    );
    logContact("contact.resolve", {
      outcome: "success",
      recruiterId: recruiterUserId,
      candidateCount: candidateUserIds.length,
      grantedCount: granted.size,
      log,
    });
    return granted;
  } catch (error) {
    await captureFailure(error, {
      event: "contact.resolve.failed",
      message: "bulk contact access check failed",
      log,
      tags: {
        requestId,
        recruiterId: recruiterUserId,
        route: "hire:contactAccessFor",
      },
      extra: { area: "contact", op: "contact.resolve", outcome: "failed" },
    });
    // Fail closed, same as the single-candidate gate.
    return new Set();
  }
}

/** What the recruiter has already asked about, so the UI never offers twice. */
export async function existingEngagements(
  recruiterUserId: string,
  candidateUserIds: string[],
): Promise<Map<string, { id: string; status: string }>> {
  if (candidateUserIds.length === 0) return new Map();

  const rows = await prisma.talentEngagementRequest.findMany({
    where: {
      recruiterUserId,
      candidateUserId: { in: candidateUserIds },
      status: { not: "CLOSED" },
    },
    select: { id: true, status: true, candidateUserId: true },
    orderBy: { createdAt: "desc" },
  });

  const out = new Map<string, { id: string; status: string }>();
  for (const r of rows) {
    // Newest first, so the first row seen for a candidate is the live one.
    if (r.candidateUserId && !out.has(r.candidateUserId)) {
      out.set(r.candidateUserId, { id: r.id, status: r.status });
    }
  }
  return out;
}
