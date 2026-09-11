"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  MAX_ANSWER_CHARS,
  MAX_PARAGRAPH_WORDS,
  countWords,
  isHttpUrl,
} from "@/lib/validations/assessment";
import type {
  CandidateAnswer,
  CandidateAssessmentView,
  CandidateQuestion,
} from "./assessment-types";
import { cn } from "@/lib/utils";
import "./candidate-assessment-screen.css";

/**
 * The one candidate assessment screen.
 *
 * - `preview` — the T-243 builder preview (the builder passes `draft` and
 *   `readOnly` only, so it lands here). Answers live in local state and are
 *   never sent anywhere.
 * - `instructions` / `taking` / `submitted` — the T-218 attempt. Answers are
 *   controlled by `AssessmentAttempt`, which autosaves every change.
 *
 * `draft` has no isCorrect in its type; the candidate page builds it from a
 * query that never selects it.
 */
type Stage = "preview" | "instructions" | "taking" | "submitted";

type Props = {
  draft: CandidateAssessmentView;
  readOnly: boolean;
  stage?: Stage;
  /** Controlled when present, keyed by question id. */
  answers?: Record<string, CandidateAnswer>;
  onAnswerChange?: (questionId: string, answer: CandidateAnswer) => void;
  /** Shown under that question, keyed like `answers`. */
  questionErrors?: Record<string, string>;
  /** The autosave indicator. */
  statusSlot?: ReactNode;
  onStart?: () => void;
  onSubmit?: () => void;
  confirmingSubmit?: boolean;
  onConfirmSubmit?: () => void;
  onCancelSubmit?: () => void;
  submitBlockedReason?: string | null;
  busy?: boolean;
  submittedAtLabel?: string | null;
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function typeHint(q: CandidateQuestion): string {
  if (q.type === "MULTIPLE_CHOICE") {
    return q.allowMultipleCorrect ? "Choose all that apply" : "Choose one";
  }
  if (q.type === "PARAGRAPH") return "Written answer";
  return "Link to your file";
}

export function CandidateAssessmentScreen({
  draft,
  readOnly,
  stage = "preview",
  answers,
  onAnswerChange,
  questionErrors,
  statusSlot,
  onStart,
  onSubmit,
  confirmingSubmit = false,
  onConfirmSubmit,
  onCancelSubmit,
  submitBlockedReason = null,
  busy = false,
  submittedAtLabel = null,
}: Props) {
  const [localAnswers, setLocalAnswers] = useState<
    Record<string, CandidateAnswer>
  >({});
  const current = answers ?? localAnswers;

  function change(key: string, next: CandidateAnswer) {
    if (onAnswerChange) onAnswerChange(key, next);
    else setLocalAnswers((prev) => ({ ...prev, [key]: next }));
  }

  // Shown, not enforced (D-5): there is no countdown and no auto-submit.
  const durationLabel =
    draft.durationMinutes == null
      ? "Untimed"
      : `Suggested time: ${plural(draft.durationMinutes, "minute")}`;
  const questionCount = draft.questions.length;
  const requiredCount = draft.questions.filter((q) => q.isRequired).length;

  return (
    <div className="hire-cand-assess" data-stage={stage}>
      {stage === "preview" && (
        <p className="hire-cand-assess__banner" role="status">
          Preview of what the candidate will see. Answers are not
          saved.
        </p>
      )}

      {stage === "submitted" && (
        <div className="hire-cand-assess__submitted" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <p className="hire-cand-assess__submitted-title">
              Submitted{submittedAtLabel ? ` ${submittedAtLabel}` : ""}.
            </p>
            <p>Your answers are with the recruiter.</p>
          </div>
        </div>
      )}

      <header className="hire-cand-assess__header">
        <h1>{draft.title.trim() || "Untitled assessment"}</h1>
        {draft.subheading?.trim() ? <p>{draft.subheading}</p> : null}
        <div className="hire-cand-assess__meta">
          <span className="hire-cand-assess__chip">
            <Clock aria-hidden="true" />
            {durationLabel}
          </span>
          <span className="hire-cand-assess__chip hire-cand-assess__chip--muted">
            {plural(questionCount, "question")}
          </span>
          <span className="hire-cand-assess__chip hire-cand-assess__chip--muted">
            Pass mark {draft.passMarkPercent}%
          </span>
        </div>
        {draft.instructions?.trim() ? (
          <div className="hire-cand-assess__instructions">
            <h2>Instructions</h2>
            <p>{draft.instructions}</p>
          </div>
        ) : null}
      </header>

      {stage === "instructions" ? (
        // Questions stay unseen until the candidate starts.
        <section className="hire-cand-assess__start" aria-label="Before you start">
          <p className="hire-cand-assess__start-summary">
            {plural(questionCount, "question")} · {requiredCount} required
          </p>
          <p>
            Your answers save automatically as you go. You can close this page
            and come back on any device.
          </p>
          <button
            type="button"
            className="hire-cand-assess__primary"
            disabled={busy}
            onClick={onStart}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Start assessment
            {!busy ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
          </button>
        </section>
      ) : (
        <>
          {stage === "taking" ? statusSlot : null}

          <ol className="hire-cand-assess__list">
            {draft.questions.map((q, qi) => {
              const key = q.id ?? String(qi);
              const titleId = `cand-q${qi}-title`;
              const error = questionErrors?.[key];
              const errorId = error ? `cand-q${qi}-error` : undefined;
              return (
                <li key={key} className="hire-cand-assess__item">
                  <div className="hire-cand-assess__qhead">
                    <span className="hire-cand-assess__num">Q{qi + 1}</span>
                    <div className="hire-cand-assess__qtext">
                      <p id={titleId} className="hire-cand-assess__title">
                        {q.title.trim() || "Untitled question"}
                        {q.isRequired ? <abbr title="Required"> *</abbr> : null}
                      </p>
                      {q.helpText?.trim() ? (
                        <p className="hire-cand-assess__help">{q.helpText}</p>
                      ) : null}
                      <p className="hire-cand-assess__points">
                        {plural(q.points, "pt")} · {typeHint(q)}
                      </p>
                    </div>
                  </div>
                  <QuestionInput
                    question={q}
                    index={qi}
                    titleId={titleId}
                    describedBy={errorId}
                    value={current[key]}
                    readOnly={readOnly}
                    onChange={(next) => change(key, next)}
                  />
                  {error ? (
                    <p id={errorId} className="hire-cand-assess__error" role="alert">
                      {error}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {stage === "preview" && (
            <button type="button" className="hire-cand-assess__submit" disabled>
              Submit assessment
            </button>
          )}

          {stage === "taking" && (
            <div className="hire-cand-assess__submit-area">
              {confirmingSubmit ? (
                <div
                  className="hire-cand-assess__confirm"
                  role="group"
                  aria-label="Confirm submission"
                >
                  <p>Submit your answers? You can&apos;t change them after this.</p>
                  <div className="hire-cand-assess__confirm-actions">
                    <button
                      type="button"
                      className="hire-cand-assess__secondary"
                      disabled={busy}
                      onClick={onCancelSubmit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="hire-cand-assess__primary"
                      disabled={busy}
                      onClick={onConfirmSubmit}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="hire-cand-assess__submit"
                    disabled={busy || Boolean(submitBlockedReason)}
                    onClick={onSubmit}
                  >
                    Submit assessment
                  </button>
                  {submitBlockedReason ? (
                    <p className="hire-cand-assess__hint">{submitBlockedReason}</p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  index,
  titleId,
  describedBy,
  value,
  readOnly,
  onChange,
}: {
  question: CandidateQuestion;
  index: number;
  titleId: string;
  describedBy: string | undefined;
  value: CandidateAnswer | undefined;
  readOnly: boolean;
  onChange: (next: CandidateAnswer) => void;
}) {
  if (question.type === "MULTIPLE_CHOICE") {
    const selected = value?.kind === "choice" ? value.selectedOptionIds : [];
    if (question.allowMultipleCorrect) {
      return (
        <ul
          className="hire-cand-assess__options"
          role="group"
          aria-labelledby={titleId}
          aria-describedby={describedBy}
        >
          {question.options.map((opt, oi) => {
            const optKey = opt.id ?? String(oi);
            const id = `cand-q${index}-o${oi}`;
            const checked = selected.includes(optKey);
            return (
              <li key={optKey}>
                <label htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    disabled={readOnly}
                    checked={checked}
                    onChange={(e) =>
                      // Always the full set, never a delta: a save is idempotent.
                      onChange({
                        kind: "choice",
                        selectedOptionIds: e.target.checked
                          ? [...selected, optKey]
                          : selected.filter((x) => x !== optKey),
                      })
                    }
                  />
                  <span>{opt.body || `Option ${oi + 1}`}</span>
                </label>
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <ul
        className="hire-cand-assess__options"
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
      >
        {question.options.map((opt, oi) => {
          const optKey = opt.id ?? String(oi);
          const id = `cand-q${index}-o${oi}`;
          return (
            <li key={optKey}>
              <label htmlFor={id}>
                <input
                  id={id}
                  type="radio"
                  name={`cand-q${index}`}
                  disabled={readOnly}
                  checked={selected[0] === optKey}
                  onChange={() =>
                    onChange({ kind: "choice", selectedOptionIds: [optKey] })
                  }
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
    const text = value?.kind === "text" ? value.text : "";
    const cap = question.maxWords ?? MAX_PARAGRAPH_WORDS;
    const words = countWords(text);
    return (
      <div className="hire-cand-assess__para">
        <textarea
          rows={6}
          disabled={readOnly}
          value={text}
          maxLength={MAX_ANSWER_CHARS}
          aria-labelledby={titleId}
          aria-describedby={describedBy}
          onChange={(e) => onChange({ kind: "text", text: e.target.value })}
          placeholder="Type your answer"
        />
        <p className={cn("hire-cand-assess__counter", words > cap && "is-over")}>
          {words} / {cap} words
        </p>
      </div>
    );
  }

  const link = value?.kind === "file" ? value.fileUrl : "";
  const destination = question.uploadDestinationUrl;
  const linkNeedsFix = link.trim() !== "" && !isHttpUrl(link.trim());
  return (
    <div className="hire-cand-assess__file">
      {/* Recruiter-supplied: a link only when it is http(s), never javascript: or data:. */}
      {destination && isHttpUrl(destination) ? (
        <a
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          className="hire-cand-assess__upload-link"
        >
          Open upload destination
          <ExternalLink aria-hidden="true" />
        </a>
      ) : (
        <p className="hire-cand-assess__upload-missing">
          The recruiter&apos;s upload link isn&apos;t a valid web address — ask
          them for a new one.
        </p>
      )}
      <label className="hire-cand-assess__field">
        <span>Paste the link to your uploaded file</span>
        <input
          type="url"
          inputMode="url"
          disabled={readOnly}
          value={link}
          aria-describedby={describedBy}
          onChange={(e) => onChange({ kind: "file", fileUrl: e.target.value })}
          placeholder="https://"
        />
      </label>
      {linkNeedsFix ? (
        <p className="hire-cand-assess__hint">
          Paste a full link starting with https://
        </p>
      ) : null}
    </div>
  );
}
