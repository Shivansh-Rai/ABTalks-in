"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logger } from "@/lib/logger";
import {
  EMPLOYMENT_TYPES,
  GRADE_TYPE_LABELS,
  SCHOOL_SCORE_TYPE_OPTIONS,
  SCORE_TYPE_OPTIONS,
} from "@/lib/candidate-vocab";
import { canonicalSkillName } from "@/lib/skill-catalog";
import { resolveSkillSchema } from "@/lib/validations/candidate-profile";
import { writeAudit } from "@/features/admin/audit";
import {
  EDITABLE_EDUCATION_FIELDS,
  MAX_SKILL_CLAIMS,
  educationEditSchema,
  educationSlotOf,
  experienceEditSchema,
  planEducationEdit,
  planEducationRemoval,
  planExperienceEdit,
  planExperienceRemoval,
  planSkillClaimChange,
  selfDeclaredSkills,
  type EducationEditField,
  type EducationSlot,
  type SkillClaimChange,
  type SkillRef,
} from "@/features/hire/admin-profile-edit";
import { decodeCandidateRef } from "@/features/hire/candidate-ref";
import { resolveInspectorCandidate } from "@/features/hire/pool-policy";
import { getVerifiedSkills } from "@/features/profile/get-verified-skills";
import { resolveOrCreateSkill } from "@/features/skill/resolve-skill";
import { getSkillsByNames } from "@/features/skill/search-skills";
import { getCandidateProfile } from "@/repositories/candidate";
import {
  getCandidateDetail,
  listPublicWorkHistory,
  listSkillClaimEvidence,
  saveEducation,
  saveExperience,
  saveSkillClaims,
  type EducationView,
  type ExperienceView,
} from "@/repositories/candidate-detail";

/**
 * Platform Admin edits of a candidate's Experience, Education and self-declared
 * skills from Hire → View Details.
 *
 * Every export calls `requireAdmin()` before it reads its input. The pencils
 * are hidden from recruiters in the UI, but that is presentation: this file is
 * the boundary.
 *
 * Writes go through `saveExperience` / `saveEducation` / `saveSkillClaims`, the
 * same writers the candidate's own /profile uses, so the candidate sees the
 * change on their profile and there is no admin-only copy. Those writers
 * replace the whole section, which matches the candidate's own save. The cost
 * is a read-then-replace: a candidate saving in the instant between this
 * action's read and its write would lose that save, the same race two of the
 * candidate's own tabs already have. An edit made against rows the candidate
 * has since replaced is caught, because a replace mints new row ids and the
 * edit names its row by the old one.
 *
 * The audit row is written by the section writer's `afterWrite` hook, inside
 * the same transaction as the change.
 */

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const GENERIC = "Could not save. Please try again.";

const userIdSchema = z.string().trim().min(1).max(64);
const rowIdSchema = z.string().trim().min(1).max(64);
const candidateRefSchema = z.string().trim().min(1).max(200);

export type AdminEducationRow = EducationView & {
  slot: EducationSlot;
  /** The fields this row offers a pencil for. */
  editable: EducationEditField[];
};

export type AdminInspectorProfile = {
  userId: string;
  education: AdminEducationRow[];
  selfDeclaredSkills: SkillRef[];
  /** Picker options, sent down so the hire bundle does not carry the vocab. */
  vocab: {
    employmentTypes: string[];
    scoreTypes: { value: string; label: string }[];
    schoolScoreTypes: { value: string; label: string }[];
  };
};

const scoreOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: GRADE_TYPE_LABELS[value] ?? value }));

function educationRows(rows: readonly EducationView[]): AdminEducationRow[] {
  return rows.map((row) => {
    const slot = educationSlotOf(rows, row.id);
    return { ...row, slot, editable: [...EDITABLE_EDUCATION_FIELDS[slot]] };
  });
}

