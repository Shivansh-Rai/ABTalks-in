"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { dispatch } from "@/features/notification/notification-service";
import { logger } from "@/lib/logger";
import {
  assessmentDraftSchema,
  assignAssessmentSchema,
  publishAssessmentSchema,
} from "@/lib/validations/assessment";
import {
  assignAssessment,
  candidateAssessmentHref,
  createAssessment,
  deleteAssessment,
  publishAssessment,
  saveAssessmentDraft,
  type AssessmentNotifier,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";

type ActionOk<T = undefined> = T extends undefined
  ? { ok: true }
  : { ok: true; data: T };
type ActionErr = { ok: false; message: string; status?: number };

function scopeFrom(workspace: {
  organizationId: string;
  userId: string;
}) {
  return {
    organizationId: workspace.organizationId,
    createdByUserId: workspace.userId,
  };
}

export async function saveRecruiterAssessmentAction(
  input: unknown,
): Promise<ActionOk<{ id: string }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid assessment",
    };
  }

  try {
    const store = prismaAssessmentStore();
    const scope = scopeFrom(workspace.data);
    const result = parsed.data.assessmentId
      ? await saveAssessmentDraft(store, scope, parsed.data)
      : await createAssessment(store, scope, parsed.data);

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "CONFLICT"
            ? 409
            : undefined;
      return { ok: false, message: result.message, status };
    }

    revalidatePath("/hire/assessments");
    return { ok: true, data: { id: result.data.id } };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] save", {
      error: String(error),
    });
    return { ok: false, message: "Failed to save assessment" };
  }
}

const deleteSchema = z.object({
  assessmentId: z.string().min(1),
});

export async function deleteRecruiterAssessmentAction(
  input: unknown,
): Promise<ActionOk | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  try {
    const result = await deleteAssessment(
      prismaAssessmentStore(),
      scopeFrom(workspace.data),
      parsed.data.assessmentId,
    );
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        status: statusFor(result.code),
      };
    }
    revalidatePath("/hire/assessments");
    return { ok: true };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] delete", {
      error: String(error),
    });
    return { ok: false, message: "Failed to delete assessment" };
  }
}

function statusFor(code: "NOT_FOUND" | "INVALID" | "CONFLICT"): number | undefined {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return undefined;
}

/**
 * The real notifier, on T-248's dispatch().
 *
 * primaryEntityId is the ASSESSMENT id, not the assignment id: that is what
 * makes the dedupe key "once per candidate per assessment", so assigning again
 * never re-notifies and a failed send is retried by the next assign.
 *
 * Title and body are fixed copy. The email renderer interpolates them into HTML
 * without escaping, so no recruiter-authored text (assessment title, company)
 * may ever be put here.
 */
function assessmentNotifier(): AssessmentNotifier {
  return {
    async assigned({ recipientUserId, assessmentId, assignmentId }) {
      const res = await dispatch({
        eventType: "assessment.assigned",
        recipientUserId,
        primaryEntityId: assessmentId,
        title: "You have a new assessment to take",
        body: "A recruiter on ABTalks has invited you to an assessment. Open it to read the instructions before you start.",
        href: candidateAssessmentHref(assignmentId),
        metadata: { assessmentId, assignmentId },
      });
      return res.ok
        ? { ok: true, deduplicated: res.deduplicated }
        : { ok: false, deduplicated: false };
    },
  };
}

function revalidateAssessment(assessmentId: string) {
  revalidatePath("/hire/assessments");
  revalidatePath(`/hire/assessments/${assessmentId}`);
}

export async function publishRecruiterAssessmentAction(
  input: unknown,
): Promise<ActionOk<{ id: string; alreadyPublished: boolean }> | ActionErr> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = publishAssessmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input" };

  try {
    const result = await publishAssessment(
      prismaAssessmentStore(),
      scopeFrom(workspace.data),
      parsed.data.assessmentId,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    revalidateAssessment(result.data.id);
    return {
      ok: true,
      data: { id: result.data.id, alreadyPublished: result.data.alreadyPublished },
    };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] publish", {
      error: String(error),
    });
    return { ok: false, message: "Failed to publish assessment" };
  }
}

export async function assignRecruiterAssessmentAction(
  input: unknown,
): Promise<
  | ActionOk<{ assigned: number; alreadyAssigned: number; notificationFailures: number }>
  | ActionErr
> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message, status: 403 };

  const parsed = assignAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const result = await assignAssessment(
      prismaAssessmentStore(),
      assessmentNotifier(),
      scopeFrom(workspace.data),
      parsed.data,
    );
    if (!result.ok) {
      return { ok: false, message: result.message, status: statusFor(result.code) };
    }
    if (result.data.notificationFailures > 0) {
      logger.warn("[recruiter-assessment-actions] assign notification failures", {
        assessmentId: parsed.data.assessmentId,
        notificationFailures: result.data.notificationFailures,
      });
    }
    revalidateAssessment(parsed.data.assessmentId);
    return { ok: true, data: result.data };
  } catch (error) {
    logger.error("[recruiter-assessment-actions] assign", {
      error: String(error),
    });
    return { ok: false, message: "Failed to assign assessment" };
  }
}
