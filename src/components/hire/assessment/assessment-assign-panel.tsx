"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  assignRecruiterAssessmentAction,
  publishRecruiterAssessmentAction,
} from "@/app/actions/recruiter-assessment-actions";
import { MAX_ASSIGN_PER_CALL } from "@/lib/validations/assessment";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AssignPanelProps = {
  assessmentId: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  candidates: {
    candidateRef: string;
    label: string; // display name, else AB-####
    jobRole: string;
    alreadyAssigned: boolean;
  }[];
};

export function AssessmentAssignPanel({
  assessmentId,
  status,
  candidates,
}: AssignPanelProps) {
  if (status === "DRAFT") return <PublishBlock assessmentId={assessmentId} />;
  if (status === "PUBLISHED") {
    return <AssignBlock assessmentId={assessmentId} candidates={candidates} />;
  }
  // Nothing writes ARCHIVED yet.
  return null;
}

function PublishBlock({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function publish() {
    startTransition(async () => {
      const res = await publishRecruiterAssessmentAction({ assessmentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.data.alreadyPublished ? "Already published" : "Published");
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <section className="hire-assess-assign" aria-label="Publish">
      {!confirming ? (
        <button
          type="button"
          className={cn(buttonVariants({ variant: "default" }))}
          onClick={() => setConfirming(true)}
        >
          Publish assessment
        </button>
      ) : (
        <div className="hire-assess-assign__confirm" role="group" aria-label="Confirm publish">
          <p>
            Publishing locks the questions and the pass mark. Every candidate you
            assign sees exactly this version.
          </p>
          <div className="hire-assess-assign__confirm-actions">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              disabled={pending}
              onClick={publish}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Publish
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AssignBlock({
  assessmentId,
  candidates,
}: {
  assessmentId: string;
  candidates: AssignPanelProps["candidates"];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();

  const selectable = useMemo(
    () => candidates.filter((c) => !c.alreadyAssigned),
    [candidates],
  );
  // Only refs still selectable are ever sent — a row that became assigned or
  // left the Shortlist since the last render drops out on its own.
  const picked = selectable.filter((c) => selected.has(c.candidateRef));
  const count = picked.length;
  const overCap = count > MAX_ASSIGN_PER_CALL;
  const allPicked = selectable.length > 0 && count === selectable.length;

  function toggle(ref: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  function assign() {
    const candidateRefs = picked.map((c) => c.candidateRef);
    startTransition(async () => {
      const res = await assignRecruiterAssessmentAction({
        assessmentId,
        candidateRefs,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const { assigned, alreadyAssigned, notificationFailures } = res.data;
      toast.success(
        `Assigned to ${assigned}.` +
          (alreadyAssigned > 0 ? ` ${alreadyAssigned} already had it.` : ""),
      );
      if (notificationFailures > 0) {
        toast.warning(
          `${notificationFailures} notification${notificationFailures === 1 ? "" : "s"} could not be sent. Assign again to retry — nobody is notified twice.`,
        );
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <section className="hire-assess-assign" aria-label="Assign">
      <h2>Assign to Shortlisted candidates</h2>

      {candidates.length === 0 ? (
        <p className="hire-assess-assign__empty">
          Your Shortlist is empty. Shortlist candidates on Hire, then come back to
          assign.{" "}
          <Link href="/hire" className="hire-assess-linkbtn">
            Go to Hire
          </Link>
        </p>
      ) : (
        <fieldset className="hire-assess-assign__fieldset" aria-busy={pending}>
          <legend className="sr-only">Shortlisted candidates</legend>
          {selectable.length > 0 && (
            <button
              type="button"
              className="hire-assess-linkbtn"
              disabled={pending}
              onClick={() =>
                setSelected(
                  allPicked
                    ? new Set()
                    : new Set(selectable.map((c) => c.candidateRef)),
                )
              }
            >
              {allPicked ? "Clear selection" : "Select all not yet assigned"}
            </button>
          )}

          <ul className="hire-assess-assign__list">
            {candidates.map((c) => (
              <li key={c.candidateRef}>
                <label className="hire-assess-assign__row">
                  <input
                    type="checkbox"
                    checked={c.alreadyAssigned || selected.has(c.candidateRef)}
                    disabled={c.alreadyAssigned || pending}
                    onChange={() => toggle(c.candidateRef)}
                  />
                  <span className="hire-assess-assign__who">
                    <span>{c.label}</span>
                    <span className="hire-assess-detail__role">{c.jobRole}</span>
                  </span>
                  {c.alreadyAssigned && (
                    <span className="hire-assess-assign__tag">Assigned</span>
                  )}
                </label>
              </li>
            ))}
          </ul>

          <div className="hire-assess-assign__submit">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }), "gap-2")}
              disabled={count === 0 || pending || overCap}
              onClick={assign}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Assign to {count} candidate{count === 1 ? "" : "s"}
            </button>
            {overCap && (
              <span className="hire-assess-error">
                Assign at most {MAX_ASSIGN_PER_CALL} at a time
              </span>
            )}
          </div>
        </fieldset>
      )}
    </section>
  );
}
