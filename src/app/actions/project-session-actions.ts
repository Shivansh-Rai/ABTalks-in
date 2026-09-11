"use server";

import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { createProject } from "@/features/hire/search-sessions";
import { requireApprovedRecruiterAction } from "@/lib/recruiter-gate";
import {
  createTalentProjectSchema,
  projectAssessmentLinkSchema,
  projectAssessmentUnlinkSchema,
} from "@/lib/validations/hire";
import {
  linkProjectAssessment,
  unlinkProjectAssessment,
} from "@/features/hire/project-assessments";

/**
 * Projects as containers (plan 133).
 *
 * "New project" creates the TalentRequest here, immediately and with the
 * recruiter's name for it — it no longer waits for a first search. It creates
 * NO search session: a project has none until something is searched in it.
 *
 * Every id comes from the session or is re-checked against it; nothing here
 * accepts a recruiter id from the client.
 */

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export async function createTalentProjectAction(
  input: unknown,
): Promise<ActionResult<{ requestId: string }>> {
  const gate = await requireApprovedRecruiterAction();
  if (!gate.ok) return gate;
  const parsed = createTalentProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Name the project." };
  }

  try {
    const created = await createProject(gate.data.userId, parsed.data.name);
    // The project list lives in the /hire layout, so refresh it too.
    revalidatePath("/hire", "layout");
    return { ok: true, data: { requestId: created.id } };
  } catch (error) {
    logger.error("[hire] createTalentProjectAction", { error: String(error) });
    return { ok: false, message: "Could not create the project. Try again." };
  }
}

export async function linkProjectAssessmentAction(
  input: unknown,
): Promise<ActionResult<{ assessmentId: string }>> {
  const gate = await requireApprovedRecruiterAction();
  if (!gate.ok) return gate;
  const parsed = projectAssessmentLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const result = await linkProjectAssessment({
      recruiterUserId: gate.data.userId,
      requestId: parsed.data.requestId,
      assessmentId: parsed.data.assessmentId,
    });
    if (!result.ok) return result;
    revalidatePath(`/hire/${parsed.data.requestId}`);
    return { ok: true, data: { assessmentId: parsed.data.assessmentId } };
  } catch (error) {
    logger.error("[hire] linkProjectAssessmentAction", { error: String(error) });
    return { ok: false, message: "Could not attach the assessment." };
  }
}

export async function unlinkProjectAssessmentAction(
  input: unknown,
): Promise<ActionResult<{ assessmentId: string }>> {
  const gate = await requireApprovedRecruiterAction();
  if (!gate.ok) return gate;
  const parsed = projectAssessmentUnlinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  try {
    const result = await unlinkProjectAssessment({
      recruiterUserId: gate.data.userId,
      assessmentId: parsed.data.assessmentId,
    });
    if (!result.ok) return result;
    revalidatePath("/hire", "layout");
    return { ok: true, data: { assessmentId: parsed.data.assessmentId } };
  } catch (error) {
    logger.error("[hire] unlinkProjectAssessmentAction", { error: String(error) });
    return { ok: false, message: "Could not detach the assessment." };
  }
}
