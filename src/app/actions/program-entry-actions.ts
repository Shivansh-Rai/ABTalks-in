"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createApplication,
  startEntryAttempt,
  submitEntryAttempt,
  type EntrySubmitOk,
} from "@/features/program/entry";
import {
  applyProfileSchema,
  entrySubmitSchema,
} from "@/lib/validations/program";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

export async function applyToProgramAction(
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = applyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please check the form and try again." };
  }

  const result = await createApplication(session.user.id, parsed.data);
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/program/apply");
  revalidatePath("/program");
  return { ok: true };
}

/** Form action: starts (or resumes) an attempt and sends the user to the assessment. */
export async function startEntryAssessmentAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?from=/program/apply");

  const result = await startEntryAttempt(session.user.id);
  if (!result.ok) redirect("/program/apply");

  redirect("/program/assessment");
}

export async function submitEntryAssessmentAction(
  input: unknown,
): Promise<ActionResult<EntrySubmitOk>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }

  const parsed = entrySubmitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid submission." };
  }

  const result = await submitEntryAttempt(
    session.user.id,
    parsed.data.attemptId,
    parsed.data.answers,
  );
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/program/apply");
  revalidatePath("/program/assessment");
  revalidatePath("/program/dashboard");
  return { ok: true, data: result };
}
