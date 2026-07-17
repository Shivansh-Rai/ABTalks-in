"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  startConceptCheckAction,
  submitConceptCheckAction,
} from "@/app/actions/program-mission-actions";
import { cn } from "@/lib/utils";

type Props = {
  dayNumber: number;
  initialStatus:
    | { status: "none" }
    | { status: "completed"; score: number; pointsAwarded: number };
};

type Question = {
  id: string;
  question: string;
  options: string[];
};

export function ConceptCheckPanel({ dayNumber, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState<"idle" | "quiz" | "result">(
    initialStatus.status === "completed" ? "result" : "idle",
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    pointsAwarded: number;
    review: {
      question: string;
      options: string[];
      selectedIndex: number | null;
      correctIndex: number;
      explanation: string;
      correct: boolean;
    }[];
  } | null>(
    initialStatus.status === "completed"
      ? {
          score: initialStatus.score,
          pointsAwarded: initialStatus.pointsAwarded,
          review: [],
        }
      : null,
  );

  async function handleStart() {
    setLoading(true);
    try {
      const res = await startConceptCheckAction({ dayNumber });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setAttemptId(res.data.attemptId);
      setQuestions(res.data.questions);
      setAnswers(Array(res.data.questions.length).fill(null));
      setCurrent(0);
      setPhase("quiz");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!attemptId) return;
    if (answers.some((a) => a === null)) {
      toast.error("Answer all questions before submitting.");
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

  if (status.status === "completed" && phase === "result" && !result?.review.length) {
    return (
      <div
        id="concept-check"
        className="scroll-mt-24 rounded-[20px] border border-[rgba(46,57,75,0.69)] bg-[rgba(5,12,33,0.89)] p-6 text-sm text-white"
      >
        <p className="font-medium">Concept check complete</p>
        <p className="text-[#BCBCBC]">
          Score: {status.score}/3 · +{status.pointsAwarded} pts
        </p>
      </div>
    );
  }

  return (
    <section
      id="concept-check"
      className="scroll-mt-24 space-y-4 rounded-[20px] border border-[rgba(46,57,75,0.69)] bg-[rgba(5,12,33,0.89)] p-6 md:p-8"
    >
      <div>
        <h2 className="text-xl font-semibold text-[#968BEC] md:text-2xl">
          Concept check
        </h2>
        <p className="text-xs text-[#BCBCBC]">
          3 quick MCQs · one attempt · +1 pt each · does not gate progression
        </p>
      </div>

      {phase === "idle" && (
        <Button
          type="button"
          onClick={() => void handleStart()}
          disabled={loading}
          className="rounded-[15px] border border-black bg-[#7364E6] font-bold text-white shadow-[inset_4px_4px_4px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90"
        >
          {loading ? "Loading…" : "Start concept check"}
        </Button>
      )}

      {phase === "quiz" && questions[current] && (
        <div className="space-y-4">
          <p className="text-xs text-[#BCBCBC]">
            Question {current + 1} of {questions.length}
          </p>
          <p className="font-medium text-white">
            {questions[current]!.question}
          </p>
          <div className="space-y-2">
            {questions[current]!.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = [...answers];
                  next[current] = i;
                  setAnswers(next);
                }}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  answers[current] === i
                    ? "border-[#7364E6] bg-[#7364E6]/20 text-white"
                    : "border-[#8365E3]/40 text-[#BCBCBC] hover:bg-white/5",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="border-[#8365E3]/50 bg-transparent text-white"
            >
              Back
            </Button>
            {current < questions.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrent((c) => c + 1)}
                disabled={answers[current] === null}
                className="rounded-[15px] border border-black bg-[#7364E6] font-bold text-white shadow-[inset_4px_4px_4px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || answers.some((a) => a === null)}
                className="rounded-[15px] border border-black bg-[#7364E6] font-bold text-white shadow-[inset_4px_4px_4px_0_rgba(0,0,0,0.5)] hover:bg-[#7364E6]/90"
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "result" && result && result.review.length > 0 && (
        <div className="space-y-4">
          <p className="font-medium text-white">
            {result.score}/3 correct · +{result.pointsAwarded} pts
          </p>
          {result.review.map((r, i) => (
            <div
              key={i}
              className="rounded-lg border border-[#8365E3]/40 bg-[#110528] p-3 text-sm"
            >
              <p className="font-medium text-white">{r.question}</p>
              <p
                className={cn(
                  "mt-1 text-xs",
                  r.correct ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {r.correct ? "Correct" : "Incorrect"}
              </p>
              <p className="mt-2 text-[#BCBCBC]">{r.explanation}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
