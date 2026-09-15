"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAndSendFromPresetsAction } from "@/app/actions/recruiter-assessment-actions";
import { MAX_ASSIGN_PER_CALL } from "@/lib/validations/assessment";
import { cn } from "@/lib/utils";

export type PresetSummary = {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  questionCount: number;
  durationMinutes: number | null;
};

type SendableCandidate = { candidateRef: string; label: string; jobRole: string };

export function AssessmentPresetPicker({
  presets,
  candidates,
}: {
  presets: PresetSummary[];
  candidates: SendableCandidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickedRefs, setPickedRefs] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCandidate(ref: string) {
    setPickedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
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

  const shortlistRefs = useMemo(
    () => candidates.map((c) => c.candidateRef),
    [candidates],
  );
  const picked = candidates.filter((c) => pickedRefs.has(c.candidateRef));
  const pickedCount = picked.length;
  const allPicked = candidates.length > 0 && pickedCount === candidates.length;
  const createBlockedReason =
    candidates.length === 0
      ? "Your Shortlist is empty — shortlist candidates on Hire to send this. You can still customize."
      : pickedCount === 0
        ? "Select at least one shortlisted candidate to send this to."
        : pickedCount > MAX_ASSIGN_PER_CALL
          ? `Send to at most ${MAX_ASSIGN_PER_CALL} candidates at a time.`
          : null;

  function customize() {
    if (selectedIds.length === 0) return;
    router.push(`/hire/create-test?presets=${selectedIds.join(",")}`);
  }

  function askPublish() {
    if (selectedIds.length === 0) return;
    if (createBlockedReason) {
      toast.error(createBlockedReason);
      return;
    }
    setConfirming(true);
  }

  function publish() {
    if (selectedIds.length === 0 || createBlockedReason) {
      setConfirming(false);
      if (createBlockedReason) toast.error(createBlockedReason);
      return;
    }
    const candidateRefs = picked.map((c) => c.candidateRef);
    startTransition(async () => {
      const res = await createAndSendFromPresetsAction({
        presetIds: selectedIds,
        candidateRefs,
      });
      if (!res.ok) {
        setConfirming(false);
        toast.error(res.message);
        return;
      }
      const { id, assigned, alreadyAssigned, notificationFailures, assignError } =
        res.data;
      if (assignError) {
        toast.warning(
          `Published, but not sent yet: ${assignError} Assign candidates from this page.`,
        );
      } else {
        const sent = assigned + alreadyAssigned;
        toast.success(
          `Published and sent to ${sent} candidate${sent === 1 ? "" : "s"}.`,
        );
        if (notificationFailures > 0) {
          toast.warning(
            `${notificationFailures} notification${notificationFailures === 1 ? "" : "s"} could not be sent. Assign again to retry — nobody is notified twice.`,
          );
        }
      }
      router.push(`/hire/assessments/${id}`);
    });
  }

  return (
    <section className="hire-assess-presets" aria-label="Assessment templates">
      <div className="hire-assess-presets__head">
        <div>
          <h2>Start from a template</h2>
          <p>
            Select one or more templates to combine into a single assessment,
            then publish to shortlisted candidates or customize before sending.
          </p>
        </div>
        <a href="#blank-assessment" className="hire-assess-linkbtn">
          Start from blank ↓
        </a>
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

          <section
            className="hire-assess-presets__send"
            aria-labelledby="preset-send-heading"
          >
            <div className="hire-assess__send-head">
              <h3 id="preset-send-heading">Send to shortlisted candidates</h3>
              {candidates.length > 0 && (
                <button
                  type="button"
                  className="hire-assess-linkbtn"
                  disabled={pending}
                  onClick={() =>
                    setPickedRefs(
                      allPicked ? new Set() : new Set(shortlistRefs),
                    )
                  }
                >
                  {allPicked ? "Clear selection" : "Select all"}
                </button>
              )}
            </div>
            {candidates.length === 0 ? (
              <p className="hire-assess__send-empty">
                Your Shortlist is empty. Shortlist candidates on Hire first —
                you can still customize this template.
              </p>
            ) : (
              <fieldset
                className="hire-assess-assign__fieldset"
                aria-busy={pending}
              >
                <legend className="sr-only">Shortlisted candidates</legend>
                <ul className="hire-assess-assign__list">
                  {candidates.map((c) => (
                    <li key={c.candidateRef}>
                      <label className="hire-assess-assign__row">
                        <input
                          type="checkbox"
                          checked={pickedRefs.has(c.candidateRef)}
                          disabled={pending}
                          onChange={() => toggleCandidate(c.candidateRef)}
                        />
                        <span className="hire-assess-assign__who">
                          <span>{c.label}</span>
                          <span className="hire-assess-detail__role">
                            {c.jobRole}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </section>

          {confirming ? (
            <div
              className="hire-assess-assign__confirm hire-assess__confirm"
              role="group"
              aria-label="Confirm publish"
            >
              <p>
                Publish and send to {pickedCount} candidate
                {pickedCount === 1 ? "" : "s"}? Publishing locks the questions
                and the pass mark, and each candidate is notified.
              </p>
              <div className="hire-assess-assign__confirm-actions">
                <button
                  type="button"
                  className="hire-assess__savebtn hire-assess__savebtn--ghost"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="hire-assess__savebtn"
                  disabled={pending}
                  onClick={publish}
                >
                  {pending ? "Sending…" : "Publish and send"}
                </button>
              </div>
            </div>
          ) : (
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
                onClick={askPublish}
                disabled={pending || Boolean(createBlockedReason)}
                aria-describedby="preset-create-hint"
              >
                Publish and send
              </button>
              <p
                id="preset-create-hint"
                className="hire-assess-hint hire-assess__save-hint"
              >
                {createBlockedReason ??
                  `Sends to ${pickedCount} selected candidate${pickedCount === 1 ? "" : "s"}.`}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
