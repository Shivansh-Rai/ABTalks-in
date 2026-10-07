import "server-only";

import {
  MAX_TEMPLATES_PER_RECRUITER,
  assessmentContentSchema,
  createTemplateSchema,
  renameTemplateSchema,
  templateIdSchema,
  updateTemplateContentSchema,
  type AssessmentContent,
} from "@/lib/validations/assessment";
import type { Scope } from "./service";

/**
 * Plan 185 — a recruiter's own assessment templates.
 *
 * Private to the recruiter who saved them. Every function takes the caller's
 * `Scope` (organizationId + createdByUserId, resolved from the session by
 * requireRecruiterWorkspace) and every store call puts it in the WHERE, so a
 * template id is a name and never a capability: another recruiter's id reads
 * as NOT_FOUND, exactly like an id that does not exist.
 *
 * Unrelated to the static ABTalks presets in ./presets.ts, which are code, are
 * shared by everyone and are never written here.
 */

/** A template as its card shows it. No question bodies. */
export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  durationMinutes: number | null;
  updatedAt: Date;
};

/** What `store.find` returns: `content` is raw JSON until the service checks it. */
export type TemplateStoreRow = {
  id: string;
  name: string;
  description: string | null;
  content: unknown;
};

export type Template = {
  id: string;
  name: string;
  description: string | null;
  content: AssessmentContent;
};

export type TemplateStore = {
  count(scope: Scope): Promise<number>;
  list(scope: Scope): Promise<TemplateSummary[]>;
  find(templateId: string, scope: Scope): Promise<TemplateStoreRow | null>;
  create(
    scope: Scope,
    input: { name: string; description: string | null; content: AssessmentContent },
  ): Promise<{ id: string }>;
  /** One guarded write. False when the id is not this recruiter's. */
  updateContent(
    templateId: string,
    scope: Scope,
    content: AssessmentContent,
  ): Promise<boolean>;
  /** One guarded write. False when the id is not this recruiter's. */
  rename(
    templateId: string,
    scope: Scope,
    input: { name: string; description: string | null },
  ): Promise<boolean>;
  /** One guarded write. False when the id is not this recruiter's. */
  delete(templateId: string, scope: Scope): Promise<boolean>;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: "NOT_FOUND" | "INVALID" | "CONFLICT"; message: string };

const OK = <T>(data: T): Result<T> => ({ ok: true, data });
const NOT_FOUND = (): Result<never> => ({
  ok: false,
  code: "NOT_FOUND",
  message: "Template not found",
});
const INVALID = (message: string): Result<never> => ({
  ok: false,
  code: "INVALID",
  message,
});

export async function listTemplates(
  store: TemplateStore,
  scope: Scope,
): Promise<Result<TemplateSummary[]>> {
  return OK(await store.list(scope));
}

/**
 * One template with its content, for the builder. The stored JSON is checked
 * against today's schema before it is handed over: a template saved under
 * older rules must not open a builder that cannot save.
 */
export async function getTemplate(
  store: TemplateStore,
  scope: Scope,
  templateId: unknown,
): Promise<Result<Template>> {
  const parsedId = templateIdSchema.safeParse({ templateId });
  if (!parsedId.success) return NOT_FOUND();

  const row = await store.find(parsedId.data.templateId, scope);
  if (!row) return NOT_FOUND();

  const content = assessmentContentSchema.safeParse(row.content);
  if (!content.success) {
    return INVALID(
      "This template was saved in an older format and can no longer be opened.",
    );
  }
  return OK({
    id: row.id,
    name: row.name,
    description: row.description,
    content: content.data,
  });
}

export async function createTemplate(
  store: TemplateStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid template");
  }

  // A soft cap: it stops a library growing without bound, it is not an
  // invariant anything else relies on. Two saves racing at 49 can land at 51;
  // closing that would need an interactive transaction, which the Neon
  // serverless driver cannot hold (see prisma-store.ts).
  if ((await store.count(scope)) >= MAX_TEMPLATES_PER_RECRUITER) {
    return {
      ok: false,
      code: "CONFLICT",
      message: `You can keep up to ${MAX_TEMPLATES_PER_RECRUITER} templates. Delete one to save another.`,
    };
  }

  const created = await store.create(scope, {
    name: parsed.data.name,
    description: parsed.data.description || null,
    content: parsed.data.content,
  });
  return OK({ id: created.id });
}

/** Overwrite a template's questions and settings. Name and description stay. */
export async function updateTemplateContent(
  store: TemplateStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = updateTemplateContentSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid template");
  }
  const moved = await store.updateContent(
    parsed.data.templateId,
    scope,
    parsed.data.content,
  );
  return moved ? OK({ id: parsed.data.templateId }) : NOT_FOUND();
}

/** Change a template's name and description. Its content stays. */
export async function renameTemplate(
  store: TemplateStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = renameTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return INVALID(parsed.error.issues[0]?.message ?? "Invalid template");
  }
  const moved = await store.rename(parsed.data.templateId, scope, {
    name: parsed.data.name,
    description: parsed.data.description || null,
  });
  return moved ? OK({ id: parsed.data.templateId }) : NOT_FOUND();
}

export async function deleteTemplate(
  store: TemplateStore,
  scope: Scope,
  input: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = templateIdSchema.safeParse(input);
  if (!parsed.success) return INVALID("Invalid input");
  const removed = await store.delete(parsed.data.templateId, scope);
  return removed ? OK({ id: parsed.data.templateId }) : NOT_FOUND();
}
