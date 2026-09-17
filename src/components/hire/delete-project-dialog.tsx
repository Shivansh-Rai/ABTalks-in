"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTalentProjectAction } from "@/app/actions/talent-project-actions";
import { setProjectPinnedLocally } from "@/components/hire/desk-pinned-projects";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DeleteProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  function handleDelete() {
    if (!project) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTalentProjectAction({ requestId: project.id });
      if (!res.ok) {
        setError(res.message);
        toast.error(res.message);
        return;
      }
      setProjectPinnedLocally(project.id, false);
      toast.success("Project deleted");
      onOpenChange(false);

      // If recruiter is currently viewing this project, navigate away to /hire
      if (pathname === `/hire/${project.id}` || pathname.startsWith(`/hire/${project.id}/`) || pathname.startsWith(`/hire/${project.id}?`)) {
        router.push("/hire");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="hire-app sm:max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete this project?</DialogTitle>
          <DialogDescription>
            &ldquo;{project.name}&rdquo; and its searches, shortlist, and assessments will be removed. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }))}
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "destructive" }))}
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete project
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
