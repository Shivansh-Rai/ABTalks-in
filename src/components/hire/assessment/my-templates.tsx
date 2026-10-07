"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteRecruiterAssessmentTemplateAction,
  renameRecruiterAssessmentTemplateAction,
} from "@/app/actions/recruiter-assessment-template-actions";
import { MAX_TEMPLATES_PER_RECRUITER } from "@/lib/validations/assessment";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** A recruiter's own template as its card shows it. No question bodies. */
export type MyTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  questionCount: number;
  durationMinutes: number | null;
};

/**
 * Plan 185 — "My templates" on /hire/create-test: the recruiter's own saved
 * templates, above the ABTalks ones and visibly separate from them.
 *
 * The list is loaded on the server for the signed-in recruiter only. Rename
 * and Delete go through actions that resolve the recruiter again on the
 * server, so an id on this page is never proof of ownership.
 *
 * A template is used one way: Customize opens the builder with its questions,
 * editable. Creating one happens in the builder ("Save as template").
 */
export function MyAssessmentTemplates({
  templates,
  projectId = null,
}: {
  templates: MyTemplateSummary[];
  /** Carried into Customize so the builder keeps the same Shortlist. */
  projectId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<MyTemplateSummary | null>(null);
  const [deleting, setDeleting] = useState<MyTemplateSummary | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function customizeHref(id: string): string {
    const params = new URLSearchParams({ template: id });
    if (projectId) params.set("projectId", projectId);
    return `/hire/create-test?${params.toString()}`;
  }

  function openRename(template: MyTemplateSummary) {
    setName(template.name);
    setDescription(template.description ?? "");
    setRenaming(template);
  }

  function rename() {
    if (!renaming) return;
    startTransition(async () => {
      const res = await renameRecruiterAssessmentTemplateAction({
        templateId: renaming.id,
        name: name.trim(),
        description: description.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRenaming(null);
      toast.success("Template renamed");
      router.refresh();
    });
  }

  function remove() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteRecruiterAssessmentTemplateAction({
        templateId: deleting.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setDeleting(null);
      toast.success("Template deleted");
      router.refresh();
    });
  }

  return (
    <section className="hire-assess-presets" aria-label="My templates">
      <div className="hire-assess-presets__head">
        <div>
          <h2>My templates</h2>
          <p>
            Templates you saved. Only you can see them. Open one to customize
            it, then save a draft or publish.
          </p>
        </div>
        {templates.length > 0 ? (
          <span className="hire-assess-hint">
            {templates.length} of {MAX_TEMPLATES_PER_RECRUITER}
          </span>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <p className="hire-assess-templates__empty">
          You have no templates yet. Build an assessment below, then choose
          Save as template to reuse it.
        </p>
      ) : (
        <div className="hire-assess-presets__grid">
          {templates.map((template) => (
            <article
              key={template.id}
              className="hire-assess-preset-card hire-assess-preset-card--own"
            >
              <h3>{template.name}</h3>
              {template.description ? (
                <p className="hire-assess-preset-card__tagline">
                  {template.description}
                </p>
              ) : null}
              <p className="hire-assess-preset-card__meta">
                {template.questionCount} question
                {template.questionCount === 1 ? "" : "s"}
                {template.durationMinutes == null
                  ? " · Untimed"
                  : ` · ${template.durationMinutes} min`}
              </p>
              <div className="hire-assess-preset-card__actions">
                <Link
                  href={customizeHref(template.id)}
                  className="hire-assess-linkbtn"
                  aria-label={`Customize ${template.name}`}
                >
                  Customize
                </Link>
                <button
                  type="button"
                  className="hire-assess-linkbtn"
                  disabled={pending}
                  onClick={() => openRename(template)}
                  aria-label={`Rename ${template.name}`}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="hire-assess-linkbtn hire-assess-linkbtn--danger"
                  disabled={pending}
                  onClick={() => setDeleting(template)}
                  aria-label={`Delete ${template.name}`}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !pending && !open && setRenaming(null)}
      >
        <DialogContent className="hire-app sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename template</DialogTitle>
            <DialogDescription>
              Changes the name and description only. To change its questions,
              customize it and choose Update template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="my-template-name">Template name</Label>
              <Input
                id="my-template-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="my-template-description">
                Description (optional)
              </Label>
              <Textarea
                id="my-template-description"
                rows={2}
                value={description}
                maxLength={300}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              disabled={pending}
              onClick={() => setRenaming(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }))}
              disabled={pending || name.trim() === ""}
              onClick={rename}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !pending && !open && setDeleting(null)}
      >
        <DialogContent className="hire-app sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              &ldquo;{deleting?.name}&rdquo; will be removed from My templates.
              Assessments you already created from it are not affected. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "destructive" }))}
              disabled={pending}
              onClick={remove}
            >
              {pending ? "Deleting…" : "Delete template"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
