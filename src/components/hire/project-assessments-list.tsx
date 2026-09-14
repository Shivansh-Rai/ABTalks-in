"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  linkProjectAssessmentAction,
  unlinkProjectAssessmentAction,
} from "@/app/actions/project-session-actions";
import type { DeskAssessment } from "@/components/hire/hire-desk-context";

/**
 * The open project's assessments, in the nav card (plan 133).
 *
 * Shows only this project's filed assessments. "Attach" files one of the
 * recruiter's Unassigned assessments here; "×" returns it to Unassigned. The
 * assessments themselves are never edited — filing lives in its own table.
 */
export function ProjectAssessmentsList({
  projectId,
  assessments,
  unassigned,
}: {
  projectId: string;
  assessments: DeskAssessment[];
  unassigned: DeskAssessment[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [pending, startTransition] = useTransition();

  function attach() {
    if (!picked) return;
    startTransition(async () => {
      const res = await linkProjectAssessmentAction({
        requestId: projectId,
        assessmentId: picked,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setPicked("");
      router.refresh();
    });
  }

  function detach(assessmentId: string) {
    startTransition(async () => {
      const res = await unlinkProjectAssessmentAction({ assessmentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    /* No heading of its own: the sidebar renders this inside a section that
       already carries the "Assessments" kicker, and two identical headings
       stacked is what this looked like before. */
    <div className="space-y-1.5 px-1 text-xs">
      {assessments.length === 0 ? (
        <p className="text-muted-foreground">None in this project yet.</p>
      ) : (
        <ul className="space-y-1">
          {assessments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <Link href={`/hire/assessments/${a.id}`} className="truncate hover:underline">
                {a.title}
              </Link>
              <button
                type="button"
                onClick={() => detach(a.id)}
                disabled={pending}
                aria-label={`Move ${a.title} to Unassigned`}
                title="Move to Unassigned"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {unassigned.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            aria-label="Attach an unassigned assessment"
            className="min-w-0 flex-1 rounded border bg-background px-1.5 py-1"
          >
            <option value="">Attach unassigned…</option>
            {unassigned.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={attach}
            disabled={pending || !picked}
            className="rounded border px-2 py-1 disabled:opacity-50"
          >
            Attach
          </button>
        </div>
      )}
    </div>
  );
}
