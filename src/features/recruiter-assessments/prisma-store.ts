import "server-only";

import { prisma } from "@/lib/db";
import type {
  AssessmentListRow,
  AssessmentQuestionRow,
  AssessmentRow,
  AssessmentStore,
  ContentInput,
  Scope,
} from "./service";

const OPTION_SELECT = {
  id: true,
  position: true,
  body: true,
  isCorrect: true,
} as const;

const QUESTION_SELECT = {
  id: true,
  position: true,
  type: true,
  title: true,
  helpText: true,
  isRequired: true,
  points: true,
  allowMultipleCorrect: true,
  maxWords: true,
  uploadDestinationUrl: true,
  sectionId: true,
  options: {
    orderBy: { position: "asc" as const },
    select: OPTION_SELECT,
  },
} as const;

const ASSESSMENT_SELECT = {
  id: true,
  organizationId: true,
  createdByUserId: true,
  title: true,
  subheading: true,
  instructions: true,
  status: true,
  durationMinutes: true,
  passMarkPercent: true,
  shortlistRefs: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  questions: {
    orderBy: { position: "asc" as const },
    select: QUESTION_SELECT,
  },
} as const;

const LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  durationMinutes: true,
  passMarkPercent: true,
  updatedAt: true,
  _count: { select: { questions: true } },
} as const;

function scopeWhere(scope: Scope) {
  return {
    organizationId: scope.organizationId,
    createdByUserId: scope.createdByUserId,
  };
}

/**
 * Build the nested-create payload for one question (without `assessmentId` — it
 * is implied by nesting under the parent create/update). Nesting the whole tree
 * into a single `create`/`update` avoids an interactive `$transaction`, which
 * the Neon serverless driver cannot hold across many sequential statements.
 */
function questionCreateNested(
  q: ContentInput["questions"][number],
  position: number,
) {
  const base = {
    position,
    type: q.type,
    title: q.title,
    helpText: q.helpText ?? null,
    isRequired: q.isRequired,
    points: q.points,
    sectionId: null,
  };
  if (q.type === "MULTIPLE_CHOICE") {
    return {
      ...base,
      allowMultipleCorrect: q.allowMultipleCorrect,
      maxWords: null,
      uploadDestinationUrl: null,
      options: {
        create: q.options.map((o, j) => ({
          position: j,
          body: o.body,
          isCorrect: o.isCorrect,
        })),
      },
    };
  }
  if (q.type === "PARAGRAPH") {
    return {
      ...base,
      allowMultipleCorrect: false,
      maxWords: q.maxWords,
      uploadDestinationUrl: null,
    };
  }
  return {
    ...base,
    allowMultipleCorrect: false,
    maxWords: null,
    uploadDestinationUrl: q.uploadDestinationUrl,
  };
}

export function prismaAssessmentStore(): AssessmentStore {
  return {
    async create(scope, input) {
      // Single nested create: assessment + questions + options in one atomic
      // statement — no interactive transaction (Neon-safe).
      const row = await prisma.recruiterAssessment.create({
        data: {
          organizationId: scope.organizationId,
          createdByUserId: scope.createdByUserId,
          title: input.title,
          subheading: input.subheading,
          instructions: input.instructions,
          status: "DRAFT",
          durationMinutes: input.durationMinutes,
          passMarkPercent: input.passMarkPercent,
          shortlistRefs: input.shortlistRefs,
          questions: {
            create: input.questions.map((q, i) => questionCreateNested(q, i)),
          },
        },
        select: { id: true },
      });
      return { id: row.id };
    },

    async replaceContent(assessmentId, scope, input) {
      // Ownership check (read), then a single atomic update that clears and
      // recreates the question tree via nested writes — no interactive tx.
      const owned = await prisma.recruiterAssessment.findFirst({
        where: { id: assessmentId, ...scopeWhere(scope) },
        select: { id: true },
      });
      if (!owned) throw new Error("Assessment not found for replace");

      await prisma.recruiterAssessment.update({
        where: { id: assessmentId },
        data: {
          title: input.title,
          subheading: input.subheading,
          instructions: input.instructions,
          durationMinutes: input.durationMinutes,
          passMarkPercent: input.passMarkPercent,
          shortlistRefs: input.shortlistRefs,
          questions: {
            deleteMany: {},
            create: input.questions.map((q, i) => questionCreateNested(q, i)),
          },
        },
        select: { id: true },
      });
    },

    async findOwned(assessmentId, scope): Promise<AssessmentRow | null> {
      const row = await prisma.recruiterAssessment.findFirst({
        where: { id: assessmentId, ...scopeWhere(scope) },
        select: ASSESSMENT_SELECT,
      });
      if (!row) return null;
      return {
        ...row,
        questions: row.questions as AssessmentQuestionRow[],
      };
    },

    async listOwned(scope): Promise<AssessmentListRow[]> {
      const rows = await prisma.recruiterAssessment.findMany({
        where: scopeWhere(scope),
        orderBy: { updatedAt: "desc" },
        select: LIST_SELECT,
      });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        durationMinutes: r.durationMinutes,
        passMarkPercent: r.passMarkPercent,
        questionCount: r._count.questions,
        updatedAt: r.updatedAt,
      }));
    },

    async delete(assessmentId, scope) {
      const owned = await prisma.recruiterAssessment.findFirst({
        where: { id: assessmentId, ...scopeWhere(scope) },
        select: { id: true },
      });
      if (!owned) return false;
      await prisma.recruiterAssessment.delete({
        where: { id: assessmentId },
        select: { id: true },
      });
      return true;
    },
  };
}
