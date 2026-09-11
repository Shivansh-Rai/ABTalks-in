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

function questionCreateData(assessmentId: string, q: ContentInput["questions"][number], position: number) {
  if (q.type === "MULTIPLE_CHOICE") {
    return {
      assessmentId,
      position,
      type: q.type,
      title: q.title,
      helpText: q.helpText ?? null,
      isRequired: q.isRequired,
      points: q.points,
      allowMultipleCorrect: q.allowMultipleCorrect,
      maxWords: null,
      uploadDestinationUrl: null,
      sectionId: null,
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
      assessmentId,
      position,
      type: q.type,
      title: q.title,
      helpText: q.helpText ?? null,
      isRequired: q.isRequired,
      points: q.points,
      allowMultipleCorrect: false,
      maxWords: q.maxWords,
      uploadDestinationUrl: null,
      sectionId: null,
      options: { create: [] as { position: number; body: string; isCorrect: boolean }[] },
    };
  }
  return {
    assessmentId,
    position,
    type: q.type,
    title: q.title,
    helpText: q.helpText ?? null,
    isRequired: q.isRequired,
    points: q.points,
    allowMultipleCorrect: false,
    maxWords: null,
    uploadDestinationUrl: q.uploadDestinationUrl,
    sectionId: null,
    options: { create: [] as { position: number; body: string; isCorrect: boolean }[] },
  };
}

export function prismaAssessmentStore(): AssessmentStore {
  return {
    async create(scope, input) {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.recruiterAssessment.create({
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
          },
          select: { id: true },
        });
        for (const [i, q] of input.questions.entries()) {
          await tx.assessmentQuestion.create({
            data: questionCreateData(created.id, q, i),
            select: { id: true },
          });
        }
        return created;
      });
      return { id: row.id };
    },

    async replaceContent(assessmentId, scope, input) {
      await prisma.$transaction(async (tx) => {
        const owned = await tx.recruiterAssessment.findFirst({
          where: { id: assessmentId, ...scopeWhere(scope) },
          select: { id: true },
        });
        if (!owned) throw new Error("Assessment not found for replace");

        await tx.assessmentQuestion.deleteMany({ where: { assessmentId } });
        for (const [i, q] of input.questions.entries()) {
          await tx.assessmentQuestion.create({
            data: questionCreateData(assessmentId, q, i),
            select: { id: true },
          });
        }
        await tx.recruiterAssessment.update({
          where: { id: assessmentId },
          data: {
            title: input.title,
            subheading: input.subheading,
            instructions: input.instructions,
            durationMinutes: input.durationMinutes,
            passMarkPercent: input.passMarkPercent,
            shortlistRefs: input.shortlistRefs,
          },
          select: { id: true },
        });
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
