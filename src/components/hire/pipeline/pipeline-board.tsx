"use client";

import { useMemo, useState } from "react";
import { PipelineStage } from "@prisma/client";
import { PipelineCard } from "./pipeline-card";
import { PipelineEmptyState } from "./pipeline-empty-state";
import { STAGE_LABEL, STAGE_ORDER } from "./stage-labels";
import { cn } from "@/lib/utils";

/** Row shape as the server component sends it. Dates are ISO strings so the
 *  Server→Client props boundary carries only plain data. */
export type PipelineBoardRow = {
  itemId: string;
  candidateUserId: string | null;
  candidateLabel: string;
  stage: PipelineStage;
  addedAtIso: string;
  stageChangedAtIso: string;
};

export type PipelineBoardProps = {
  rows: PipelineBoardRow[];
};

/**
 * Nine-column kanban board. Owns the local optimistic bucket state so a
 * move/remove reshuffles instantly and reverts if the server refuses.
 *
 * Mobile: horizontal snap-scroll of columns, one column per screen.
 * Desktop (md+): a fixed-height flex row that scrolls horizontally when the
 * viewport can't fit all nine columns at once.
 */
export function PipelineBoard({ rows }: PipelineBoardProps) {
  const [items, setItems] = useState<PipelineBoardRow[]>(rows);
  const [error, setError] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const map: Record<PipelineStage, PipelineBoardRow[]> = {
      SOURCED: [],
      SHORTLISTED: [],
      CONTACTED: [],
      SCREENING: [],
      INTERVIEWING: [],
      OFFER: [],
      HIRED: [],
      REJECTED: [],
      WITHDRAWN: [],
    };
    for (const row of items) map[row.stage].push(row);
    return map;
  }, [items]);

  function handleMoved(itemId: string, next: PipelineStage) {
    setError(null);
    setItems((prev) =>
      prev.map((row) =>
        row.itemId === itemId
          ? {
              ...row,
              stage: next,
              stageChangedAtIso: new Date().toISOString(),
            }
          : row,
      ),
    );
  }

  function handleRemoved(itemId: string) {
    setError(null);
    setItems((prev) => prev.filter((row) => row.itemId !== itemId));
  }

  function handleError(message: string) {
    setError(message);
  }

  const total = items.length;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Hiring pipeline
          </h1>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "No one in your pipeline yet. Add candidates from Scout or from a job's applicants."
              : `${total} candidate${total === 1 ? "" : "s"} across ${STAGE_ORDER.length} stages.`}
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      )}

      <div
        className={cn(
          "-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2",
          "md:snap-none",
        )}
      >
        {STAGE_ORDER.map((stage) => {
          const bucket = buckets[stage];
          return (
            <section
              key={stage}
              data-stage={stage}
              className={cn(
                "flex min-w-[280px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-2",
                "md:min-w-[240px] md:snap-none",
              )}
            >
              <header className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  {STAGE_LABEL[stage]}
                </h2>
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {bucket.length}
                </span>
              </header>
              <div className="flex flex-col gap-2">
                {bucket.length === 0 ? (
                  <PipelineEmptyState stage={stage} />
                ) : (
                  bucket.map((row) => (
                    <PipelineCard
                      key={row.itemId}
                      itemId={row.itemId}
                      candidateLabel={row.candidateLabel}
                      candidateUserId={row.candidateUserId}
                      stage={row.stage}
                      addedAtIso={row.addedAtIso}
                      stageChangedAtIso={row.stageChangedAtIso}
                      onMoved={handleMoved}
                      onRemoved={handleRemoved}
                      onError={handleError}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
