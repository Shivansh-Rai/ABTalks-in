import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AssessmentContent } from "@/lib/validations/assessment";
import type { Scope } from "./service";
import type { TemplateStore } from "./templates";

/**
 * Plan 185 — Prisma store for a recruiter's own assessment templates.
 *
 * The isolation rule is structural here: there is no query in this file
 * without `scopeWhere(scope)`, and no lookup by id alone (no findUnique,
 * update or delete, which take only a unique key). Writes to an existing row
 * are updateMany / deleteMany with the scope in the WHERE, so ownership is
 * checked by the same statement that writes — never by a read before it.
 */

const SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  questionCount: true,
  durationMinutes: true,
  updatedAt: true,
} as const;

function scopeWhere(scope: Scope) {
  return {
    organizationId: scope.organizationId,
    createdByUserId: scope.createdByUserId,
  };
}

/**
 * The three columns that hold a template's content. `questionCount` and
 * `durationMinutes` mirror `content` for the card and are only ever written
 * here, together with it, so they cannot drift.
 */
function contentColumns(content: AssessmentContent) {
  return {
    // Validated assessment content is plain JSON: strings, numbers, booleans,
    // null, arrays and objects of those.
    content: content as Prisma.InputJsonObject,
    questionCount: content.questions.length,
    durationMinutes: content.durationMinutes,
  };
}

export function prismaTemplateStore(): TemplateStore {
  return {
    async count(scope) {
      return prisma.recruiterAssessmentTemplate.count({
        where: scopeWhere(scope),
      });
    },

    async list(scope) {
      return prisma.recruiterAssessmentTemplate.findMany({
        where: scopeWhere(scope),
        orderBy: { updatedAt: "desc" },
        select: SUMMARY_SELECT,
      });
    },

    async find(templateId, scope) {
      return prisma.recruiterAssessmentTemplate.findFirst({
        where: { id: templateId, ...scopeWhere(scope) },
        select: { id: true, name: true, description: true, content: true },
      });
    },

    async create(scope, input) {
      const row = await prisma.recruiterAssessmentTemplate.create({
        data: {
          ...scopeWhere(scope),
          name: input.name,
          description: input.description,
          ...contentColumns(input.content),
        },
        select: { id: true },
      });
      return { id: row.id };
    },

    async updateContent(templateId, scope, content) {
      const res = await prisma.recruiterAssessmentTemplate.updateMany({
        where: { id: templateId, ...scopeWhere(scope) },
        data: contentColumns(content),
      });
      return res.count === 1;
    },

    async rename(templateId, scope, input) {
      const res = await prisma.recruiterAssessmentTemplate.updateMany({
        where: { id: templateId, ...scopeWhere(scope) },
        data: { name: input.name, description: input.description },
      });
      return res.count === 1;
    },

    async delete(templateId, scope) {
      const res = await prisma.recruiterAssessmentTemplate.deleteMany({
        where: { id: templateId, ...scopeWhere(scope) },
      });
      return res.count === 1;
    },
  };
}
