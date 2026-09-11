import { z } from "zod";

export const MAX_PARAGRAPH_WORDS = 250;

const optionSchema = z.object({
  body: z.string().trim().min(1, "Give this option a name").max(300),
  isCorrect: z.boolean().default(false),
});

const baseQuestion = z.object({
  title: z.string().trim().min(1, "Write the question").max(2000),
  helpText: z.string().trim().max(1000).optional().nullable(),
  isRequired: z.boolean().default(true),
  points: z.number().int().min(0).max(100).default(1),
});

const mcqSchema = baseQuestion
  .extend({
    type: z.literal("MULTIPLE_CHOICE"),
    allowMultipleCorrect: z.boolean().default(false),
    options: z.array(optionSchema).min(2, "Add at least two options").max(12),
  })
  .strict();

const paragraphSchema = baseQuestion
  .extend({
    type: z.literal("PARAGRAPH"),
    maxWords: z.number().int().min(10).max(1000).default(MAX_PARAGRAPH_WORDS),
  })
  .strict();

const fileUploadSchema = baseQuestion
  .extend({
    type: z.literal("FILE_UPLOAD"),
    uploadDestinationUrl: z
      .string()
      .trim()
      .url("Enter the full link where the file should be uploaded"),
  })
  .strict();

export const assessmentQuestionSchema = z.discriminatedUnion("type", [
  mcqSchema,
  paragraphSchema,
  fileUploadSchema,
]);

export const assessmentDraftSchema = z
  .object({
    assessmentId: z.string().min(1).optional(), // present = update
    title: z.string().trim().min(1, "Give the assessment a title").max(200),
    subheading: z.string().trim().max(300).optional().nullable(),
    instructions: z.string().trim().max(5000).optional().nullable(),
    durationMinutes: z.number().int().min(1).max(480).nullable().default(null),
    passMarkPercent: z.number().int().min(0).max(100).default(60),
    shortlistRefs: z.array(z.string().max(64)).max(500).default([]),
    questions: z
      .array(assessmentQuestionSchema)
      .min(1, "Add at least one question")
      .max(100),
  })
  .superRefine((draft, ctx) => {
    draft.questions.forEach((q, qi) => {
      if (q.type !== "MULTIPLE_CHOICE") return;
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mark at least one option as correct",
          path: ["questions", qi, "options"],
        });
      }
      if (!q.allowMultipleCorrect && correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick exactly one correct option",
          path: ["questions", qi, "options"],
        });
      }
    });
  });

export type AssessmentDraftInput = z.infer<typeof assessmentDraftSchema>;
export type AssessmentQuestionInput = z.infer<typeof assessmentQuestionSchema>;

/** One assign call notifies at most this many people (sequential sends). */
export const MAX_ASSIGN_PER_CALL = 25;

export const publishAssessmentSchema = z.object({
  assessmentId: z.string().min(1),
});

export const assignAssessmentSchema = z.object({
  assessmentId: z.string().min(1),
  candidateRefs: z
    .array(z.string().trim().min(3).max(200))
    .min(1, "Pick at least one candidate")
    .max(
      MAX_ASSIGN_PER_CALL,
      `Assign at most ${MAX_ASSIGN_PER_CALL} candidates at a time`,
    ),
});

export type AssignAssessmentInput = z.infer<typeof assignAssessmentSchema>;

/** Plan 130 — the builder's Create: save, publish and send in one step. */
export const createAndSendSchema = z.object({
  draft: assessmentDraftSchema,
  candidateRefs: assignAssessmentSchema.shape.candidateRefs,
});

export type CreateAndSendInput = z.infer<typeof createAndSendSchema>;

// ---------------------------------------------------------------------------
// T-218 (plan 129) — candidate answers. Shared by the candidate screen and the
// server so the two can never disagree about what counts as an answer.
// ---------------------------------------------------------------------------

/** Longest paragraph answer stored, in characters. The word cap is per question
 *  and is enforced at submit, so nothing a candidate types is ever refused. */
export const MAX_ANSWER_CHARS = 20_000;
export const MAX_ANSWER_URL_CHARS = 2_000;

/** One definition, so the screen's counter and the server's cap agree. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** http(s) only. Zod 4's .url() also accepts javascript: and data: URLs. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const answerPayloadSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("choice"),
      selectedOptionIds: z.array(z.string().min(1).max(64)).max(12),
    })
    .strict(),
  z
    .object({
      kind: z.literal("text"),
      // NOT trimmed: the answer is restored exactly as it was typed.
      text: z.string().max(MAX_ANSWER_CHARS),
    })
    .strict(),
  z
    .object({
      kind: z.literal("file"),
      fileUrl: z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .max(MAX_ANSWER_URL_CHARS)
          .refine(isHttpUrl, "Paste a full link starting with https://"),
      ]),
    })
    .strict(),
]);
export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

export const attemptActionSchema = z.object({
  assignmentId: z.string().min(1).max(64),
});

export const saveAnswerSchema = attemptActionSchema.extend({
  questionId: z.string().min(1).max(64),
  answer: answerPayloadSchema,
});

/** Whether an answer satisfies a required question. Shared by the screen's
 *  "N required left" hint and the server's submit check. */
export function isAnswerComplete(
  type: "MULTIPLE_CHOICE" | "PARAGRAPH" | "FILE_UPLOAD",
  answer: AnswerPayload | undefined,
): boolean {
  if (!answer) return false;
  if (type === "MULTIPLE_CHOICE") {
    return answer.kind === "choice" && answer.selectedOptionIds.length > 0;
  }
  if (type === "PARAGRAPH") {
    return answer.kind === "text" && answer.text.trim().length > 0;
  }
  return answer.kind === "file" && isHttpUrl(answer.fileUrl);
}

/** The refusal copy for an incomplete submission. The server returns it and the
 *  screen shows it before the click, in the same words. */
export function incompleteMessage(
  missingRequired: number,
  overLimit: number,
): string {
  const q = `${missingRequired} required question${missingRequired === 1 ? "" : "s"}`;
  const a = `${overLimit} answer${overLimit === 1 ? "" : "s"}`;
  if (missingRequired > 0 && overLimit > 0) {
    return `Answer the ${q} left and shorten ${a} over the word limit before submitting.`;
  }
  if (missingRequired > 0) return `Answer the ${q} left before submitting.`;
  return `Shorten ${a} over the word limit before submitting.`;
}
