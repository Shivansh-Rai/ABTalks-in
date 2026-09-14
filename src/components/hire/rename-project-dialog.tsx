"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { renameTalentProjectAction } from "@/app/actions/talent-project-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Rename a project from the nav card's overflow menu.
 *
 * The twin of NewProjectDialog, down to the shared `hire-unlock` classes, so
 * the two read as one desk rather than two dialogs that happen to be nearby.
 * It calls `renameTalentProjectAction` unchanged — that action already resolves
 * the recruiter server-side and scopes its `updateMany` to them, so a renamed
 * project is always the caller's own and this component supplies no identity.
 *
 * The input seeds itself from `currentName` once, on mount. One instance serves
 * every project row in the list, so a value left behind from the last project
 * would be offered as this one's name — the caller prevents that by keying this
 * component on the project id, which remounts it and re-seeds the field. That
 * is React's own answer to "reset state when a prop changes", and it is why
 * there is no effect here syncing a prop into state.
 */
export function RenameProjectDialog({
  open,
  onOpenChange,
  requestId,
  currentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string | null;
  currentName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed || !requestId) {
      setError("Give the project a name.");
      return;
    }
    if (trimmed === currentName.trim()) {
      onOpenChange(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await renameTalentProjectAction({
        requestId,
        name: trimmed,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onOpenChange(false);
      // The action revalidates the project's own routes; this refreshes the
      // layout that feeds the nav card its project list.
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="hire-app hire-unlock sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <p className="hire-auth__kicker">ABTalks Hire</p>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Only the name changes. The project keeps its searches, shortlist and
            assessments.
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
                save();
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
            onClick={save}
            disabled={pending || !name.trim()}
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Saving
              </>
            ) : (
              "Save name"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
