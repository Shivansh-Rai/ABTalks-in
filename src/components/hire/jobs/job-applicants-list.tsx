"use client";

import type { JobApplicationStatus } from "@prisma/client";
import {
  APPLICATION_STATUS_BADGE,
  APPLICATION_STATUS_LABEL,
} from "@/components/jobs/job-ui";
import { useApplicantInspect } from "@/components/hire/jobs/job-applicants-desk";
import { cn } from "@/lib/utils";

export type ApplicantListRow = {
  id: string;
  candidateRef: string;
  displayName: string;
  note: string | null;
  status: JobApplicationStatus;
  appliedLabel: string;
};

type Props = {
  applicants: ApplicantListRow[];
  selectedRef?: string | null;
  onSelect?: (candidateRef: string) => void;
};

const CARD_CLASS = "rounded-xl border border-[#E0E0E0] bg-white";

export function JobApplicantsList({ applicants, selectedRef, onSelect }: Props) {
  const inspect = useApplicantInspect();
  const select = onSelect ?? inspect?.onSelect;
  const current = selectedRef ?? inspect?.selectedRef ?? null;
  const clickable = typeof select === "function";

  return (
    <section className="mt-8">
      <h2 className="font-heading text-xl font-semibold text-black">
        Applicants ({applicants.length})
      </h2>

      {applicants.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No applications yet.</p>
      ) : (
        <ul className={cn(CARD_CLASS, "mt-4 divide-y divide-[#E0E0E0]")}>
          {applicants.map((row) => {
            const selected = current === row.candidateRef;
            return (
              <li key={row.id}>
                {clickable ? (
                  <button
                    type="button"
                    className={cn(
                      "w-full px-5 py-4 text-left transition-colors",
                      selected ? "bg-[#EEF6F6]" : "hover:bg-[#F7FBFB]",
                    )}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => select(row.candidateRef)}
                  >
                    <ApplicantRowBody row={row} />
                  </button>
                ) : (
                  <div className="px-5 py-4">
                    <ApplicantRowBody row={row} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ApplicantRowBody({ row }: { row: ApplicantListRow }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-[16px] leading-6 font-semibold text-black">
            {row.displayName}
          </p>
          <p className="mt-0.5 text-xs text-[#4B4B4B]">
            Applied {row.appliedLabel}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-[7px] px-2.5 py-1.5 text-xs font-medium",
            APPLICATION_STATUS_BADGE[row.status],
          )}
        >
          {APPLICATION_STATUS_LABEL[row.status]}
        </span>
      </div>
      {row.note ? (
        <p className="mt-2 text-sm text-[#4B4B4B]">{row.note}</p>
      ) : null}
    </>
  );
}
