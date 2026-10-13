"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRecruiterAssessmentAction } from "@/app/actions/recruiter-assessment-actions";
import { deletePlatformAssessmentAction } from "@/app/actions/admin-assessment-actions";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The word a recruiter or admin types before results are deleted. */
const CONFIRM_WORD = "DELETE";

type DeleteTarget = {
  assessmentId: string;
  title: string;
  /**
   * How many candidates it is assigned to. Above zero, deleting it also
   * deletes their attempts and results, and the dialog asks for a typed word.
   */
  assignedCount: number;
  /**
   * Which delete this is. "recruiter" goes through the workspace-gated action
   * and "admin" through the requireAdmin one; each refuses the other's caller
   * on the server, so this only picks the action, it grants nothing.
   */
  surface: "recruiter" | "admin";
};

/**
 * Confirm, then delete an assessment in any status.
 *
 * A draft, or a published assessment nobody was sent, is one click to confirm.
 * One that candidates hold results on says exactly what goes with it and needs
 * the word DELETE typed, because nothing here can be undone.
 */
export function AssessmentDeleteDialog({
  open,
  onOpenChange,
  assessmentId,
  title,
  assignedCount,
  surface,
  redirectTo,
}: DeleteTarget & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to go afterwards. Omit on a list, which just refreshes. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const hasResults = assignedCount > 0;
  const confirmed = !hasResults || typed.trim().toUpperCase() === CONFIRM_WORD;

  function close(next: boolean) {
    if (pending) return;
    if (!next) setTyped("");
    onOpenChange(next);
  }

  function remove() {
    if (!confirmed) return;
    startTransition(async () => {
      const res =
        surface === "admin"
          ? await deletePlatformAssessmentAction({ assessmentId })
          : await deleteRecruiterAssessmentAction({ assessmentId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setTyped("");
      onOpenChange(false);
      toast.success("Assessment deleted");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        // Recruiter dialogs carry the desk's tokens; admin keeps its own.
        className={cn("sm:max-w-md", surface === "recruiter" && "hire-app")}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Delete this assessment?</DialogTitle>
          <DialogDescription>
            {hasResults ? (
              <>
                &ldquo;{title}&rdquo; has been sent to {assignedCount} candidate
                {assignedCount === 1 ? "" : "s"}. Deleting it also permanently
                deletes their attempts, answers and results, and removes it
                from their Assessments page. This can&apos;t be undone.
              </>
            ) : (
              <>
                &ldquo;{title}&rdquo; and its questions will be removed. This
                can&apos;t be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasResults ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`delete-confirm-${assessmentId}`}>
              Type {CONFIRM_WORD} to confirm
            </Label>
            <Input
              id={`delete-confirm-${assessmentId}`}
              value={typed}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed && !pending) remove();
              }}
            />
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }))}
            disabled={pending}
            onClick={() => close(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "destructive" }))}
            disabled={pending || !confirmed}
            onClick={remove}
          >
            <Trash2 aria-hidden="true" />
            {pending ? "Deleting…" : "Delete assessment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The delete control itself, in two shapes:
 *
 * - `icon`: a quiet bin for a table row. With `revealOnHover` it stays out of
 *   the way until the row (a `group`) is hovered or holds focus. On touch
 *   screens, which cannot hover, it is always shown.
 * - `button`: a labelled outline button, for a page header beside Edit.
 */
export function AssessmentDeleteButton({
  variant,
  revealOnHover = false,
  redirectTo,
  className,
  ...target
}: DeleteTarget & {
  variant: "icon" | "button";
  revealOnHover?: boolean;
  redirectTo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label={`Delete ${target.title}`}
          title="Delete"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex size-9 flex-none items-center justify-center rounded-[10px] text-[#787878] transition-[opacity,background-color,color] duration-150",
            "hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50 focus-visible:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600",
            revealOnHover &&
              "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
            // Stays visible while its own dialog is open.
            open && "opacity-100",
            className,
          )}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "text-red-700 hover:bg-red-50 hover:text-red-800",
            className,
          )}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </button>
      )}

      <AssessmentDeleteDialog
        open={open}
        onOpenChange={setOpen}
        redirectTo={redirectTo}
        {...target}
      />
    </>
  );
}
