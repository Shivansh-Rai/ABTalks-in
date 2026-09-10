"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { submitQuizAction } from "@/app/actions/quiz-actions";
import { ANALYTICS_EVENTS, scoreBucket } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";
import type { QuizWithQuestionsPayload } from "@/features/quiz/get-quiz-with-questions";
import type { QuizSubmitResultRow } from "@/features/quiz/submit-quiz";
import { cn } from "@/lib/utils";
import { QuizResultsDisplay } from "./quiz-results-display";

type Props = {
  quiz: QuizWithQuestionsPayload["quiz"];
  questions: QuizWithQuestionsPayload["questions"];
};

type QuestionWithSolution = QuizWithQuestionsPayload["questions"][number] & {
  correctAnswer: string;
  explanation: string;
};

export function QuizForm({ quiz, questions }: Props) {
  const track = useTrack();
  const [answers, setAnswers] = useState<
    Record<string, "A" | "B" | "C" | "D">
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    score: number;
    results: QuizSubmitResultRow[];
  } | null>(null);

  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const allAnswered = answeredCount === total && total > 0;

  const mergedQuestions: QuestionWithSolution[] = useMemo(() => {
    if (!done) return [];
    const byId = new Map(done.results.map((r) => [r.questionId, r]));
    return questions.map((q) => {
      const r = byId.get(q.id)!;
      return {
        ...q,
        correctAnswer: r.correctAnswer,
        explanation: r.explanation,
      };
    });
  }, [done, questions]);

  async function onSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    try {
      const res = await submitQuizAction({ quizId: quiz.id, answers });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      // The server graded it, so the submission is real. Only the band goes to
      // GA4 — never the score, never the question ids, never an answer
      // (plan 114 §4.11: "Individual assessment question answers" are excluded).
      track(ANALYTICS_EVENTS.siteTestCompleted, {
        score_bucket: scoreBucket(res.score, total),
      });
      setDone({ score: res.score, results: res.results });
      toast.success("Quiz submitted");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const userAnswers: Record<string, string> = {};
    for (const r of done.results) {
      userAnswers[r.questionId] = r.userAnswer;
    }
    return (
      <QuizResultsDisplay
        quiz={quiz}
        questions={mergedQuestions}
        userAnswers={userAnswers}
        score={done.score}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Week {quiz.weekNumber} quiz: {quiz.domain}
        </CardTitle>
        <CardDescription>{quiz.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {questions.map((q, idx) => (
          <fieldset
            key={q.id}
            className="space-y-3 rounded-lg border p-4"
            role="radiogroup"
            aria-labelledby={`q-${q.id}-legend`}
          >
            <div id={`q-${q.id}-legend`} className="text-sm font-medium text-muted-foreground">
              Question {idx + 1}
            </div>
            <p className="text-base font-medium">{q.questionText}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["A", q.optionA],
                  ["B", q.optionB],
                  ["C", q.optionC],
                  ["D", q.optionD],
                ] as const
              ).map(([letter, text]) => {
                const id = `${q.id}-${letter}`;
                const selected = answers[q.id] === letter;
                return (
                  <div key={letter}>
                    <input
                      type="radio"
                      id={id}
                      name={q.id}
                      value={letter}
                      checked={selected}
                      className="peer sr-only"
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: letter,
                        }))
                      }
                    />
                    <Label
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="font-mono font-semibold">{letter}.</span>
                      <span className="ml-2">{text}</span>
                    </Label>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {allAnswered
              ? "All questions answered. You can submit."
              : `Please answer all ${total} questions (${answeredCount}/${total} answered).`}
          </p>
          <Button
            type="button"
            disabled={!allAnswered || submitting}
            onClick={() => void onSubmit()}
          >
            {submitting ? "Submitting…" : "Submit quiz"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
