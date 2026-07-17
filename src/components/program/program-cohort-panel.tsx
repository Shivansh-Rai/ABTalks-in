"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOrUpdateCohortAction,
  publishResultsAction,
  setCohortStatusAction,
} from "@/app/actions/admin-program-actions";
import type { CohortOverview } from "@/features/program/admin";

const STATUSES = [
  "DRAFT",
  "ENROLLING",
  "ACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;

export function ProgramCohortPanel({
  overview,
  rawStartsAt,
  rawEndsAt,
}: {
  overview: CohortOverview["cohort"] | null;
  rawStartsAt: string | null;
  rawEndsAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [form, setForm] = useState({
    name: overview?.name ?? "",
    startsAt: rawStartsAt ?? "",
    endsAt: rawEndsAt ?? "",
    capacity: overview?.capacity ?? 100,
  });

  async function handleSave() {
    setBusy(true);
    try {
      const res = await createOrUpdateCohortAction({
        cohortId: overview?.id,
        ...form,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Cohort saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(status: string) {
    if (!overview) return;
    setBusy(true);
    try {
      const res = await setCohortStatusAction({ cohortId: overview.id, status });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Status set to ${status}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!overview) return;
    setBusy(true);
    try {
      const res = await publishResultsAction({ cohortId: overview.id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Results published — recruiters can browse the pool.");
      setPublishOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border p-4">
      {overview ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Enrolled" value={String(overview.enrolled)} />
          <Stat label="Waitlisted" value={String(overview.waitlisted)} />
          <Stat label="Dropped" value={String(overview.dropped)} />
          <Stat label="Capacity" value={String(overview.capacity)} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cohort-name">Name</Label>
          <Input
            id="cohort-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cohort-capacity">Capacity</Label>
          <Input
            id="cohort-capacity"
            type="number"
            min={1}
            max={100}
            value={form.capacity}
            onChange={(e) =>
              setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cohort-start">Starts (IST)</Label>
          <Input
            id="cohort-start"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, startsAt: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cohort-end">Ends (IST)</Label>
          <Input
            id="cohort-end"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, endsAt: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={busy}>
          {overview ? "Update cohort" : "Create cohort"}
        </Button>
        {overview && (
          <>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={overview.status}
              onChange={(e) => void handleStatus(e.target.value)}
              disabled={busy}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {!overview.resultsPublishedAt && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPublishOpen(true)}
                disabled={busy}
              >
                Publish results
              </Button>
            )}
          </>
        )}
      </div>

      {overview?.resultsPublishedAt && (
        <p className="text-sm text-muted-foreground">
          Results published {overview.resultsPublishedAt}
        </p>
      )}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish cohort results?</DialogTitle>
            <DialogDescription>
              This is one-way in the UI. Approved recruiters will immediately
              see the talent pool for this cohort.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handlePublish()}
              disabled={busy}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}