async function readSkills(
  userId: string,
): Promise<{ claims: SkillRef[]; evidenceBacked: SkillRef[] }> {
  const [rows, programme] = await Promise.all([
    listSkillClaimEvidence(userId),
    getVerifiedSkills(userId),
  ]);
  return {
    claims: rows
      .filter((row) => row.claimedByCandidate)
      .map(({ skillId, name }) => ({ skillId, name })),
    evidenceBacked: [
      ...rows
        .filter((row) => row.hasEvidence)
        .map(({ skillId, name }) => ({ skillId, name })),
      ...programme.map(({ skillId, name }) => ({ skillId, name })),
    ],
  };
}

/** The candidate's own profile, and the admin's read of the same record. */
function revalidateCandidateViews(userId: string): void {
  revalidatePath("/profile");
  revalidatePath(`/admin/students/${userId}`);
}

/**
 * What the admin edit controls need beyond what View Details already loads:
 * the stable user id, full education rows and the self-declared claims with
 * their skill ids. Null when the card is not a real, addressable candidate.
 *
 * Admin-only on purpose. The recruiter surface shows the declared education
 * level and never the institution, and this must not become a way around that.
 */
export async function loadAdminInspectorProfileAction(
  input: unknown,
): Promise<Result<AdminInspectorProfile | null>> {
  await requireAdmin();

  const parsed = z.object({ candidateRef: candidateRefSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid candidate." };

  const raw = parsed.data.candidateRef;
  if (raw.startsWith("SAMPLE:") || !decodeCandidateRef(raw)) {
    return { ok: true, data: null };
  }

  try {
    const eligible = await resolveInspectorCandidate(raw);
    if (!eligible) return { ok: true, data: null };

    const [detail, skills] = await Promise.all([
      getCandidateDetail(eligible.userId),
      readSkills(eligible.userId),
    ]);
    if (!detail) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        userId: eligible.userId,
        education: educationRows(detail.education),
        selfDeclaredSkills: selfDeclaredSkills(
          skills.claims,
          skills.evidenceBacked,
        ),
        vocab: {
          employmentTypes: [...EMPLOYMENT_TYPES],
          scoreTypes: scoreOptions(SCORE_TYPE_OPTIONS),
          schoolScoreTypes: scoreOptions(SCHOOL_SCORE_TYPE_OPTIONS),
        },
      },
    };
  } catch (error) {
    logger.error("[admin] loadAdminInspectorProfileAction", {
      error: String(error),
    });
    return { ok: false, message: "Could not load the profile for editing." };
  }
}

const experienceFieldInput = z.object({
  userId: userIdSchema,
  rowId: rowIdSchema,
  edit: experienceEditSchema,
});

export async function updateCandidateExperienceFieldAction(
  input: unknown,
): Promise<Result<{ experience: ExperienceView[] }>> {
  const admin = await requireAdmin();

  const parsed = experienceFieldInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const { userId, rowId, edit } = parsed.data;

  try {
    const current = await listPublicWorkHistory(userId);
    const plan = planExperienceEdit(current.rows, rowId, edit);
    if (!plan.ok) return { ok: false, message: plan.message };
    if (!plan.changed) return { ok: true, data: { experience: current.rows } };

    await saveExperience(
      userId,
      plan.rows,
      current.hasNoWorkExperience,
      (tx) =>
        writeAudit(tx, {
          actorUserId: admin.userId,
          adminUserId: admin.userId,
          targetUserId: userId,
          entityType: "CandidateExperience",
          entityId: userId,
          actionType: "CANDIDATE_EXPERIENCE_EDIT",
          reason: `Edited experience ${edit.field} from Hire View Details.`,
          previousState: plan.previous,
          newState: plan.next,
          metadata: {
            surface: "hire-inspector",
            field: edit.field,
            rowId,
            entry: plan.entry,
          },
        }),
    );
    revalidateCandidateViews(userId);

    const fresh = await listPublicWorkHistory(userId);
    return { ok: true, data: { experience: fresh.rows } };
  } catch (error) {
    logger.error("[admin] updateCandidateExperienceFieldAction", {
      userId,
      error: String(error),
    });
    return { ok: false, message: GENERIC };
  }
}

const entryInput = z.object({ userId: userIdSchema, rowId: rowIdSchema });

