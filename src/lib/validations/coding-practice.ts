import { z } from "zod";
import {
  CODE_LANGUAGE_IDS,
  type CodeLanguageId,
} from "@/features/code-runner/languages";
import {
  PRACTICE_MAX_CODE_CHARS,
  PRACTICE_PROGRAM_SLUGS,
  PRACTICE_QUESTIONS_PER_DAY,
} from "@/features/coding-practice/constants";

const languageSchema = z.enum(CODE_LANGUAGE_IDS);

/** `challenge.json` for one coding practice challenge. */
export const practiceChallengeSchema = z
  .object({
    programSlug: z.string().regex(/^[a-z0-9-]{3,40}$/),
    /** Short code used inside Activity ids (`act_dsa_<idCode>_d01_q1`). */
    idCode: z.string().regex(/^[a-z0-9]{2,8}$/),
    title: z.string().trim().min(3).max(120),
    subtitle: z.string().trim().min(3).max(200),
    description: z.string().trim().min(3).max(600),
    totalDays: z.number().int().min(1).max(60),
    languages: z.array(languageSchema).min(1),
    defaultLanguage: languageSchema,
  })
  .strict()
  .refine((c) => c.languages.includes(c.defaultLanguage), {
    path: ["defaultLanguage"],
    message: "defaultLanguage must be one of languages",
  })
  .refine((c) => new Set(c.languages).size === c.languages.length, {
    path: ["languages"],
    message: "languages must not repeat",
  });

export type PracticeChallengeContent = z.infer<typeof practiceChallengeSchema>;

const testSchema = z
  .object({
    /** Raw stdin: one JSON value per argument, one per line. */
    input: z.string().min(1).max(100_000),
    /** Raw stdout the harness prints for the correct answer. */
    expectedOutput: z.string().min(1).max(100_000),
    hidden: z.boolean(),
    /** Shown to the learner for a sample test, e.g. `arr = [1,2,3]`. */
    display: z
      .object({
        input: z.string().trim().min(1).max(2_000),
        output: z.string().trim().min(1).max(2_000),
      })
      .strict()
      .optional(),
    explanation: z.string().trim().min(1).max(600).optional(),
  })
  .strict();

const codeSchema = z.string().min(1).max(10_000);

const harnessSchema = z
  .object({
    /** Imports placed before the learner's code. May be empty. */
    prefix: z.string().max(10_000),
    /** Reads stdin, calls the learner's function, prints the result. */
    driver: codeSchema,
  })
  .strict();

const questionSchema = z
  .object({
    slot: z.number().int().min(1).max(PRACTICE_QUESTIONS_PER_DAY),
    title: z.string().trim().min(3).max(120),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(8),
    statementMd: z.string().trim().min(20).max(20_000),
    timeLimitSec: z.number().int().min(1).max(5).default(2),
    starterCode: z.partialRecord(languageSchema, codeSchema),
    /** SERVER-ONLY. Never sent to the browser, never saved with a submission. */
    harness: z.partialRecord(languageSchema, harnessSchema),
    tests: z.array(testSchema),
    /** SERVER-ONLY. Written by us to verify the tests; never supplied. */
    solution: z
      .object({ language: languageSchema, code: codeSchema })
      .strict()
      .optional(),
  })
  .strict();

export type PracticeQuestionContent = z.infer<typeof questionSchema>;

/**
 * `day-NN.json`, validated against its challenge: every challenge language has
 * starter code and a harness, and every question has exactly two sample tests
 * and two hidden tests.
 */
export function practiceDaySchemaFor(challenge: {
  totalDays: number;
  languages: readonly CodeLanguageId[];
}) {
  return z
    .object({
      day: z.number().int().min(1).max(challenge.totalDays),
      questions: z.array(questionSchema).length(PRACTICE_QUESTIONS_PER_DAY),
    })
    .strict()
    .superRefine((day, ctx) => {
      day.questions.forEach((question, index) => {
        const at = (...path: (string | number)[]) => [
          "questions",
          index,
          ...path,
        ];
        if (question.slot !== index + 1) {
          ctx.addIssue({
            code: "custom",
            path: at("slot"),
            message: `question ${index + 1} must have slot ${index + 1}`,
          });
        }
        for (const language of challenge.languages) {
          if (!question.starterCode[language]) {
            ctx.addIssue({
              code: "custom",
              path: at("starterCode", language),
              message: `starter code missing for ${language}`,
            });
          }
          if (!question.harness[language]) {
            ctx.addIssue({
              code: "custom",
              path: at("harness", language),
              message: `harness missing for ${language}`,
            });
          }
        }
        const visible = question.tests.filter((t) => !t.hidden);
        const hidden = question.tests.filter((t) => t.hidden);
        if (visible.length !== 2 || hidden.length !== 2) {
          ctx.addIssue({
            code: "custom",
            path: at("tests"),
            message: "each question needs exactly 2 sample and 2 hidden tests",
          });
        }
        question.tests.forEach((test, testIndex) => {
          if (!test.hidden && (!test.display || !test.explanation)) {
            ctx.addIssue({
              code: "custom",
              path: at("tests", testIndex),
              message: "a sample test needs display text and an explanation",
            });
          }
        });
      });
    });
}

export type PracticeDayContent = z.infer<
  ReturnType<typeof practiceDaySchemaFor>
>;

/** Body of POST /api/practice/run. The client never sends an activity id. */
export const practiceRunSchema = z
  .object({
    challenge: z.enum(PRACTICE_PROGRAM_SLUGS),
    day: z.number().int().min(1).max(60),
    slot: z.number().int().min(1).max(PRACTICE_QUESTIONS_PER_DAY),
    language: languageSchema,
    code: z.string().min(1).max(PRACTICE_MAX_CODE_CHARS),
    /** Run once against this stdin instead of the sample tests. */
    customInput: z.string().min(1).max(10_000).optional(),
  })
  .strict();

export type PracticeRunInput = z.infer<typeof practiceRunSchema>;

export const practiceEnrollSchema = z
  .object({ challenge: z.enum(PRACTICE_PROGRAM_SLUGS) })
  .strict();

/** Input of the Submit action. Same shape as a Run. */
export const practiceSubmitSchema = practiceRunSchema.omit({ customInput: true });

/** `ActivityAttempt.payload` for a saved practice solution. */
export const savedSolutionSchema = z.object({
  code: z.string(),
  language: languageSchema,
});
