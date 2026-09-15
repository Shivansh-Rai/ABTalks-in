import type { PipelineStage } from "@prisma/client";
import { STAGE_EMPTY_HINT } from "./stage-labels";

/**
 * Per-column empty state. Small, muted, just enough to remove the
 * "is this thing broken?" question a blank column raises.
 */
export function PipelineEmptyState({ stage }: { stage: PipelineStage }) {
  return (
    <div className="pipeline-column__empty rounded-md border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
      {STAGE_EMPTY_HINT[stage]}
    </div>
  );
}
