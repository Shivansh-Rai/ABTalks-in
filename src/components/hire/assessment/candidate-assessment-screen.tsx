"use client";

import { useMemo, useState } from "react";
import { MAX_PARAGRAPH_WORDS } from "@/lib/validations/assessment";
import type { AssessmentDraft, AssessmentQuestion } from "./assessment-types";
import { cn } from "@/lib/utils";

type Props = {
  draft: AssessmentDraft;
  readOnly: boolean;
};

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function CandidateAssessmentScreen({ draft, readOnly }: Props) {
  const [answers, setAnswers] = useState<Record<number, string | string[]>>(
    {},
  );

  const durationLabel = useMemo(() => {
    if (draft.durationMinutes == null) return "Untimed";
    return `${draft.durationMinutes} minute${draft.durationMinutes === 1 ? "" : "s"}`;
  }, [draft.durationMinutes]);

  return (
    <div className="hire-cand-assess">
      {readOnly && (
        <p className="hire-cand-assess__banner" role="status">
          Preview — this is exactly what the candidate sees. Answers are not
          saved.
        </p>
      )}

      <header className="hire-cand-assess__header">
        <h1>{draft.title.trim() || "Untitled assessment"}</h1>
        {draft.subheading?.trim() ? <p>{draft.subheading}</p> : null}
        <div className="hire-cand-assess__meta">
          <span className="hire-cand-assess__chip">{durationLabel}</span>
          <span>Pass mark {draft.passMarkPercent}%</span>
        </div>
        {draft.instructions?.trim() ? (
          <div className="hire-cand-assess__instructions">
            <h2>Instructions</h2>
            <p>{draft.instructions}</p>
          </div>
        ) : null}
      </header>

      <ol className="hire-cand-assess__list">
        {draft.questions.map((q, qi) => (
          <li key={qi} className="hire-cand-assess__item">
            <div className="hire-cand-assess__qhead">
              <span className="hire-cand-assess__num">Q{qi + 1}</span>
              <div>
                <p className="hire-cand-assess__title">
                  {q.title.trim() || "Untitled question"}
                  {q.isRequired ? (
                    <abbr title="Required"> *</abbr>
                  ) : null}
                </p>
                {q.helpText?.trim() ? (
                  <p className="hire-cand-assess__help">{q.helpText}</p>
                ) : null}
                <p className="hire-cand-assess__points">{q.points} pt</p>
              </div>
            </div>
            <QuestionInput
              question={q}
              index={qi}
              value={answers[qi]}
              readOnly={readOnly}
              onChange={(next) =>
                setAnswers((prev) => ({ ...prev, [qi]: next }))
              }
            />
          </li>
        ))}
      </ol>

      <button type="button" className="hire-cand-assess__submit" disabled>
        Submit assessment
      </button>
    </div>
  );
}

function QuestionInput({
  question,
  index,
  value,
  readOnly,
  onChange,
}: {
  question: AssessmentQuestion;
  index: number;
  value: string | string[] | undefined;
  readOnly: boolean;
  onChange: (next: string | string[]) => void;
}) {
  if (question.type === "MULTIPLE_CHOICE") {
    if (question.allowMultipleCorrect) {
      const selected = Array.isArray(value) ? value : [];
      return (
        <ul className="hire-cand-assess__options">
          {question.options.map((opt, oi) => {
            const id = `cand-q${index}-o${oi}`;
            const checked = selected.includes(String(oi));
            return (
              <li key={oi}>
                <label htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    disabled={readOnly}
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selected, String(oi)]);
                      } else {
                        onChange(selected.filter((x) => x !== String(oi)));
                      }
                    }}
                  />
                  <span>{opt.body || `Option ${oi + 1}`}</span>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }
    const selected = typeof value === "string" ? value : "";
    return (
      <ul className="hire-cand-assess__options">
        {question.options.map((opt, oi) => {
          const id = `cand-q${index}-o${oi}`;
          return (
            <li key={oi}>
              <label htmlFor={id}>
                <input
                  id={id}
                  type="radio"
                  name={`cand-q${index}`}
                  disabled={readOnly}
                  checked={selected === String(oi)}
                  onChange={() => onChange(String(oi))}
                />
                <span>{opt.body || `Option ${oi + 1}`}</span>
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  if (question.type === "PARAGRAPH") {
    const text = typeof value === "string" ? value : "";
    const cap = question.maxWords ?? MAX_PARAGRAPH_WORDS;
    const words = wordCount(text);
    return (
      <div className="hire-cand-assess__para">
        <textarea
          rows={6}
          disabled={readOnly}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer"
        />
        <p
          className={cn(
            "hire-cand-assess__counter",
            words > cap && "is-over",
          )}
        >
          {words} / {cap} words
        </p>
      </div>
    );
  }

  const link = typeof value === "string" ? value : "";
  return (
    <div className="hire-cand-assess__file">
      <a
        href={question.uploadDestinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="hire-cand-assess__upload-link"
      >
        Open upload destination
      </a>
      <label className="hire-assess-field">
        <span>Paste the link to your uploaded file</span>
        <input
          type="url"
          disabled={readOnly}
          value={link}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
      </label>
    </div>
  );
}
