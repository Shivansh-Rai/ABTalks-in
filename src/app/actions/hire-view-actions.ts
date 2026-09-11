"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { decodeCandidateRef } from "@/features/hire/candidate-ref";
import {
  hireViewSalt,
  istDayKey,
  recordDetailView,
  viewerKeyFor,
} from "@/features/profile/profile-events";
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
