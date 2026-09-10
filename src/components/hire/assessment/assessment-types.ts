import type {
  AssessmentDraftInput,
  AssessmentQuestionInput,
} from "@/lib/validations/assessment";

export type AssessmentDraft = AssessmentDraftInput;
export type AssessmentQuestion = AssessmentQuestionInput;

/** Client-only draft question with a stable React key (never sent to the server). */
export type DraftQuestion = AssessmentQuestion & { key: string };
