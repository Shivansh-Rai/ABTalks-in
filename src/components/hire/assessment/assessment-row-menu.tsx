"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChartColumn,
  Copy,
  EllipsisVertical,
  Eye,
  PencilLine,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { duplicateRecruiterAssessmentAction } from "@/app/actions/recruiter-assessment-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssessmentDeleteDialog } from "./assessment-delete";

/**
 * The ⋮ "View more" menu on each /hire/assessments row and card. Secondary
 * actions only — the state's primary action (Continue editing / View results)
 * sits next to it on the row. Delete is offered in every status and always
 * goes through the confirm dialog, which asks for a typed word when candidates
 * hold results on the assessment.
 */
export function AssessmentRowMenu({
  assessmentId,
  title,
  status,
  assignedCount,
}: {
  assessmentId: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** Candidates it is assigned to: decides how strongly delete is confirmed. */
  assignedCount: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isDraft = status === "DRAFT";

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateRecruiterAssessmentAction({ assessmentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Copy created as a draft");
      router.push(`/hire/create-test?id=${res.data.id}`);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          aria-label={`More actions for ${title}`}
          className="hire-assess-more"
          disabled={pending}
        >
          <EllipsisVertical aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="hire-app hire-menu hire-assess-menu"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={<Link href={`/hire/assessments/${assessmentId}`} />}
              className="cursor-pointer"
            >
              <Eye aria-hidden="true" />
              View details
            </DropdownMenuItem>
            {/* Assigning is open for as long as it is published (plan 184). */}
            {status === "PUBLISHED" && (
              <DropdownMenuItem
                render={
                  <Link href={`/hire/assessments/${assessmentId}#assign`} />
                }
                className="cursor-pointer"
              >
                <UserPlus aria-hidden="true" />
                Assign candidates
              </DropdownMenuItem>
            )}
            {!isDraft && (
              <DropdownMenuItem
                render={
                  <Link href={`/hire/assessments/${assessmentId}#results`} />
                }
                className="cursor-pointer"
              >
                <ChartColumn aria-hidden="true" />
                View results
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              render={<Link href={`/hire/create-test?id=${assessmentId}`} />}
              className="cursor-pointer"
            >
              <PencilLine aria-hidden="true" />
              Open builder
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={duplicate}>
              <Copy aria-hidden="true" />
              Duplicate
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer hire-assess-menu__danger"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            {isDraft ? "Delete draft" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AssessmentDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        surface="recruiter"
        assessmentId={assessmentId}
        title={title}
        assignedCount={assignedCount}
      />
    </>
  );
}
