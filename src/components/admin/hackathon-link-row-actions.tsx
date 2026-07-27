"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteHackathonLinkAction,
  updateHackathonLinkAction,
} from "@/app/actions/admin-hackathon-link-actions";
import { Button } from "@/components/ui/button";
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

type Props = {
  id: string;
  slug: string;
  label: string;
  note: string | null;
};

export function HackathonLinkRowActions({ id, slug, label, note }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editLabel, setEditLabel] = useState(label);
  const [editSlug, setEditSlug] = useState(slug);
  const [editNote, setEditNote] = useState(note ?? "");
  const [pending, setPending] = useState(false);

  async function handleUpdate() {
    setPending(true);
    const result = await updateHackathonLinkAction({
      id,
      slug: editSlug,
      label: editLabel,
      note: editNote || undefined,
    });
    setPending(false);
    if (result.ok) {
      toast.success("Link updated");
      setEditOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  async function handleDelete() {
    setPending(true);
    const result = await deleteHackathonLinkAction({ id });
    setPending(false);
    if (result.ok) {
      toast.success("Link deleted");
      setDeleteOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 opacity-0 transition-opacity group-hover/row:opacity-100"
        onClick={() => {
          setEditLabel(label);
          setEditSlug(slug);
          setEditNote(note ?? "");
          setEditOpen(true);
        }}
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-destructive opacity-0 transition-opacity group-hover/row:opacity-100"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit link</DialogTitle>
            <DialogDescription>
              Update label, slug, or note for this share link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-label-${id}`}>Label</Label>
              <Input
                id={`edit-label-${id}`}
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-slug-${id}`}>Slug</Label>
              <Input
                id={`edit-slug-${id}`}
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                maxLength={32}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Changing the slug will break existing links using the old value.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`edit-note-${id}`}>Note (optional)</Label>
              <Input
                id={`edit-note-${id}`}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button
              type="button"
              disabled={pending || !editLabel.trim() || !editSlug.trim()}
              onClick={handleUpdate}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete link</DialogTitle>
            <DialogDescription>
              Delete &ldquo;{label}&rdquo; ({slug})? Past registrations with
              this slug will appear under &ldquo;Unrecognized slugs&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
