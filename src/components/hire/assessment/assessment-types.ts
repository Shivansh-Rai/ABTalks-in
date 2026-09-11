import type {
  AnswerPayload,
  AssessmentDraftInput,
  AssessmentQuestionInput,
} from "@/lib/validations/assessment";

export type AssessmentDraft = AssessmentDraftInput;
export type AssessmentQuestion = AssessmentQuestionInput;

/**
 * Client-only draft question with a stable React key (never sent to the server).
 * `locked` marks a preset-provided question: editable controls are disabled, but
 * it can still be removed/reordered. Both `key` and `locked` are stripped before
 * the payload is validated and sent.
 */
export type DraftQuestion = AssessmentQuestion & {
  key: string;
  locked?: boolean;
};

/**
 * What CandidateAssessmentScreen renders (T-218, plan 129).
 *
 * A structural SUBSET of the builder draft, so the builder preview passes its
 * draft unchanged. Deliberately has no isCorrect: the candidate page builds it
 * from a query that never selects it. Ids are present for a real attempt and
 * absent in the builder preview, where the screen falls back to positions.
 */
export type CandidateOption = { id?: string; body: string };

type CandidateQuestionBase = {
  id?: string;
  title: string;
  helpText?: string | null;
  isRequired: boolean;
  points: number;
};

export type CandidateQuestion =
  | (CandidateQuestionBase & {
      type: "MULTIPLE_CHOICE";
      allowMultipleCorrect: boolean;
      options: CandidateOption[];
    })
  | (CandidateQuestionBase & { type: "PARAGRAPH"; maxWords?: number | null })
  | (CandidateQuestionBase & {
      type: "FILE_UPLOAD";
      uploadDestinationUrl: string | null;
    });

export type CandidateAssessmentView = {
  title: string;
  subheading?: string | null;
  instructions?: string | null;
  durationMinutes: number | null;
  passMarkPercent: number;
  questions: CandidateQuestion[];
};

/** One answer, in the exact shape the autosave action sends. */
export type CandidateAnswer = AnswerPayload;
