"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createHackathonLinkAction } from "@/app/actions/admin-hackathon-link-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HackathonLinkAdd() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function reset() {
    setSlug("");
    setLabel("");
    setNote("");
  }

  async function handleCreate() {
    setPending(true);
    const result = await createHackathonLinkAction({
      slug,
      label,
      note: note || undefined,
    });
    setPending(false);
    if (result.ok) {
      toast.success("Link created");
      reset();
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="gap-1.5">
            <Plus className="size-4" />
            Add link
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add share link</DialogTitle>
          <DialogDescription>
            Create a new hackathon share link for attribution tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-label">Label</Label>
            <Input
              id="new-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. VJIT — placement officer"
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-slug">Slug</Label>
            <Input
              id="new-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. vjit-po"
              maxLength={32}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens, and underscores only.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-note">Note (optional)</Label>
            <Input
              id="new-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note"
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button
            type="button"
            disabled={pending || !label.trim() || !slug.trim()}
            onClick={handleCreate}
          >
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
