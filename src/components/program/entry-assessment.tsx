"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { submitEntryAssessmentAction } from "@/app/actions/program-entry-actions";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EntrySubmitOk } from "@/features/program/entry";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  section: "APTITUDE" | "TECHNICAL";
  question: string;
  options: string[];
};

type Props = {
  attemptId: string;
  deadlineIso: string;
  questions: Question[];
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EntryAssessment({ attemptId, deadlineIso, questions }: Props) {
  const deadline = new Date(deadlineIso).getTime();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [remaining, setRemaining] = useState(() => deadline - Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EntrySubmitOk | null>(null);
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await submitEntryAssessmentAction({ attemptId, answers });
      if (!res.ok) {
        toast.error(res.message);
        submittedRef.current = false;
        return;
      }
      setResult(res.data);
    } catch {
      toast.error("Something went wrong. Please try again.");
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, answers]);

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        void submit();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, result, submit]);

  if (result) {
    return <ResultView result={result} />;
  }

  const q = questions[current]!;
  const answeredCount = answers.filter((a) => a !== null).length;
  const timeUp = remaining <= 0;

  function choose(optionIndex: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Question {current + 1} of {questions.length}
        </p>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium tabular-nums",
            remaining <= 60_000
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground",
          )}
          aria-live="polite"
        >
          {formatRemaining(remaining)}
        </span>
      </div>

      <Progress value={((current + 1) / questions.length) * 100} />

      <Card className="border-border/60">
        <CardHeader>
          <CardDescription className="uppercase tracking-wide">
            {q.section === "APTITUDE" ? "Aptitude" : "Technical"}
          </CardDescription>
          <CardTitle className="text-lg leading-snug">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.options.map((option, i) => {
            const selected = answers[current] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          Previous
        </Button>

        {current < questions.length - 1 ? (
          <Button
            type="button"
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
          >
            Next
          </Button>
        ) : (
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit assessment"
            )}
          </Button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {answeredCount}/{questions.length} answered
        {timeUp ? " · time is up, submitting…" : ""}
      </p>
    </div>
  );
}

function ResultView({ result }: { result: EntrySubmitOk }) {
  const outcomeCopy = (() => {
    switch (result.outcome) {
      case "ENROLLED":
        return "You passed — you're enrolled in the program!";
      case "WAITLISTED":
        return "You passed! The cohort is currently full, so you're on the waitlist.";
      case "RETAKE":
        return result.retakeAtIso
          ? `You didn't reach the pass mark. You can retake after ${formatDateTimeIST(
              new Date(result.retakeAtIso),
            )} (IST).`
          : "You didn't reach the pass mark. You can retake soon.";
      case "NOT_ELIGIBLE":
        return "You didn't reach the pass mark and have used both attempts for this cohort.";
    }
  })();

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.passed ? (
              <CheckCircle2 className="size-5 text-primary" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            {result.passed ? "Passed" : "Not this time"}
          </CardTitle>
          <CardDescription>{outcomeCopy}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-semibold">{result.totalScore}/20</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-semibold">{result.aptitudeScore}/10</p>
              <p className="text-xs text-muted-foreground">Aptitude</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-semibold">{result.technicalScore}/10</p>
              <p className="text-xs text-muted-foreground">Technical</p>
            </div>
          </div>
          {(result.outcome === "ENROLLED" || result.outcome === "WAITLISTED") && (
            <Link
              href={
                result.outcome === "ENROLLED"
                  ? "/program/dashboard"
                  : "/program/apply"
              }
              className={cn(buttonVariants(), "w-full sm:w-auto")}
            >
              {result.outcome === "ENROLLED" ? "Go to dashboard" : "View status"}
            </Link>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Review
        </h2>
        {result.review.map((row, index) => (
          <Card key={row.questionId} className="border-border/60">
            <CardHeader>
              <CardDescription className="uppercase tracking-wide">
                Q{index + 1} ·{" "}
                {row.section === "APTITUDE" ? "Aptitude" : "Technical"}
              </CardDescription>
              <CardTitle className="text-base leading-snug">
                {row.question}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {row.options.map((option, i) => {
                const isCorrect = i === row.correctIndex;
                const isChosen = i === row.userAnswer;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2",
                      isCorrect && "border-primary/50 bg-primary/10",
                      isChosen &&
                        !isCorrect &&
                        "border-destructive/50 bg-destructive/10",
                    )}
                  >
                    <span className="font-medium">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span>{option}</span>
                    {isCorrect && (
                      <CheckCircle2 className="ml-auto size-4 text-primary" />
                    )}
                    {isChosen && !isCorrect && (
                      <XCircle className="ml-auto size-4 text-destructive" />
                    )}
                  </div>
                );
              })}
              <p className="pt-1 text-muted-foreground">{row.explanation}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
