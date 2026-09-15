"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { decodeCandidateRef } from "@/features/hire/candidate-ref";
import { resolveInspectorCandidate } from "@/features/hire/pool-policy";
import {
  hireViewSalt,
  istDayKey,
  recordDetailView,
  viewerKeyFor,
} from "@/features/profile/profile-events";
import { getVerifiedAccomplishments } from "@/features/profile/get-verified-accomplishments";
import {
  listPublicWorkHistory,
  listSelfReportedExternalLinks,
  type PublicWorkHistory,
  type SelfReportedExternalLink,
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
 * It still re-tests the handle via {@link resolveInspectorCandidate} — a
 * guessed ref for someone who withdrew must not return their employers. Sample
 * and ineligible refs resolve to empty rather than an error, so the UI cannot
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
    const eligible = await resolveInspectorCandidate(raw);
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

const externalLinksInputSchema = z.object({
  candidateRef: candidateRefSchema,
});

export type InspectorExternalLinks = {
  links: SelfReportedExternalLink[];
};

/**
 * Declared GitHub / LeetCode / CodeChef profile URLs for View Detail (T-216).
 *
 * Same addressability as work history ({@link resolveInspectorCandidate}).
 * Protected contact stays off this payload. UI must label every link
 * SELF-REPORTED — these are not verified.
 */
export async function loadInspectorExternalLinksAction(
  input: unknown,
): Promise<
  { ok: true; data: InspectorExternalLinks } | { ok: false; message: string }
> {
  const parsed = externalLinksInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid candidate." };
  }

  const raw = parsed.data.candidateRef;
  if (raw.startsWith("SAMPLE:")) {
    return { ok: true, data: { links: [] } };
  }
  if (!decodeCandidateRef(raw)) {
    return { ok: true, data: { links: [] } };
  }

  try {
    const eligible = await resolveInspectorCandidate(raw);
    if (!eligible) {
      return { ok: true, data: { links: [] } };
    }
    const links = await listSelfReportedExternalLinks(eligible.userId);
    return { ok: true, data: { links } };
  } catch (error) {
    logger.error("[hire] loadInspectorExternalLinksAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not load profile links." };
  }
}

const trackEvidenceInputSchema = z.object({
  candidateRef: candidateRefSchema,
});

export type InspectorTrackEvidenceItem = {
  key: string;
  title: string;
  detail: string | null;
  outcomeLabel: string;
  occurredAt: string | null;
};

export type InspectorTrackEvidence = {
  items: InspectorTrackEvidenceItem[];
};

const EMPTY_TRACK_EVIDENCE: InspectorTrackEvidence = { items: [] };

/**
 * Completed tracks and hackathon placements for the Scout inspector.
 *
 * Completions are not protected contact, so this does not wait on an unlock.
 * It still re-tests the handle via {@link resolveInspectorCandidate} — a
 * guessed ref for someone who withdrew must not return their wins. Sample and
 * ineligible refs resolve to empty rather than an error, so the UI cannot tell
 * those cases apart.
 */
export async function loadInspectorTrackEvidenceAction(
  input: unknown,
): Promise<
  { ok: true; data: InspectorTrackEvidence } | { ok: false; message: string }
> {
  const parsed = trackEvidenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid candidate." };
  }

  const raw = parsed.data.candidateRef;
  if (raw.startsWith("SAMPLE:")) {
    return { ok: true, data: EMPTY_TRACK_EVIDENCE };
  }
  if (!decodeCandidateRef(raw)) {
    return { ok: true, data: EMPTY_TRACK_EVIDENCE };
  }

  try {
    const eligible = await resolveInspectorCandidate(raw);
    if (!eligible) {
      return { ok: true, data: EMPTY_TRACK_EVIDENCE };
    }
    const rows = await getVerifiedAccomplishments(eligible.userId, "wins-only");
    return {
      ok: true,
      data: {
        items: rows.map((row) => ({
          key: row.key,
          title: row.title,
          detail: row.detail,
          outcomeLabel: row.outcomeLabel,
          occurredAt: row.occurredAt ? row.occurredAt.toISOString() : null,
        })),
      },
    };
  } catch (error) {
    logger.error("[hire] loadInspectorTrackEvidenceAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not load evidence." };
  }
}
