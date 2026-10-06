"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/features/courses/types";
import { Inline } from "./inline";
import { useCourseProgress } from "./use-course-progress";

/** Scenario quiz: one attempt per question, explanation revealed on answer. */
export function Quiz({ course, module, questions }: { course: string; module: string; questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const { recordQuiz } = useCourseProgress(course);
  const answered = answers.filter((a) => a !== null).length;
  const score = answers.filter((a, i) => a === questions[i].answer).length;

  function pick(qi: number, oi: number) {
    setAnswers((prev) => {
      if (prev[qi] !== null) return prev;
      const next = prev.map((a, i) => (i === qi ? oi : a));
      if (next.every((a) => a !== null)) {
        const s = next.filter((a, i) => a === questions[i].answer).length;
        recordQuiz(module, s, questions.length);
      }
      return next;
    });
  }

  return (
    <div>
      {questions.map((q, qi) => {
        const chosen = answers[qi];
        return (
          <div key={qi} className="crs-q">
            <p className="crs-q-text">
              {qi + 1}. <Inline text={q.q} />
            </p>
            {q.options.map((o, oi) => {
              const r = chosen === null ? undefined : oi === q.answer ? "ok" : oi === chosen ? "no" : undefined;
              return (
                <button key={oi} type="button" className="crs-q-opt" data-r={r} disabled={chosen !== null} onClick={() => pick(qi, oi)}>
                  <span style={{ fontWeight: 700, marginRight: 8 }}>{String.fromCharCode(65 + oi)}</span>
                  <Inline text={o} />
                </button>
              );
            })}
            {chosen !== null ? (
              <div className="crs-q-why" aria-live="polite">
                <b>{chosen === q.answer ? "Correct. " : "Not quite. "}</b>
                <Inline text={q.why} />
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="crs-controls">
        <span style={{ fontSize: "0.9rem" }}>
          {answered === questions.length ? (
            <b>
              Score: {score} / {questions.length}
            </b>
          ) : (
            `${answered} of ${questions.length} answered`
          )}
        </span>
        <button type="button" className="crs-btn crs-btn-ghost" onClick={() => setAnswers(questions.map(() => null))}>
          Retry quiz
        </button>
      </div>
    </div>
  );
}
