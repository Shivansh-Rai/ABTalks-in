"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  getHiddenTestInputsForDay,
  getMissionState,
  submitMissionRun,
  useSkipToken,
  type SubmitMissionOk,
} from "@/features/program/missions";
import {
  startConceptCheck,
  submitConceptCheck,
  type ConceptCheckActive,
  type ConceptSubmitOk,
} from "@/features/program/concept-check";
import { resolveProgramMemberForUser } from "@/lib/program-auth";
import {
  conceptStartSchema,
  conceptSubmitSchema,
  missionDaySchema,
  submitMissionSchema,
} from "@/lib/validations/program";

type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

async function requireMemberId(): Promise<
  { ok: true; memberId: string } | { ok: false; message: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "Please sign in to continue." };
  }
  const resolved = await resolveProgramMemberForUser(session.user.id);
  if (!resolved) return { ok: false, message: "Enrollment required." };
  return { ok: true, memberId: resolved.member.id };
}

function revalidateMissionPaths(dayNumber: number) {
  revalidatePath("/program/dashboard");
  revalidatePath("/program/curriculum");
  revalidatePath("/program/leaderboard");
  revalidatePath(`/program/day/${dayNumber}`);
}

export async function getHiddenTestInputsAction(
  input: unknown,
): Promise<ActionResult<{ inputs: { check: string; input: string }[] }>> {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult;

  const parsed = missionDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid day." };

  const result = await getHiddenTestInputsForDay(
    authResult.memberId,
    parsed.data.dayNumber,
  );
  if (!result.ok) return { ok: false, message: result.message };

  return { ok: true, data: { inputs: result.inputs } };
}

export async function submitMissionRunAction(
  input: unknown,
): Promise<ActionResult<SubmitMissionOk>> {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult;

  const parsed = submitMissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  const result = await submitMissionRun(
    authResult.memberId,
    parsed.data.dayNumber,
    parsed.data.payload,
  );
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }

  revalidateMissionPaths(parsed.data.dayNumber);
  return { ok: true, data: result as SubmitMissionOk };
}

export async function useSkipTokenAction(
  input: unknown,
): Promise<ActionResult<{ unlockedDay: number }>> {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult;

  const parsed = missionDaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid day." };

  const result = await useSkipToken(authResult.memberId, parsed.data.dayNumber);
  if (!result.ok) return { ok: false, message: result.message };

  revalidateMissionPaths(parsed.data.dayNumber);
  return { ok: true, data: { unlockedDay: result.unlockedDay } };
}

export async function startConceptCheckAction(
  input: unknown,
): Promise<ActionResult<ConceptCheckActive>> {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult;

  const parsed = conceptStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid day." };

  const result = await startConceptCheck(
    authResult.memberId,
    parsed.data.dayNumber,
  );
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }

  revalidatePath(`/program/day/${parsed.data.dayNumber}`);
  revalidatePath("/program/dashboard");
  return { ok: true, data: result as ConceptCheckActive };
}

export async function submitConceptCheckAction(
  input: unknown,
): Promise<ActionResult<ConceptSubmitOk>> {
  const authResult = await requireMemberId();
  if (!authResult.ok) return authResult;

  const parsed = conceptSubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  const result = await submitConceptCheck(
    authResult.memberId,
    parsed.data.attemptId,
    parsed.data.answers,
  );
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }

  revalidatePath("/program/dashboard");
  return { ok: true, data: result as ConceptSubmitOk };
}
