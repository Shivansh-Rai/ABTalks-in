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
