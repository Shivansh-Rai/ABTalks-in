"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createTalentProjectAction } from "@/app/actions/project-session-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "New project" (plan 133): name it, create it, open it.
 *
 * The project exists in the database the moment this succeeds — before any
 * search. Its searches come later, each as its own session inside it.
 * Reuses the unlock dialog's classes so it reads as part of the same desk.
 */
export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the project a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createTalentProjectAction({ name: trimmed });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName("");
      onOpenChange(false);
      router.push(`/hire/${result.data.requestId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hire-app hire-unlock sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <p className="hire-auth__kicker">ABTalks Hire</p>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A project keeps its own searches, shortlist and assessments —
            separate from every other project.
          </DialogDescription>
        </DialogHeader>

        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            maxLength={80}
            autoFocus
            placeholder="e.g. Frontend Engineer"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          />
        </label>
        {error && <p className="hire-unlock__notice">{error}</p>}

        <div className="hire-unlock__actions">
          <button
            type="button"
            className="hire-unlock__cancel"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hire-unlock__confirm"
            onClick={create}
            disabled={pending || !name.trim()}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Creating
              </>
            ) : (
              "Create project"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
