"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./profile-wizard.css";
import type { ProfileReview } from "@/features/profile/build-review";
import { ProfileCard } from "./profile-card";
import { ProfileReviewCard } from "./profile-review";
import { IdentityMedia } from "./identity-media";
import { LeaveDialog } from "./leave-dialog";
import { ProfileWizardProvider, PW_FORM_ID } from "./wizard-context";

export type WizardChecklistKey =
  | "basic"
  | "experience"
  | "education"
  | "projects"
  | "mock"
  | "skills"
  | "certifications"
  | "resume"
  | "links"
  | "preferences";

export type WizardStep = {
  key: string;
  title: string;
  description: string;
  checklist: WizardChecklistKey;
  complete: boolean;
  attention: boolean;
  savable: boolean;
  node: ReactNode;
};

/** How long the sheet takes to slide out, per the transition in the CSS. */
const SHEET_EXIT_MS = 260;

export function ProfileWizard({
  steps,
  initialIndex,
  score,
  fullName,
  imageUrl,
  review,
  avatarUploadEnabled,
}: {
  steps: WizardStep[];
  initialIndex: number;
  score: number;
  fullName: string;
  imageUrl: string | null;
  review: ProfileReview;
  avatarUploadEnabled: boolean;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Where the leave dialog should go once it is answered. */
  const [pendingTarget, setPendingTarget] = useState<number | "close" | null>(
    null,
  );
  const pendingRef = useRef<number | "close" | null>(null);
  const closeAfterSaveRef = useRef(false);
  const exitTimer = useRef<number | undefined>(undefined);

  const loadedAt100 = score === 100;
  const [pillShow, setPillShow] = useState(loadedAt100);
  const [barFinished, setBarFinished] = useState(false);
  const [barRestored] = useState(loadedAt100);
  const [celebrate, setCelebrate] = useState(false);
  const playedRef = useRef(false);
  const prevScoreRef = useRef(score);
  const barRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = steps[index] ?? steps[0]!;

  /* ---- open / close the slide-over ---------------------------------- */

  const openSheet = useCallback((target: number) => {
    window.clearTimeout(exitTimer.current);
    setIndex(target);
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setShown(false);
    setDirty(false);
    exitTimer.current = window.setTimeout(() => setOpen(false), SHEET_EXIT_MS);
  }, []);

  /** Dismissals that are not an explicit Cancel ask before dropping edits. */
  const requestClose = useCallback(() => {
    if (dirty) {
      setPendingTarget("close");
      return;
    }
    closeSheet();
  }, [dirty, closeSheet]);

  // Two frames: mount hidden, then add the class that runs the transform.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  // Lock the page behind the sheet. Reserving the scrollbar's width keeps the
  // workspace from jolting sideways as the sheet slides in.
  useEffect(() => {
    if (!open) return;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const previous = document.body.style.paddingRight;
    document.body.classList.add("pw-sheet-open");
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.classList.remove("pw-sheet-open");
      document.body.style.paddingRight = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open) return;
    pendingRef.current = null;
    headingRef.current?.focus();
  }, [open, index]);

  /* ---- completion celebration --------------------------------------- */

  useEffect(() => {
    if (score !== 100 || prevScoreRef.current >= 100 || playedRef.current) {
      prevScoreRef.current = score;
      return;
    }
    playedRef.current = true;
    setCelebrate(true);
    prevScoreRef.current = score;

    let done = false;
    let pillTimer: number | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      setBarFinished(true);
      pillTimer = window.setTimeout(() => setPillShow(true), 500);
    };

    const bar = barRef.current;
    const onEnd = (event: TransitionEvent) => {
      if (event.propertyName === "width") finish();
    };
    bar?.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, 750);

    return () => {
      bar?.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
      if (pillTimer !== undefined) window.clearTimeout(pillTimer);
    };
  }, [score]);

  /* ---- navigation ---------------------------------------------------- */

  /** A Quick Links tab, or an Add / Edit on the report card. */
  function jump(next: number) {
    if (next !== index && dirty && open) {
      setPendingTarget(next);
      return;
    }
    openSheet(next);
  }

  function onSaved() {
    const target = pendingRef.current;
    pendingRef.current = null;
    setDirty(false);
    if (typeof target === "number") {
      openSheet(target);
      return;
    }
    if (target === "close" || closeAfterSaveRef.current) {
      closeAfterSaveRef.current = false;
      // Saving returns you to the report card, where the change is now visible.
      closeSheet();
    }
  }

  const progressClass = [
    "pw-section-progress",
    barFinished ? "pw-finished" : "",
    barRestored && !barFinished ? "pw-restored" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`pw-root${open ? " pw-sheet-open" : ""}`}>
      <div className="pw-workspace">
        <ProfileCard steps={steps} activeIndex={index} onJump={jump} />

        <ProfileReviewCard
          review={review}
          onOpen={jump}
          media={
            <IdentityMedia
              score={score}
              fullName={fullName}
              imageUrl={imageUrl}
              celebrate={celebrate}
              avatarUploadEnabled={avatarUploadEnabled}
            />
          }
        />
      </div>

      {open ? (
        <ProfileWizardProvider
          value={{
            formId: PW_FORM_ID,
            onSaved,
            setDirty,
            saving,
            setSaving,
          }}
        >
          <button
            type="button"
            className={`pw-form-scrim${shown ? " pw-show" : ""}`}
            aria-label="Close section"
            onClick={requestClose}
          />
          <aside
            className={`pw-form-sheet${shown ? " pw-show" : ""}`}
            aria-label="Edit section"
          >
            <div className="pw-section-header">
              <div
                ref={barRef}
                className={progressClass}
                style={{ width: `${score}%` }}
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completion"
              />
              <div className="pw-section-header-content">
                <h2 ref={headingRef} tabIndex={-1}>
                  {step.title}
                </h2>
                <p>{step.description}</p>
              </div>
              <div className={`pw-complete-pill${pillShow ? " pw-show" : ""}`}>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>{" "}
                Profile Complete
              </div>
              <button
                type="button"
                className="pw-form-close"
                aria-label="Close"
                onClick={requestClose}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="pw-section-body" data-section={step.key}>
              {step.node}
            </div>

            <div className="pw-form-actions">
              <button
                type="button"
                className="pw-btn pw-btn-ghost"
                onClick={closeSheet}
              >
                Cancel
              </button>
              {step.savable ? (
                <button
                  type="submit"
                  form={PW_FORM_ID}
                  disabled={saving}
                  className="pw-btn pw-btn-primary"
                  onClick={() => {
                    pendingRef.current = null;
                    closeAfterSaveRef.current = true;
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              ) : (
                /* Mock Interview and Résumé are earned, not typed — they
                   persist their own changes, so there is nothing to submit. */
                <button
                  type="button"
                  className="pw-btn pw-btn-primary"
                  onClick={closeSheet}
                >
                  Done
                </button>
              )}
            </div>
          </aside>
        </ProfileWizardProvider>
      ) : null}

      <LeaveDialog
        open={pendingTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPendingTarget(null);
        }}
        onCancel={() => setPendingTarget(null)}
        onDiscard={() => {
          const target = pendingTarget;
          setDirty(false);
          setPendingTarget(null);
          if (typeof target === "number") openSheet(target);
          else if (target === "close") closeSheet();
        }}
        onSave={() => {
          pendingRef.current = pendingTarget;
          closeAfterSaveRef.current = false;
          setPendingTarget(null);
          const form = document.getElementById(PW_FORM_ID);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
      />
    </div>
  );
}
