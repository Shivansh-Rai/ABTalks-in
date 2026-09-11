"use client";

import { MAX_PARAGRAPH_WORDS } from "@/lib/validations/assessment";
import type { DraftQuestion } from "./assessment-types";
import { cn } from "@/lib/utils";

type Props = {
  question: DraftQuestion;
  index: number;
  total: number;
  locked?: boolean;
  onChange: (next: DraftQuestion) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAnnounce: (message: string) => void;
};

export function QuestionEditor({
  question,
  index,
  total,
  locked = false,
  onChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAnnounce,
}: Props) {
  function switchType(nextType: DraftQuestion["type"]) {
    if (locked) return;
    if (nextType === question.type) return;
    const shared = {
      key: question.key,
      title: question.title,
      helpText: question.helpText,
      isRequired: question.isRequired,
      points: question.points,
    };
    if (nextType === "MULTIPLE_CHOICE") {
      onChange({
        ...shared,
        type: "MULTIPLE_CHOICE",
        allowMultipleCorrect: false,
        options: [
          { body: "Option 1", isCorrect: false },
          { body: "Option 2", isCorrect: false },
        ],
      });
      return;
    }
    if (nextType === "PARAGRAPH") {
      onChange({
        ...shared,
        type: "PARAGRAPH",
        maxWords: MAX_PARAGRAPH_WORDS,
      });
      return;
    }
    onChange({
      ...shared,
      type: "FILE_UPLOAD",
      uploadDestinationUrl: "",
    });
  }

  function setAllowMultiple(allow: boolean) {
    if (locked) return;
    if (question.type !== "MULTIPLE_CHOICE") return;
    if (!allow) {
      const firstCorrect = question.options.findIndex((o) => o.isCorrect);
      const correctCount = question.options.filter((o) => o.isCorrect).length;
      const options = question.options.map((o, i) => ({
        ...o,
        isCorrect: firstCorrect >= 0 ? i === firstCorrect : false,
      }));
      onChange({ ...question, allowMultipleCorrect: false, options });
      if (correctCount > 1) {
        onAnnounce("Only the first correct option was kept.");
      }
      return;
    }
    onChange({ ...question, allowMultipleCorrect: true });
  }

  function markCorrect(optionIndex: number, checked: boolean) {
    if (locked) return;
    if (question.type !== "MULTIPLE_CHOICE") return;
    if (question.allowMultipleCorrect) {
      onChange({
        ...question,
        options: question.options.map((o, i) =>
          i === optionIndex ? { ...o, isCorrect: checked } : o,
        ),
      });
      return;
    }
    onChange({
      ...question,
      options: question.options.map((o, i) => ({
        ...o,
        isCorrect: i === optionIndex,
      })),
    });
  }

  return (
    <article
      id={`q-${question.key}`}
      tabIndex={-1}
      className={cn("hire-assess-q", locked && "hire-assess-q--locked")}
      aria-label={`Question ${index + 1}`}
    >
      {locked ? (
        <span className="hire-assess-q__badge">Provided by ABTalks</span>
      ) : null}
      <div className="hire-assess-q__head">
        <label className="hire-assess-q__type">
          <span>Type</span>
          <select
            value={question.type}
            disabled={locked}
            onChange={(e) =>
              switchType(e.target.value as DraftQuestion["type"])
            }
          >
            <option value="MULTIPLE_CHOICE">Multiple Choice</option>
            <option value="PARAGRAPH">Paragraph</option>
            <option value="FILE_UPLOAD">File Upload</option>
          </select>
        </label>
        <label className="hire-assess-q__points">
          <span>Points</span>
          <input
            type="number"
            min={0}
            max={100}
            value={question.points}
            disabled={locked}
            onChange={(e) =>
              onChange({
                ...question,
                points: Number(e.target.value) || 0,
              })
            }
          />
        </label>
        <label className="hire-assess-q__required">
          <input
            type="checkbox"
            checked={question.isRequired}
            disabled={locked}
            onChange={(e) =>
              onChange({ ...question, isRequired: e.target.checked })
            }
          />
          <span>Required</span>
        </label>
      </div>

      <label className="hire-assess-field">
        <span>Question</span>
        <textarea
          value={question.title}
          readOnly={locked}
          onChange={(e) => onChange({ ...question, title: e.target.value })}
          rows={2}
          placeholder="Write the question the candidate will see"
        />
      </label>

      <label className="hire-assess-field">
        <span>Help text (optional)</span>
        <input
          type="text"
          value={question.helpText ?? ""}
          readOnly={locked}
          onChange={(e) =>
            onChange({
              ...question,
              helpText: e.target.value.trim() ? e.target.value : null,
            })
          }
          placeholder="Short hint under the question"
        />
      </label>

      {question.type === "MULTIPLE_CHOICE" && (
        <div className="hire-assess-options">
          <div className="hire-assess-options__bar">
            <span>Options</span>
            <label className="hire-assess-q__required">
              <input
                type="checkbox"
                checked={question.allowMultipleCorrect}
                disabled={locked}
                onChange={(e) => setAllowMultiple(e.target.checked)}
              />
              <span>Multiple correct</span>
            </label>
          </div>
          <ul>
            {question.options.map((opt, oi) => (
              <li key={oi}>
                {question.allowMultipleCorrect ? (
                  <input
                    type="checkbox"
                    checked={opt.isCorrect}
                    disabled={locked}
                    onChange={(e) => markCorrect(oi, e.target.checked)}
                    aria-label={`Mark option ${oi + 1} correct`}
                  />
                ) : (
                  <input
                    type="radio"
                    name={`correct-${question.key}`}
                    checked={opt.isCorrect}
                    disabled={locked}
                    onChange={() => markCorrect(oi, true)}
                    aria-label={`Mark option ${oi + 1} correct`}
                  />
                )}
                <input
                  type="text"
                  value={opt.body}
                  readOnly={locked}
                  onChange={(e) => {
                    const options = question.options.map((o, i) =>
                      i === oi ? { ...o, body: e.target.value } : o,
                    );
                    onChange({ ...question, options });
                  }}
                  placeholder={`Option ${oi + 1}`}
                />
                {locked ? null : (
                  <button
                    type="button"
                    className="hire-assess-linkbtn"
                    disabled={question.options.length <= 2}
                    onClick={() => {
                      onChange({
                        ...question,
                        options: question.options.filter((_, i) => i !== oi),
                      });
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {locked ? null : (
            <button
              type="button"
              className="hire-assess-linkbtn"
              disabled={question.options.length >= 12}
              onClick={() =>
                onChange({
                  ...question,
                  options: [
                    ...question.options,
                    { body: `Option ${question.options.length + 1}`, isCorrect: false },
                  ],
                })
              }
            >
              Add option
            </button>
          )}
        </div>
      )}

      {question.type === "PARAGRAPH" && (
        <label className="hire-assess-field hire-assess-field--inline">
          <span>Word cap</span>
          <input
            type="number"
            min={10}
            max={1000}
            value={question.maxWords}
            disabled={locked}
            onChange={(e) =>
              onChange({
                ...question,
                maxWords: Number(e.target.value) || MAX_PARAGRAPH_WORDS,
              })
            }
          />
        </label>
      )}

      {question.type === "FILE_UPLOAD" && (
        <label className="hire-assess-field">
          <span>Where should candidates upload the file?</span>
          <input
            type="url"
            value={question.uploadDestinationUrl}
            readOnly={locked}
            onChange={(e) =>
              onChange({
                ...question,
                uploadDestinationUrl: e.target.value,
              })
            }
            placeholder="https://drive.google.com/…"
          />
          <span className="hire-assess-hint">
            ABTalks does not store files. Candidates open this link, upload
            there, and paste their own link back as the answer.
          </span>
        </label>
      )}

      <div className="hire-assess-q__actions">
        <button
          type="button"
          className={cn("hire-assess-linkbtn", index === 0 && "is-disabled")}
          disabled={index === 0}
          onClick={onMoveUp}
        >
          Move Up
        </button>
        <button
          type="button"
          className={cn(
            "hire-assess-linkbtn",
            index === total - 1 && "is-disabled",
          )}
          disabled={index === total - 1}
          onClick={onMoveDown}
        >
          Move Down
        </button>
        {locked ? null : (
          <button type="button" className="hire-assess-linkbtn" onClick={onDuplicate}>
            Duplicate
          </button>
        )}
        <button
          type="button"
          className="hire-assess-linkbtn"
          disabled={total <= 1}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
