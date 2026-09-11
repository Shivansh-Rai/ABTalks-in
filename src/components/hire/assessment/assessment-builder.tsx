"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveRecruiterAssessmentAction } from "@/app/actions/recruiter-assessment-actions";
import { assessmentDraftSchema } from "@/lib/validations/assessment";
import { CandidateAssessmentScreen } from "./candidate-assessment-screen";
import { QuestionEditor } from "./question-editor";
import type { AssessmentDraft, DraftQuestion } from "./assessment-types";
import { cn } from "@/lib/utils";

const NEW_MCQ = (): DraftQuestion => ({
  key: crypto.randomUUID(),
  type: "MULTIPLE_CHOICE",
  title: "",
  helpText: null,
  isRequired: true,
  points: 1,
  allowMultipleCorrect: false,
  options: [
    { body: "Option 1", isCorrect: false },
    { body: "Option 2", isCorrect: false },
  ],
});

function toDraftQuestions(
  existing: AssessmentDraft | null,
): DraftQuestion[] {
  if (!existing?.questions?.length) return [NEW_MCQ()];
  return existing.questions.map((q) => ({
    ...q,
    key: crypto.randomUUID(),
  }));
}

function stripKeys(questions: DraftQuestion[]) {
  return questions.map(({ key: _key, ...rest }) => {
    void _key;
    return rest;
  });
}

type Props = {
  shortlistCount: number;
  shortlistRefs: string[];
  existingDraft: AssessmentDraft | null;
};

export function AssessmentBuilder({
  shortlistCount,
  shortlistRefs,
  existingDraft,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [assessmentId, setAssessmentId] = useState(
    existingDraft?.assessmentId,
  );
  const [title, setTitle] = useState(existingDraft?.title ?? "");
  const [subheading, setSubheading] = useState(
    existingDraft?.subheading ?? "",
  );
  const [instructions, setInstructions] = useState(
    existingDraft?.instructions ?? "",
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    existingDraft?.durationMinutes ?? null,
  );
  const [untimed, setUntimed] = useState(
    existingDraft?.durationMinutes == null,
  );
  const [passMarkPercent, setPassMarkPercent] = useState(
    existingDraft?.passMarkPercent ?? 60,
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    toDraftQuestions(existingDraft),
  );
  const [announce, setAnnounce] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const previewDraft: AssessmentDraft = useMemo(
    () => ({
      assessmentId,
      title,
      subheading: subheading.trim() ? subheading : null,
      instructions: instructions.trim() ? instructions : null,
      durationMinutes: untimed ? null : durationMinutes,
      passMarkPercent,
      shortlistRefs,
      questions: stripKeys(questions) as AssessmentDraft["questions"],
    }),
    [
      assessmentId,
      title,
      subheading,
      instructions,
      untimed,
      durationMinutes,
      passMarkPercent,
      shortlistRefs,
      questions,
    ],
  );

  function move(from: number, to: number) {
    setQuestions((q) => {
      if (to < 0 || to >= q.length) return q;
      const next = [...q];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    const moved = questions[from];
    if (moved) {
      queueMicrotask(() => {
        document.getElementById(`q-${moved.key}`)?.focus();
      });
      setAnnounce(`Question moved to position ${to + 1} of ${questions.length}`);
    }
  }

  function save() {
    const payload = {
      ...previewDraft,
      assessmentId,
      durationMinutes: untimed ? null : durationMinutes,
    };
    const parsed = assessmentDraftSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      toast.error(parsed.error.issues[0]?.message ?? "Fix the highlighted fields");
      return;
    }
    setFieldErrors({});
    startTransition(async () => {
      const res = await saveRecruiterAssessmentAction(parsed.data);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setAssessmentId(res.data.id);
      toast.success("Draft saved");
      router.push("/hire/assessments");
    });
  }

  return (
    <div className="hire-assess">
      <div className="hire-assess__top">
        <div>
          <p className="hire-assess__kicker">Assessment builder</p>
          <h1>Create an assessment</h1>
          <p className="hire-assess__sub">
            For {shortlistCount} shortlisted candidate
            {shortlistCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="hire-assess__seg" role="tablist" aria-label="Edit or preview">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            className={cn(mode === "edit" && "is-active")}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            className={cn(mode === "preview" && "is-active")}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="hire-assess__panes" data-mode={mode}>
        <div
          className="hire-assess__form"
          data-active={mode === "edit" ? "true" : "false"}
        >
          <label className="hire-assess-field">
            <span>Assessment Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend fundamentals screen"
              required
            />
            {fieldErrors.title ? (
              <span className="hire-assess-error">{fieldErrors.title}</span>
            ) : null}
          </label>

          <label className="hire-assess-field">
            <span>Subheading</span>
            <input
              type="text"
              value={subheading}
              onChange={(e) => setSubheading(e.target.value)}
              placeholder="Optional one-liner under the title"
            />
          </label>

          <label className="hire-assess-field">
            <span>Instructions</span>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What the candidate should know before starting"
            />
          </label>

          <div className="hire-assess__settings">
            <label className="hire-assess-field hire-assess-field--inline">
              <span>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                max={480}
                disabled={untimed}
                value={durationMinutes ?? ""}
                onChange={(e) =>
                  setDurationMinutes(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label className="hire-assess-q__required">
              <input
                type="checkbox"
                checked={untimed}
                onChange={(e) => {
                  setUntimed(e.target.checked);
                  if (e.target.checked) setDurationMinutes(null);
                  else if (durationMinutes == null) setDurationMinutes(30);
                }}
              />
              <span>Untimed</span>
            </label>
            <label className="hire-assess-field hire-assess-field--inline">
              <span>Pass mark %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={passMarkPercent}
                onChange={(e) =>
                  setPassMarkPercent(Number(e.target.value) || 0)
                }
              />
            </label>
          </div>

          <div className="hire-assess__questions">
            <div className="hire-assess__questions-head">
              <h2>Questions</h2>
              <button
                type="button"
                className="hire-assess-linkbtn"
                onClick={() => setQuestions((q) => [...q, NEW_MCQ()])}
              >
                Add question
              </button>
            </div>
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.key}
                question={q}
                index={i}
                total={questions.length}
                onChange={(next) =>
                  setQuestions((all) =>
                    all.map((item) => (item.key === next.key ? next : item)),
                  )
                }
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                onDuplicate={() => {
                  const copy: DraftQuestion = {
                    ...structuredClone(q),
                    key: crypto.randomUUID(),
                  };
                  setQuestions((all) => {
                    const next = [...all];
                    next.splice(i + 1, 0, copy);
                    return next;
                  });
                }}
                onDelete={() =>
                  setQuestions((all) => all.filter((item) => item.key !== q.key))
                }
                onAnnounce={(msg) => {
                  setAnnounce(msg);
                  toast.message(msg);
                }}
              />
            ))}
            {fieldErrors.questions ? (
              <span className="hire-assess-error">{fieldErrors.questions}</span>
            ) : null}
          </div>

          <div className="hire-assess__save">
            <button
              type="button"
              className="hire-assess__savebtn"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save draft"}
            </button>
          </div>
        </div>

        <div
          className="hire-assess__preview"
          data-active={mode === "preview" ? "true" : "false"}
        >
          <CandidateAssessmentScreen draft={previewDraft} readOnly />
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
