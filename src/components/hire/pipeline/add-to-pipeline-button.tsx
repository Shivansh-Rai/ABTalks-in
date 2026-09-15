"use client";

import { useState, useTransition } from "react";
import { KanbanSquare, Check } from "lucide-react";
import { addCandidateRefToPipelineAction } from "@/app/actions/recruiter-pipeline-actions";
import { cn } from "@/lib/utils";

export type AddToPipelineButtonProps = {
  candidateRef: string;
  fallbackLabel?: string;
  /** True if this candidate is already tracked. Renders a disabled pill. */
  initialInPipeline?: boolean;
  className?: string;
};

/**
 * Scout-row pod. One click and the candidate is on the recruiter's pipeline
 * at SHORTLISTED — the bridge from the per-project shortlist triage to the
 * persistent, cross-device pipeline board.
 */
export function AddToPipelineButton({
  candidateRef,
  fallbackLabel,
  initialInPipeline = false,
  className,
}: AddToPipelineButtonProps) {
  const [inPipeline, setInPipeline] = useState(initialInPipeline);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (inPipeline || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addCandidateRefToPipelineAction({
        candidateRef,
        fallbackLabel,
      });
      if (result.ok) {
        setInPipeline(true);
      } else {
        setError(result.message);
      }
    });
  }

  const label = inPipeline ? "In pipeline" : "Pipeline";
  const Icon = inPipeline ? Check : KanbanSquare;
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={inPipeline || pending}
      title={error ?? (inPipeline ? "Already in your pipeline" : "Add to pipeline")}
      aria-label={label}
      className={cn(
        "hire-hbtn hire-hbtn--label",
        inPipeline && "is-current",
        pending && "opacity-60",
        className,
      )}
    >
      <Icon className="hire-hbtn__svg" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
