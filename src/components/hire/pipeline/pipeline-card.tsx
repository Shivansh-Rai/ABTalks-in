"use client";

import { useTransition, useState } from "react";
import { PipelineStage } from "@prisma/client";
import { Trash2 } from "lucide-react";
import {
  moveCandidateStageAction,
  removeCandidateFromPipelineAction,
} from "@/app/actions/recruiter-pipeline-actions";
import { STAGE_LABEL, STAGE_ORDER } from "./stage-labels";
import { cn } from "@/lib/utils";

export type PipelineCardProps = {
  itemId: string;
  candidateLabel: string;
  candidateUserId: string | null;
  stage: PipelineStage;
  addedAtIso: string;
  stageChangedAtIso: string;
  /** Called after a successful move so the board can reshuffle optimistically. */
  onMoved: (itemId: string, next: PipelineStage) => void;
  /** Called after a successful remove so the board can drop the row. */
  onRemoved: (itemId: string) => void;
  /** Called if an action fails so the board can revert its optimistic change. */
  onError: (message: string) => void;
};

function relativeDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * One candidate on the pipeline board. Owns its own move/remove transitions —
 * the parent board only hears about them through the three callbacks so it
 * can update its bucket state.
 */
export function PipelineCard({
  itemId,
  candidateLabel,
  candidateUserId,
  stage,
  stageChangedAtIso,
  onMoved,
  onRemoved,
  onError,
}: PipelineCardProps) {
  const [pending, startTransition] = useTransition();
  const [selectValue, setSelectValue] = useState<PipelineStage>(stage);

  function handleStageChange(next: PipelineStage) {
    if (next === stage) return;
    setSelectValue(next);
    startTransition(async () => {
      const result = await moveCandidateStageAction({ itemId, stage: next });
      if (result.ok) {
        onMoved(itemId, next);
      } else {
        setSelectValue(stage);
        onError(result.message);
      }
    });
  }

  function handleRemove() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${candidateLabel} from your pipeline?`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await removeCandidateFromPipelineAction({ itemId });
      if (result.ok) {
        onRemoved(itemId);
      } else {
        onError(result.message);
      }
    });
  }

  return (
    <div
      data-slot="pipeline-card"
      data-pending={pending || undefined}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm shadow-sm transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {candidateLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Moved {relativeDay(stageChangedAtIso)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          aria-label={`Remove ${candidateLabel} from pipeline`}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Stage</span>
        <select
          value={selectValue}
          disabled={pending || candidateUserId === null}
          onChange={(e) => handleStageChange(e.target.value as PipelineStage)}
          className="flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
