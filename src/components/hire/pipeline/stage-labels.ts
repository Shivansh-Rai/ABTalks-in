import { PipelineStage } from "@prisma/client";
import { PIPELINE_STAGE_ORDER } from "@/repositories/talent-pipeline";

/**
 * The nine stages in the order the board renders them, plus the human
 * labels shown in column headers and the stage picker. Kept in one file
 * so a rename ripples everywhere at once.
 */
export const STAGE_ORDER: PipelineStage[] = PIPELINE_STAGE_ORDER;

export const STAGE_LABEL: Record<PipelineStage, string> = {
  SOURCED: "Sourced",
  SHORTLISTED: "Shortlisted",
  CONTACTED: "Contacted",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

/** Empty-state copy per column — read out loud to check tone. */
export const STAGE_EMPTY_HINT: Record<PipelineStage, string> = {
  SOURCED: "No one sourced yet.",
  SHORTLISTED: "No shortlisted candidates.",
  CONTACTED: "No one contacted yet.",
  SCREENING: "No one in screening.",
  INTERVIEWING: "No one interviewing.",
  OFFER: "No offers out.",
  HIRED: "No one hired yet.",
  REJECTED: "No rejections.",
  WITHDRAWN: "No withdrawals.",
};
