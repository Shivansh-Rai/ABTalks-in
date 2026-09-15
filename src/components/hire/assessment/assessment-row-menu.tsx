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
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteRecruiterAssessmentAction,
  duplicateRecruiterAssessmentAction,
} from "@/app/actions/recruiter-assessment-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * The ⋮ "View more" menu on each /hire/assessments row and card. Secondary
 * actions only — the state's primary action (Continue editing / View results)
 * sits next to it on the row. Delete is DRAFT-only (the service refuses
 * published ones) and always goes through a confirm dialog.
 */
export function AssessmentRowMenu({
  assessmentId,
  title,
  status,
}: {
  assessmentId: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
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

  function remove() {
    startTransition(async () => {
      const res = await deleteRecruiterAssessmentAction({ assessmentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setConfirmOpen(false);
      toast.success("Draft deleted");
      router.refresh();
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
          {isDraft ? (
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer hire-assess-menu__danger"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Delete draft
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="hire-assess-menu__locked">
              <Trash2 aria-hidden="true" />
              <span>
                Delete
                <small>Published tests keep candidate results</small>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              &ldquo;{title}&rdquo; and its questions will be removed. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={remove}
              disabled={pending}
            >
              <Trash2 aria-hidden="true" />
              {pending ? "Deleting…" : "Delete draft"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
