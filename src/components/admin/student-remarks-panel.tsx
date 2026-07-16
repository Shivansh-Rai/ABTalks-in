"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAdminRemarkAction,
  deleteAdminRemarkAction,
  updateAdminRemarkAction,
} from "@/app/actions/admin-remark-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Remark = {
  id: string;
  body: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  adminName: string;
};

type Props = {
  studentId: string;
  studentName: string;
  remarks: Remark[];
};

function formatRemarkDate(value: Date | string): string {
  return formatInTimeZone(new Date(value), "Asia/Kolkata", "dd/MM/yyyy");
}

function wasEdited(createdAt: Date | string, updatedAt: Date | string): boolean {
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 1000;
}

export function StudentRemarksPanel({
  studentId,
  studentName,
  remarks,
}: Props) {
  const router = useRouter();
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);

  async function handleAdd() {
    const body = newBody.trim();
    if (!body) {
      toast.error("Remark cannot be empty");
      return;
    }
    setAdding(true);
    const result = await createAdminRemarkAction({ studentUserId: studentId, body });
    setAdding(false);
    if (result.ok) {
      toast.success("Remark added");
      setNewBody("");
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  async function handleSaveEdit(remarkId: string) {
    const body = editBody.trim();
    if (!body) {
      toast.error("Remark cannot be empty");
      return;
    }
    setSavingEdit(true);
    const result = await updateAdminRemarkAction({ remarkId, body });
    setSavingEdit(false);
    if (result.ok) {
      toast.success("Remark updated");
      setEditingId(null);
      setEditBody("");
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  async function handleDelete(remarkId: string) {
    setDeletingId(remarkId);
    const result = await deleteAdminRemarkAction({ remarkId });
    setDeletingId(null);
    if (result.ok) {
      toast.success("Remark deleted");
      setDeleteOpenId(null);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">
          Add a private admin remark for {studentName}
        </p>
        <Textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Write a remark…"
          rows={3}
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={adding || !newBody.trim()}
            onClick={handleAdd}
          >
            {adding ? "Adding…" : "Add remark"}
          </Button>
        </div>
      </div>

      {remarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No remarks yet</p>
      ) : (
        <div className="max-h-[28rem] space-y-2 overflow-y-auto">
          {remarks.map((remark) => {
            const isEditing = editingId === remark.id;
            return (
              <Card key={remark.id}>
                <CardContent className="space-y-2 pt-4 text-sm">
                  {isEditing ? (
                    <>
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={3}
                        maxLength={2000}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingEdit || !editBody.trim()}
                          onClick={() => handleSaveEdit(remark.id)}
                        >
                          {savingEdit ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={savingEdit}
                          onClick={() => {
                            setEditingId(null);
                            setEditBody("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{remark.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {remark.adminName} · {formatRemarkDate(remark.createdAt)}
                        {wasEdited(remark.createdAt, remark.updatedAt)
                          ? " (edited)"
                          : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(remark.id);
                            setEditBody(remark.body);
                          }}
                        >
                          Edit
                        </Button>
                        <Dialog
                          open={deleteOpenId === remark.id}
                          onOpenChange={(open) =>
                            setDeleteOpenId(open ? remark.id : null)
                          }
                        >
                          <DialogTrigger
                            render={
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                              >
                                Delete
                              </Button>
                            }
                          />
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete remark</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete this remark? This
                                cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter showCloseButton>
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={deletingId === remark.id}
                                onClick={() => handleDelete(remark.id)}
                              >
                                {deletingId === remark.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