export async function deleteCandidateExperienceEntryAction(
  input: unknown,
): Promise<Result<{ experience: ExperienceView[] }>> {
  const admin = await requireAdmin();

  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const { userId, rowId } = parsed.data;

  try {
    const current = await listPublicWorkHistory(userId);
    const plan = planExperienceRemoval(current.rows, rowId);
    if (!plan.ok) return { ok: false, message: plan.message };

    await saveExperience(
      userId,
      plan.rows,
      current.hasNoWorkExperience,
      (tx) =>
        writeAudit(tx, {
          actorUserId: admin.userId,
          adminUserId: admin.userId,
          targetUserId: userId,
          entityType: "CandidateExperience",
          entityId: userId,
          actionType: "CANDIDATE_EXPERIENCE_DELETE",
          reason: "Removed an experience entry from Hire View Details.",
          previousState: plan.previous,
          metadata: { surface: "hire-inspector", rowId, entry: plan.entry },
        }),
    );
    revalidateCandidateViews(userId);

    const fresh = await listPublicWorkHistory(userId);
    return { ok: true, data: { experience: fresh.rows } };
  } catch (error) {
    logger.error("[admin] deleteCandidateExperienceEntryAction", {
      userId,
      error: String(error),
    });
    return { ok: false, message: GENERIC };
  }
}

const educationFieldInput = z.object({
  userId: userIdSchema,
  rowId: rowIdSchema,
  edit: educationEditSchema,
});

export async function updateCandidateEducationFieldAction(
  input: unknown,
): Promise<Result<{ education: AdminEducationRow[] }>> {
  const admin = await requireAdmin();

  const parsed = educationFieldInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const { userId, rowId, edit } = parsed.data;

  try {
    const detail = await getCandidateDetail(userId);
    if (!detail) return { ok: false, message: "Candidate not found." };

    const plan = planEducationEdit(detail.education, rowId, edit);
    if (!plan.ok) return { ok: false, message: plan.message };
    if (!plan.changed) {
      return { ok: true, data: { education: educationRows(detail.education) } };
    }

    await saveEducation(userId, plan.rows, (tx) =>
      writeAudit(tx, {
        actorUserId: admin.userId,
        adminUserId: admin.userId,
        targetUserId: userId,
        entityType: "CandidateEducation",
        entityId: userId,
        actionType: "CANDIDATE_EDUCATION_EDIT",
        reason: `Edited education ${edit.field} from Hire View Details.`,
        previousState: plan.previous,
        newState: plan.next,
        metadata: {
          surface: "hire-inspector",
          field: edit.field,
          rowId,
          entry: plan.entry,
        },
      }),
    );
    revalidateCandidateViews(userId);

    const fresh = await getCandidateDetail(userId);
    return {
      ok: true,
      data: { education: educationRows(fresh?.education ?? []) },
    };
  } catch (error) {
    logger.error("[admin] updateCandidateEducationFieldAction", {
      userId,
      error: String(error),
    });
    return { ok: false, message: GENERIC };
  }
}

export async function deleteCandidateEducationEntryAction(
  input: unknown,
): Promise<Result<{ education: AdminEducationRow[] }>> {
  const admin = await requireAdmin();

  const parsed = entryInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: GENERIC };
  const { userId, rowId } = parsed.data;

  try {
    const detail = await getCandidateDetail(userId);
    if (!detail) return { ok: false, message: "Candidate not found." };

    const plan = planEducationRemoval(detail.education, rowId);
    if (!plan.ok) return { ok: false, message: plan.message };

    await saveEducation(userId, plan.rows, (tx) =>
      writeAudit(tx, {
        actorUserId: admin.userId,
        adminUserId: admin.userId,
        targetUserId: userId,
        entityType: "CandidateEducation",
        entityId: userId,
        actionType: "CANDIDATE_EDUCATION_DELETE",
        reason: "Removed an education entry from Hire View Details.",
        previousState: plan.previous,
        metadata: { surface: "hire-inspector", rowId, entry: plan.entry },
      }),
    );
    revalidateCandidateViews(userId);

    const fresh = await getCandidateDetail(userId);
    return {
      ok: true,
      data: { education: educationRows(fresh?.education ?? []) },
    };
  } catch (error) {
    logger.error("[admin] deleteCandidateEducationEntryAction", {
      userId,
      error: String(error),
    });
    return { ok: false, message: GENERIC };
  }
}

