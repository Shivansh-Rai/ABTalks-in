"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { decodeCandidateRef } from "@/features/hire/candidate-ref";
import { resolveEligibleCandidates } from "@/features/hire/pool-policy";
import {
  hireViewSalt,
  istDayKey,
  recordDetailView,
  viewerKeyFor,
} from "@/features/profile/profile-events";
import {
  listPublicWorkHistory,
  type PublicWorkHistory,
} from "@/repositories/candidate-detail";
import { resolveProgramRefs } from "@/repositories/hire";
import { logger } from "@/lib/logger";

const candidateRefSchema = z.string().trim().min(1).max(200);

/**
 * Fire-and-forget: a recruiter or guest opened a candidate's details on /hire.
 *
 * Works with no session. Always returns `{ ok: true }` — recording failures
 * must never surface in the UI.
 */
export async function recordCandidateViewAction(
  candidateRef: unknown,
): Promise<{ ok: true }> {
  try {
    const parsed = candidateRefSchema.safeParse(candidateRef);
    if (!parsed.success) return { ok: true };

    const raw = parsed.data;
    // SAMPLE: / virtual cards are not real candidates (decode rejects them).
    if (raw.startsWith("SAMPLE:")) return { ok: true };

    const ref = decodeCandidateRef(raw);
    if (!ref) return { ok: true };

    let candidateUserId: string;
    if (ref.source === "PROGRAM") {
      // PROGRAM refs carry ProgramMember.id, not User.id.
      const rows = await resolveProgramRefs([ref.id]);
      if (rows.length === 0) return { ok: true };
      candidateUserId = rows[0]!.userId;
    } else {
      candidateUserId = ref.id;
    }

    const session = await auth();
    const viewerUserId = session?.user?.id ?? null;

    // Self-views are not interest.
    if (viewerUserId && viewerUserId === candidateUserId) {
      return { ok: true };
    }

    const dayKey = istDayKey();
    let viewerKey: string;
    if (viewerUserId) {
      viewerKey = viewerKeyFor({ kind: "user", userId: viewerUserId });
    } else {
      const headersList = await headers();
      const ip =
        headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headersList.get("x-real-ip") ||
        "unknown";
      const userAgent = headersList.get("user-agent") ?? "";
      viewerKey = viewerKeyFor({
        kind: "guest",
        ip,
        userAgent,
        dayKey,
        salt: hireViewSalt(),
      });
    }

    await recordDetailView({ candidateUserId, viewerKey, dayKey });
  } catch (error) {
    logger.error("[hire] recordCandidateViewAction", { error: String(error) });
  }
  return { ok: true };
}

const workHistoryInputSchema = z.object({
  candidateRef: candidateRefSchema,
});

export type InspectorWorkHistory = PublicWorkHistory;

const EMPTY_WORK_HISTORY: InspectorWorkHistory = {
  hasNoWorkExperience: false,
  rows: [],
};

/**
 * Jobs the candidate typed or resume-merge wrote, for the Scout inspector.
 *
 * Work history is not protected contact, so this does not wait on an unlock.
 * It still re-tests the handle against the searchable pool — a guessed ref
 * for someone who withdrew must not return their employers. Sample and
 * ineligible refs resolve to empty rather than an error, so the UI cannot
 * tell those cases apart.
 */
export async function loadInspectorWorkHistoryAction(
  input: unknown,
): Promise<
  { ok: true; data: InspectorWorkHistory } | { ok: false; message: string }
> {
  const parsed = workHistoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid candidate." };
  }

  const raw = parsed.data.candidateRef;
  if (raw.startsWith("SAMPLE:")) {
    return { ok: true, data: EMPTY_WORK_HISTORY };
  }
  if (!decodeCandidateRef(raw)) {
    return { ok: true, data: EMPTY_WORK_HISTORY };
  }

  try {
    const [eligible] = await resolveEligibleCandidates([raw]);
    if (!eligible) {
      return { ok: true, data: EMPTY_WORK_HISTORY };
    }
    const data = await listPublicWorkHistory(eligible.userId);
    return { ok: true, data };
  } catch (error) {
    logger.error("[hire] loadInspectorWorkHistoryAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not load experience." };
  }
}
