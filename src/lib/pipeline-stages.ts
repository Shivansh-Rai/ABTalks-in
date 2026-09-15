import { PipelineStage } from "@prisma/client";

/**
 * The nine stages in the order the pipeline board renders them, top-of-funnel
 * first. REJECTED / WITHDRAWN are terminal off-track states kept at the end.
 *
 * This module is deliberately a leaf: no server-only imports, no logger, no
 * Prisma client. Both the client card and the server repository read from
 * here so the order is single-source but neither side pulls the other's
 * runtime dependencies through the import graph.
 */
export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  PipelineStage.SOURCED,
  PipelineStage.SHORTLISTED,
  PipelineStage.CONTACTED,
  PipelineStage.SCREENING,
  PipelineStage.INTERVIEWING,
  PipelineStage.OFFER,
  PipelineStage.HIRED,
  PipelineStage.REJECTED,
  PipelineStage.WITHDRAWN,
];