const skillName = resolveSkillSchema.shape.name;

const skillClaimInput = z.object({
  userId: userIdSchema,
  change: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("add"), name: skillName }),
    z.object({ kind: z.literal("remove"), skillId: rowIdSchema }),
    z.object({
      kind: z.literal("replace"),
      skillId: rowIdSchema,
      name: skillName,
    }),
  ]),
});

const SKILL_ACTION_TYPE = {
  add: "CANDIDATE_SKILL_CLAIM_ADD",
  remove: "CANDIDATE_SKILL_CLAIM_REMOVE",
  replace: "CANDIDATE_SKILL_CLAIM_REPLACE",
} as const;

/**
 * Add, remove or swap one self-declared skill claim.
 *
 * A typed name is folded onto the catalog by `resolveOrCreateSkill`, the same
 * fold the candidate's own Skills section uses. "Rename" is a swap of this
 * candidate's claim: the catalog row is shared by every candidate and is never
 * renamed here. Evidence-backed skills are refused by `planSkillClaimChange`.
 */
export async function changeCandidateSkillClaimAction(
  input: unknown,
): Promise<Result<{ selfDeclaredSkills: SkillRef[] }>> {
  const admin = await requireAdmin();

  const parsed = skillClaimInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const { userId, change } = parsed.data;

  try {
    // `saveSkillClaims` creates a missing CandidateProfile, which is right for
    // a candidate saving their own skills and wrong for an id that is not one.
    if (!(await getCandidateProfile(userId))) {
      return { ok: false, message: "Candidate not found." };
    }
    const current = await readSkills(userId);

    let planned: SkillClaimChange;
    if (change.kind === "remove") {
      planned = change;
    } else {
      // Before the resolve, which may mint a catalog row for a new name.
      if (
        change.kind === "add" &&
        current.claims.length >= MAX_SKILL_CLAIMS
      ) {
        return {
          ok: false,
          message: `This profile already has ${MAX_SKILL_CLAIMS} skills.`,
        };
      }
      const resolved = await resolveOrCreateSkill(
        canonicalSkillName(change.name),
      );
      if (!resolved) {
        return { ok: false, message: "Please enter a skill name." };
      }
      // `saveSkillClaims` skips a deactivated catalog skill without saying so,
      // which would report an add that never happened.
      const [active] = await getSkillsByNames([resolved.name]);
      if (!active || active.id !== resolved.id) {
        return { ok: false, message: "That skill is not available." };
      }
      const skill = { skillId: resolved.id, name: resolved.name };
      planned =
        change.kind === "add"
          ? { kind: "add", skill }
          : { kind: "replace", skillId: change.skillId, skill };
    }

    const plan = planSkillClaimChange(
      current.claims,
      current.evidenceBacked,
      planned,
    );
    if (!plan.ok) return { ok: false, message: plan.message };
    if (!plan.changed) {
      return {
        ok: true,
        data: {
          selfDeclaredSkills: selfDeclaredSkills(
            current.claims,
            current.evidenceBacked,
          ),
        },
      };
    }

    await saveSkillClaims(userId, plan.claims, (tx) =>
      writeAudit(tx, {
        actorUserId: admin.userId,
        adminUserId: admin.userId,
        targetUserId: userId,
        entityType: "CandidateSkill",
        entityId: userId,
        actionType: SKILL_ACTION_TYPE[change.kind],
        reason: `Self-declared skill ${change.kind} from Hire View Details.`,
        previousState: plan.previous,
        newState: plan.next,
        metadata: { surface: "hire-inspector" },
      }),
    );
    revalidateCandidateViews(userId);

    const fresh = await readSkills(userId);
    return {
      ok: true,
      data: {
        selfDeclaredSkills: selfDeclaredSkills(
          fresh.claims,
          fresh.evidenceBacked,
        ),
      },
    };
  } catch (error) {
    logger.error("[admin] changeCandidateSkillClaimAction", {
      userId,
      error: String(error),
    });
    return { ok: false, message: GENERIC };
  }
}
