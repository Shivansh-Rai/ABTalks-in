import { ExternalLink } from "lucide-react";
import { FormattedText } from "@/components/assessments/formatted-text";
import type {
  AttemptAnswerQuestion,
  AttemptAnswers,
} from "@/features/recruiter-assessments/attempt-answers";

/**
 * A candidate's attempt, question by question: what was asked, every option,
 * which one(s) the candidate chose and which are correct. Server Component,
 * read-only.
 */

const TYPE_LABEL: Record<AttemptAnswerQuestion["type"], string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  PARAGRAPH: "Paragraph",
  FILE_UPLOAD: "File link",
};

function Outcome({ q }: { q: AttemptAnswerQuestion }) {
  switch (q.outcome) {
    case "CORRECT":
      return (
        <span className="hire-attempt-chip" data-tone="good">
          Correct · {q.earnedPoints} {q.earnedPoints === 1 ? "pt" : "pts"}
        </span>
      );
    case "INCORRECT":
      return (
        <span className="hire-attempt-chip" data-tone="bad">
          {q.answered ? "Incorrect" : "Not answered"} · 0 of {q.points}{" "}
          {q.points === 1 ? "pt" : "pts"}
        </span>
      );
    case "NO_KEY":
      return (
        <span className="hire-attempt-chip" data-tone="warn">
          No correct option marked
        </span>
      );
    default:
      return (
        <span className="hire-attempt-chip" data-tone="muted">
          Not auto-graded
        </span>
      );
  }
}

function optionState(o: AttemptAnswerQuestion["options"][number]) {
  if (o.selected && o.isCorrect) return "chosen-correct";
  if (o.selected) return "chosen-wrong";
  if (o.isCorrect) return "correct";
  return "plain";
}

const OPTION_TAG: Record<string, string | null> = {
  "chosen-correct": "Candidate's answer · Correct",
  "chosen-wrong": "Candidate's answer · Incorrect",
  correct: "Correct answer",
  plain: null,
};

function QuestionCard({ q }: { q: AttemptAnswerQuestion }) {
  return (
    <li className="hire-attempt-q">
      <div className="hire-attempt-q__head">
        <p className="hire-attempt-q__title">
          <span className="hire-attempt-q__num">Q{q.number}</span>
          <FormattedText text={q.title} />
        </p>
        <Outcome q={q} />
      </div>
      <p className="hire-attempt-q__meta">
        {TYPE_LABEL[q.type]} · {q.points} {q.points === 1 ? "pt" : "pts"} ·{" "}
        {q.isRequired ? "Required" : "Optional"}
        {!q.answered && q.outcome !== "INCORRECT" ? " · No answer" : ""}
      </p>
      {q.helpText ? (
        <p className="hire-attempt-q__help">
          <FormattedText text={q.helpText} />
        </p>
      ) : null}

      {q.type === "MULTIPLE_CHOICE" ? (
        q.options.length === 0 ? (
          <p className="hire-attempt-q__empty">This question has no options.</p>
        ) : (
          <ul className="hire-attempt-opts">
            {q.options.map((o, i) => {
              const state = optionState(o);
              const tag = OPTION_TAG[state];
              return (
                <li key={o.id} className="hire-attempt-opt" data-state={state}>
                  <span className="hire-attempt-opt__letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="hire-attempt-opt__body">
                    <FormattedText text={o.body} />
                  </span>
                  {tag ? <span className="hire-attempt-opt__tag">{tag}</span> : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {q.type === "PARAGRAPH" ? (
        q.text && q.text.trim().length > 0 ? (
          <>
            <p className="hire-attempt-q__text">{q.text}</p>
            <p className="hire-attempt-q__meta">
              {q.wordCount} words
              {q.maxWords != null ? ` · limit ${q.maxWords}` : ""}
            </p>
          </>
        ) : (
          <p className="hire-attempt-q__empty">Nothing was written.</p>
        )
      ) : null}

      {q.type === "FILE_UPLOAD" ? (
        q.fileUrl && q.fileUrl.trim().length > 0 ? (
          <p className="hire-attempt-q__link">
            <span>Link the candidate pasted:</span>{" "}
            <a href={q.fileUrl} target="_blank" rel="noreferrer nofollow">
              {q.fileUrl} <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        ) : (
          <p className="hire-attempt-q__empty">No link was pasted.</p>
        )
      ) : null}
    </li>
  );
}

export function AttemptAnswersReview({
  answers,
  inProgress,
}: {
  answers: AttemptAnswers;
  inProgress: boolean;
}) {
  const a = answers;
  const parts: string[] = [];
  if (a.totalPoints > 0) {
    parts.push(`${a.earnedPoints} of ${a.totalPoints} points`);
    parts.push(`${a.correctCount} correct`);
    parts.push(`${a.incorrectCount} incorrect`);
  }
  if (a.notAutoGradedCount > 0) parts.push(`${a.notAutoGradedCount} not auto-graded`);
  if (a.unansweredCount > 0) parts.push(`${a.unansweredCount} unanswered`);

  return (
    <section className="hire-attempt" aria-label="Answers">
      <h2>Answers</h2>
      {inProgress ? (
        <p className="hire-attempt__note">
          The candidate has not submitted yet — these are the answers saved so far.
        </p>
      ) : a.scorePercent != null ? (
        <p className="hire-attempt__summary">
          <strong>
            {a.scorePercent}% — {a.passed ? "Passed" : "Failed"}
          </strong>{" "}
          <span>
            (pass mark {a.passMarkPercent}%)
            {parts.length > 0 ? ` · ${parts.join(" · ")}` : ""}
          </span>
        </p>
      ) : parts.length > 0 ? (
        <p className="hire-attempt__summary">{parts.join(" · ")}</p>
      ) : null}

      <div className="hire-attempt__legend" aria-hidden="true">
        <span data-state="chosen-correct">Chosen · correct</span>
        <span data-state="chosen-wrong">Chosen · incorrect</span>
        <span data-state="correct">Correct answer</span>
      </div>

      {a.questions.length === 0 ? (
        <p className="hire-attempt-q__empty">This assessment has no questions.</p>
      ) : (
        <ol className="hire-attempt__list">
          {a.questions.map((q) => (
            <QuestionCard key={q.questionId} q={q} />
          ))}
        </ol>
      )}
    </section>
  );
}
