"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateShortlistNoteAction } from "@/app/actions/talent-actions";

export function ShortlistNoteForm({
  memberId,
  initialNote,
  shortlisted,
}: {
  memberId: string;
  initialNote: string | null;
  shortlisted: boolean;
}) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);

  if (!shortlisted) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateShortlistNoteAction({ memberId, note });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Note saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <Label htmlFor="shortlist-note">Your shortlist note</Label>
      <textarea
        id="shortlist-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="min-h-24 w-full rounded-lg border bg-muted/30 p-3 text-sm"
        placeholder="Private notes for your team…"
      />
      <Button
        type="button"
        size="sm"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? "Saving…" : "Save note"}
      </Button>
    </div>
  );
}
