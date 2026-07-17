"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import {
  startConceptCheckAction,
  submitConceptCheckAction,
} from "@/app/actions/program-mission-actions";
import { cn } from "@/lib/utils";

type ConceptStatus =
  | { status: "none" }
  | { status: "completed"; score: number; pointsAwarded: number };

type Question = {
  id: string;
  question: string;
  options: string[];
};

type ReviewItem = {
  question: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  explanation: string;
  correct: boolean;
};

const figmaSubmitBtn =
  "inline-flex h-9 items-center justify-center rounded-[10px] border border-black bg-[#7364E6] px-4 text-sm font-bold text-white shadow-[inset_3px_3px_3px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90 disabled:cursor-not-allowed disabled:opacity-50";

export function ConceptCheckDialog({
  dayNumber,
  memberFullName,
  initialStatus,
  open,
  onOpenChange,
}: {
  dayNumber: number;
  memberFullName: string;
  initialStatus: ConceptStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState<"loading" | "quiz" | "result">(
    initialStatus.status === "completed" ? "result" : "loading",
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [honorAgreed, setHonorAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    pointsAwarded: number;
    review: ReviewItem[];
  } | null>(
    initialStatus.status === "completed"
      ? {
          score: initialStatus.score,
          pointsAwarded: initialStatus.pointsAwarded,
          review: [],
        }
      : null,
  );

  useEffect(() => {
    if (!open) return;
    if (status.status === "completed") {
      setPhase("result");
      return;
    }
    if (questions.length > 0) {
      setPhase("quiz");
      return;
    }

    let cancelled = false;
    async function load() {
      setPhase("loading");
      setLoading(true);
      try {
        const res = await startConceptCheckAction({ dayNumber });
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.message);
          onOpenChange(false);
          return;
        }
        setAttemptId(res.data.attemptId);
        setQuestions(res.data.questions);
        setAnswers(Array(res.data.questions.length).fill(null));
        setPhase("quiz");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, dayNumber, status.status, questions.length, onOpenChange]);

  async function handleSubmit() {
    if (!attemptId) return;
    if (answers.some((a) => a === null)) {
      toast.error("Answer all questions before submitting.");
      return;
    }
    if (!honorAgreed) {
      toast.error("You must agree to the honor code before submitting.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitConceptCheckAction({
        attemptId,
        answers: answers as number[],
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setResult(res.data);
      setStatus({
        status: "completed",
        score: res.data.score,
        pointsAwarded: res.data.pointsAwarded,
      });
      setPhase("result");
      toast.success(`+${res.data.pointsAwarded} concept points`);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80 backdrop-blur-none" />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(calc(100%-1.5rem),720px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[12px] border-2 border-[#1E1E1E] text-white outline-none",
            "bg-[radial-gradient(circle_at_50%_50%,rgba(9,22,55,1)_20%,rgba(3,7,18,1)_100%)]",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 right-4 z-10 text-2xl leading-none text-white/80 transition-colors hover:text-white"
            aria-label="Close concept check"
          >
            ×
          </button>

          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <h2 className="text-xl font-extrabold text-white">Concept check</h2>
            <p className="mt-1 text-sm text-[#D2D2D2]">
              3 quick MCQs · one attempt · +1 pt each · No negative marking
            </p>

            {phase === "loading" && (
              <p className="mt-6 text-sm text-[#BCBCBC]">Loading questions…</p>
            )}

            {phase === "quiz" && questions.length > 0 && (
              <div className="mt-5 space-y-5">
                {questions.map((q, qi) => (
                  <div key={q.id} className="relative border-b border-[#8365E3]/15 pb-4 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-white">
                        {qi + 1}. {q.question}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#D9D9D9]/50 px-2 py-0.5 text-[9px] font-semibold text-white">
                        1 pt
                      </span>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className="flex cursor-pointer items-start gap-2"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-[#040C20]",
                              answers[qi] === oi
                                ? "border-white"
                                : "border-white/70",
                            )}
                          >
                            {answers[qi] === oi && (
                              <span className="size-2 rounded-full bg-white" />
                            )}
                          </span>
                          <input
                            type="radio"
                            name={`concept-q-${qi}`}
                            className="sr-only"
                            checked={answers[qi] === oi}
                            onChange={() => {
                              const next = [...answers];
                              next[qi] = oi;
                              setAnswers(next);
                            }}
                          />
                          <span className="text-sm leading-snug text-white/90">
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="space-y-2.5 border-t border-[#8365E3]/20 pt-4">
                  <p className="text-xs leading-relaxed text-white/90">
                    By clicking Submit, you confirm this work is your own.
                    Submitting work created with AI tools may result in course
                    failure or account deactivation according to{" "}
                    <Link
                      href="/program"
                      className="text-[#7364E6] underline underline-offset-2"
                    >
                      ABTalks Honor Code policy
                    </Link>
                    .
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={honorAgreed}
                      onChange={(e) => setHonorAgreed(e.target.checked)}
                      className="mt-0.5 size-3.5 shrink-0 accent-[#7364E6]"
                    />
                    <span>I, {memberFullName}, understand and agree.</span>
                  </label>
                  {!honorAgreed && (
                    <p className="text-xs text-[#A5A5A5]">
                      You must select the checkbox in order to submit.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={
                      loading ||
                      !honorAgreed ||
                      answers.some((a) => a === null)
                    }
                    className={figmaSubmitBtn}
                  >
                    {loading ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>
            )}

            {phase === "result" && result && (
              <div className="mt-5 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                <p className="text-base font-semibold text-white">
                  {result.score}/3 correct · +{result.pointsAwarded} pts
                </p>

                {result.review.length > 0 ? (
                  result.review.map((r, i) => (
                    <div key={i} className="space-y-2 border-b border-[#8365E3]/15 pb-3 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          {i + 1}. {r.question}
                        </p>
                        <span className="shrink-0 rounded-full bg-[#D9D9D9]/50 px-2 py-0.5 text-[9px] font-semibold text-white">
                          1 pt
                        </span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {r.options.map((opt, oi) => {
                          const isSelected = r.selectedIndex === oi;
                          const isCorrect = r.correctIndex === oi;
                          return (
                            <div
                              key={oi}
                              className={cn(
                                "flex items-start gap-2 text-sm leading-snug",
                                isSelected && isCorrect
                                  ? "text-[#00FF1E]"
                                  : isSelected
                                    ? "text-[#FF0004]"
                                    : "text-white/70",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 bg-[#040C20]",
                                  isSelected
                                    ? isCorrect
                                      ? "border-[#00FF1E]"
                                      : "border-[#FF0004]"
                                    : "border-white/40",
                                )}
                              >
                                {isSelected && (
                                  <span
                                    className={cn(
                                      "size-2 rounded-full",
                                      isCorrect
                                        ? "bg-[#00FF1E]"
                                        : "bg-[#FF0004]",
                                    )}
                                  />
                                )}
                              </span>
                              <span>{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div
                        className={cn(
                          "rounded-[8px] border px-3 py-2",
                          r.correct
                            ? "border-[#6AE276] bg-[rgba(14,96,40,0.69)]"
                            : "border-[#C9282B] bg-[rgba(121,58,59,0.69)]",
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            r.correct ? "text-[#00FF1E]" : "text-[#FF0004]",
                          )}
                        >
                          {r.correct ? "Correct!" : "Incorrect..."}
                        </p>
                        {!r.correct && (
                          <p className="mt-1 text-xs text-[#BCBCBC]">
                            {r.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#BCBCBC]">
                    Concept check complete for this day.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
