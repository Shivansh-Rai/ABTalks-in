"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAssessmentFromPresetsAction } from "@/app/actions/recruiter-assessment-actions";
import { cn } from "@/lib/utils";

export type PresetSummary = {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  questionCount: number;
  durationMinutes: number | null;
};

export function AssessmentPresetPicker({
  presets,
}: {
  presets: PresetSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = useMemo(
    () => presets.map((p) => p.id).filter((id) => selected.has(id)),
    [presets, selected],
  );

  const totalQuestions = useMemo(
    () =>
      presets
        .filter((p) => selected.has(p.id))
        .reduce((sum, p) => sum + p.questionCount, 0),
    [presets, selected],
  );

  function create() {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const res = await createAssessmentFromPresetsAction({
        presetIds: selectedIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        selectedIds.length === 1
          ? "Assessment created"
          : `Assessment created from ${selectedIds.length} templates`,
      );
      router.refresh();
      setSelected(new Set());
    });
  }

  function customize() {
    if (selectedIds.length === 0) return;
    router.push(`/hire/create-test?presets=${selectedIds.join(",")}`);
  }

  return (
    <section className="hire-assess-presets" aria-label="Assessment templates">
      <div className="hire-assess-presets__head">
        <h2>Start from a template</h2>
        <p>
          Select one or more templates to combine into a single assessment, then
          use them as-is or customize before sending.
        </p>
      </div>

      <div className="hire-assess-presets__grid">
        {presets.map((preset) => {
          const isSelected = selected.has(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(preset.id)}
              className={cn(
                "hire-assess-preset-card",
                isSelected && "is-selected",
              )}
            >
              <span className="hire-assess-preset-card__check" aria-hidden="true">
                {isSelected ? "✓" : ""}
              </span>
              <h3>{preset.name}</h3>
              <p className="hire-assess-preset-card__tagline">
                {preset.tagline}
              </p>
              <ul className="hire-assess-preset-card__tags">
                {preset.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <p className="hire-assess-preset-card__meta">
                {preset.questionCount} question
                {preset.questionCount === 1 ? "" : "s"}
                {preset.durationMinutes == null
                  ? " · Untimed"
                  : ` · ${preset.durationMinutes} min`}
              </p>
            </button>
          );
        })}
      </div>

      {selectedIds.length > 0 ? (
        <div className="hire-assess-presets__bar" role="region" aria-live="polite">
          <span className="hire-assess-presets__bar-count">
            {selectedIds.length} template{selectedIds.length === 1 ? "" : "s"} ·{" "}
            {totalQuestions} question{totalQuestions === 1 ? "" : "s"}
          </span>
          <div className="hire-assess-presets__bar-actions">
            <button
              type="button"
              className="hire-assess-linkbtn"
              onClick={customize}
              disabled={pending}
            >
              Customize
            </button>
            <button
              type="button"
              className="hire-assess__savebtn"
              onClick={create}
              disabled={pending}
            >
              {pending ? "Creating…" : "Create assessment"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
