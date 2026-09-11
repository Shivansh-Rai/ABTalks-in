import type {
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
