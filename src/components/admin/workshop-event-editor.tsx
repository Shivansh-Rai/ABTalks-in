"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ICON_KEYS } from "@/components/workshop/workshop-icons";
import {
  createWorkshopEventAction,
  deleteWorkshopEventAction,
  updateWorkshopEventAction,
  uploadWorkshopPosterAction,
} from "@/app/actions/workshop-event-actions";

/** The editable shape, matching the Zod schema on the action side. */
export type EditableWorkshopEvent = {
  id: string;
  date: string;
  time: string;
  tag: string;
  accent: string;
  icon: string;
  title: string;
  desc: string;
  host: string;
  location: string;
  registrationOpen: boolean;
  durationMinutes: number | null;
  posterSrc: string | null;
  youtubeId: string | null;
  duration: string | null;
  titleAccents: string[];
  topics: string[];
  takeaways: string[];
  resources: { label: string; href: string; kind: "youtube" | "link" }[];
};

/** A brand-new event on the clicked day, pre-filled with house defaults. */
export function blankEvent(date: string): EditableWorkshopEvent {
  return {
    // Dated slug, the convention the existing ids follow. Editable on create
    // only — it becomes permanent the moment the event is saved.
    id: `workshop-${date}`,
    date,
    time: "7:00 PM IST",
    tag: "Workshop",
    accent: "#e05226",
    icon: "calendar",
    title: "",
    desc: "",
    host: "ABTalks",
    location: "Live · YouTube",
    registrationOpen: true,
    durationMinutes: null,
    posterSrc: null,
    youtubeId: null,
    duration: null,
    titleAccents: [],
    topics: [],
    takeaways: [],
    resources: [],
  };
}

const toLines = (v: string[]) => v.join("\n");
const nullIfBlank = (v: string) => (v.trim().length > 0 ? v.trim() : null);

export function WorkshopEventEditor({
  event,
  isNew,
  open,
  onOpenChange,
  onSaved,
}: {
  event: EditableWorkshopEvent;
  isNew: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(event);
  const [titleAccents, setTitleAccents] = useState(toLines(event.titleAccents));
  const [topics, setTopics] = useState(toLines(event.topics));
  const [takeaways, setTakeaways] = useState(toLines(event.takeaways));
  const [resourcesText, setResourcesText] = useState(
    event.resources.map((r) => `${r.kind}|${r.label}|${r.href}`).join("\n"),
  );
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof EditableWorkshopEvent>(
    key: K,
    value: EditableWorkshopEvent[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  /** `kind|label|href` per line — one textarea beats a nested repeater here. */
  function parseResources() {
    return resourcesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [kind, label, href] = l.split("|").map((p) => p?.trim() ?? "");
        return {
          kind: kind === "youtube" ? ("youtube" as const) : ("link" as const),
          label,
          href,
        };
      })
      .filter((r) => r.label.length > 0 && r.href.length > 0);
  }

  function save() {
    const payload = {
      ...form,
      titleAccents,
      topics,
      takeaways,
      resources: parseResources(),
    };
    startTransition(async () => {
      const res = isNew
        ? await createWorkshopEventAction(payload)
        : await updateWorkshopEventAction(payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(isNew ? "Workshop created" : "Workshop saved");
      onOpenChange(false);
      onSaved();
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete "${form.title || form.id}"?\n\nRegistrations are NOT deleted — they stay attached to this id, and recreating the event with the same id restores it.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteWorkshopEventAction({ id: form.id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Workshop deleted");
      onOpenChange(false);
      onSaved();
    });
  }

  async function onPosterFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadWorkshopPosterAction(fd);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    set("posterSrc", res.data.url);
    toast.success("Poster uploaded");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New workshop" : "Edit workshop"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "This becomes the live workshop once its date is the soonest one still open."
              : "Saving updates the hero, countdown, calendar and registration together."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Date (YYYY-MM-DD)">
              <Input
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Time" hint="Free text. Must contain a clock (e.g. 7:00 PM IST) or the countdown cannot start.">
              <Input
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Event id"
            hint={
              isNew
                ? "Permanent once saved — registrations are filed under it."
                : "Permanent. Registrations are filed under this id and it cannot be changed."
            }
          >
            <Input
              value={form.id}
              disabled={!isNew}
              onChange={(e) => set("id", e.target.value)}
            />
          </Field>

          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>

          <Field label="Description">
            <Textarea
              rows={3}
              value={form.desc}
              onChange={(e) => set("desc", e.target.value)}
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Host">
              <Input
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
              />
            </Field>
            <Field label="Location">
              <Input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Tag">
              <Input
                value={form.tag}
                onChange={(e) => set("tag", e.target.value)}
              />
            </Field>
            <Field label="Accent (hex)">
              <Input
                value={form.accent}
                onChange={(e) => set("accent", e.target.value)}
              />
            </Field>
            <Field label="Icon">
              <select
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={form.icon}
                onChange={(e) => set("icon", e.target.value)}
              >
                {ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Poster"
            hint="Upload an image, or paste a path like /workshop/posters/name.jpg."
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={form.posterSrc ?? ""}
                placeholder="/workshop/posters/…"
                onChange={(e) => set("posterSrc", nullIfBlank(e.target.value))}
              />
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="size-4" aria-hidden />
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPosterFile(f);
                  }}
                />
              </label>
            </div>
          </Field>

          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Duration (minutes)" hint="Blank = 90.">
              <Input
                type="number"
                value={form.durationMinutes ?? ""}
                onChange={(e) =>
                  set(
                    "durationMinutes",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
            <Field label="YouTube id" hint="Replay video id.">
              <Input
                value={form.youtubeId ?? ""}
                onChange={(e) => set("youtubeId", nullIfBlank(e.target.value))}
              />
            </Field>
            <Field label="Runtime" hint="e.g. 01:02:18">
              <Input
                value={form.duration ?? ""}
                onChange={(e) => set("duration", nullIfBlank(e.target.value))}
              />
            </Field>
          </div>

          <Field
            label="Title accents"
            hint="One per line. Each must appear verbatim in the title; those words render in the accent colour."
          >
            <Textarea
              rows={2}
              value={titleAccents}
              onChange={(e) => setTitleAccents(e.target.value)}
            />
          </Field>

          <Field label="Topics — What You'll Learn" hint="One per line.">
            <Textarea
              rows={4}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
            />
          </Field>

          <Field label="Key takeaways" hint="One per line. Shown in the replay modal.">
            <Textarea
              rows={4}
              value={takeaways}
              onChange={(e) => setTakeaways(e.target.value)}
            />
          </Field>

          <Field
            label="Resources"
            hint="One per line: kind|label|url — kind is link or youtube."
          >
            <Textarea
              rows={3}
              placeholder="link|Join the WhatsApp community|https://…"
              value={resourcesText}
              onChange={(e) => setResourcesText(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 rounded-md border p-3">
            <Switch
              checked={form.registrationOpen}
              onCheckedChange={(v) => set("registrationOpen", v)}
              id="registrationOpen"
            />
            <Label htmlFor="registrationOpen" className="cursor-pointer">
              Registration open
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Signups go to the SOONEST open workshop that has not finished.
                Turning this off closes this one without deleting it.
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {!isNew ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Saving…" : isNew ? "Create" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
