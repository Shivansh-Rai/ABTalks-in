"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAndSendRecruiterAssessmentAction,
  saveRecruiterAssessmentAction,
} from "@/app/actions/recruiter-assessment-actions";
import {
  MAX_ASSIGN_PER_CALL,
  assessmentDraftSchema,
  type AssessmentDraftInput,
} from "@/lib/validations/assessment";
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
  // Empty on purpose: the inputs show "Option 1" / "Option 2" as placeholders.
  options: [
    { body: "", isCorrect: false },
    { body: "", isCorrect: false },
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

/** A Shortlisted candidate the assessment can be sent to — refs only, no user id. */
type SendableCandidate = { candidateRef: string; label: string; jobRole: string };

type Props = {
  /** The recruiter's live Shortlist (legacy + project halves, searchable only). */
  candidates: SendableCandidate[];
  existingDraft: AssessmentDraft | null;
};

export function AssessmentBuilder({ candidates, existingDraft }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"save" | "create" | null>(null);
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
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);

  // Provenance only (nothing reads it — plan 128 §2): the Shortlist this was
  // built against.
  const shortlistRefs = useMemo(
    () => candidates.map((c) => c.candidateRef),
    [candidates],
  );

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

  // Only refs still on the Shortlist are ever sent.
  const picked = candidates.filter((c) => selected.has(c.candidateRef));
  const pickedCount = picked.length;
  const allPicked = candidates.length > 0 && pickedCount === candidates.length;
  const createBlockedReason =
    candidates.length === 0
      ? "Your Shortlist is empty — shortlist candidates on Hire to send this. You can still save a draft."
      : pickedCount === 0
        ? "Select at least one shortlisted candidate to send this to."
        : pickedCount > MAX_ASSIGN_PER_CALL
          ? `Send to at most ${MAX_ASSIGN_PER_CALL} candidates at a time.`
          : null;

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

  function toggle(ref: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  /** The same checks for Save draft and Create; highlights what fails. */
  function validDraft(): AssessmentDraftInput | null {
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
      // Options start empty now, so name the question an issue belongs to.
      const first = parsed.error.issues[0];
      const qIndex =
        first?.path[0] === "questions" && typeof first.path[1] === "number"
          ? first.path[1]
          : null;
      toast.error(
        first
          ? qIndex !== null
            ? `Question ${qIndex + 1}: ${first.message}`
            : first.message
          : "Fix the highlighted fields",
      );
      return null;
    }
    setFieldErrors({});
    return parsed.data;
  }

  function save() {
    const draft = validDraft();
    if (!draft) return;
    setPendingAction("save");
    startTransition(async () => {
      const res = await saveRecruiterAssessmentAction(draft);
      setPendingAction(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setAssessmentId(res.data.id);
      toast.success("Draft saved");
      router.push("/hire/assessments");
    });
  }

  /** First click: check everything, then ask — Create notifies people. */
  function askCreate() {
    if (createBlockedReason) {
      toast.error(createBlockedReason);
      return;
    }
    if (!validDraft()) return;
    setConfirming(true);
  }

  function create() {
    const draft = validDraft();
    if (!draft || createBlockedReason) {
      setConfirming(false);
      if (createBlockedReason) toast.error(createBlockedReason);
      return;
    }
    const candidateRefs = picked.map((c) => c.candidateRef);
    setPendingAction("create");
    startTransition(async () => {
      const res = await createAndSendRecruiterAssessmentAction({
        draft,
        candidateRefs,
      });
      setPendingAction(null);
      if (!res.ok) {
        // A draft saved before the failure keeps its id, so the next click
        // updates it instead of creating a second one.
        if (res.assessmentId) setAssessmentId(res.assessmentId);
        setConfirming(false);
        toast.error(res.message);
        return;
      }
      const { id, assigned, alreadyAssigned, notificationFailures, assignError } =
        res.data;
      if (assignError) {
        toast.warning(
          `Published, but not sent yet: ${assignError} Assign candidates from this page.`,
        );
      } else {
        const sent = assigned + alreadyAssigned;
        toast.success(
          `Published and sent to ${sent} candidate${sent === 1 ? "" : "s"}.`,
        );
        if (notificationFailures > 0) {
          toast.warning(
            `${notificationFailures} notification${notificationFailures === 1 ? "" : "s"} could not be sent. Assign again to retry — nobody is notified twice.`,
          );
        }
      }
      router.push(`/hire/assessments/${id}`);
    });
  }

  return (
    <div className="hire-assess">
      <div className="hire-assess__top">
        <div>
          <p className="hire-assess__kicker">Assessment builder</p>
          <h1>Create an assessment</h1>
          <p className="hire-assess__sub">
            For {candidates.length} shortlisted candidate
            {candidates.length === 1 ? "" : "s"}
          </p>
        </div>
        {/* Phones only: at ≥1100px both panes are always on screen, so the
            toggle is hidden there (hire-scout.css). */}
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

          <section className="hire-assess__send" aria-labelledby="assess-send-heading">
            <div className="hire-assess__send-head">
              <h2 id="assess-send-heading">Send to shortlisted candidates</h2>
              {candidates.length > 0 && (
                <button
                  type="button"
                  className="hire-assess-linkbtn"
                  disabled={pending}
                  onClick={() =>
                    setSelected(allPicked ? new Set() : new Set(shortlistRefs))
                  }
                >
                  {allPicked ? "Clear selection" : "Select all"}
                </button>
              )}
            </div>
            <p className="hire-assess-hint">
              Create publishes this assessment and sends it to the candidates
              you tick. Each one is notified and finds it on their Assessments
              page.
            </p>
            {candidates.length === 0 ? (
              <p className="hire-assess__send-empty">
                Your Shortlist is empty. Shortlist candidates on Hire first — you
                can still save this as a draft.
              </p>
            ) : (
              <fieldset className="hire-assess-assign__fieldset" aria-busy={pending}>
                <legend className="sr-only">Shortlisted candidates</legend>
                <ul className="hire-assess-assign__list">
                  {candidates.map((c) => (
                    <li key={c.candidateRef}>
                      <label className="hire-assess-assign__row">
                        <input
                          type="checkbox"
                          checked={selected.has(c.candidateRef)}
                          disabled={pending}
                          onChange={() => toggle(c.candidateRef)}
                        />
                        <span className="hire-assess-assign__who">
                          <span>{c.label}</span>
                          <span className="hire-assess-detail__role">{c.jobRole}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </section>

          <div className="hire-assess__save">
            {confirming ? (
              <div
                className="hire-assess-assign__confirm hire-assess__confirm"
                role="group"
                aria-label="Confirm create"
              >
                <p>
                  Publish and send to {pickedCount} candidate
                  {pickedCount === 1 ? "" : "s"}? Publishing locks the questions
                  and the pass mark, and each candidate is notified.
                </p>
                <div className="hire-assess-assign__confirm-actions">
                  <button
                    type="button"
                    className="hire-assess__savebtn hire-assess__savebtn--ghost"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="hire-assess__savebtn"
                    disabled={pending}
                    onClick={create}
                  >
                    {pendingAction === "create" ? "Creating…" : "Create"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="hire-assess__savebtn hire-assess__savebtn--ghost"
                  disabled={pending}
                  onClick={save}
                >
                  {pendingAction === "save" ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className="hire-assess__savebtn"
                  disabled={pending || Boolean(createBlockedReason)}
                  aria-describedby="assess-create-hint"
                  onClick={askCreate}
                >
                  Create
                </button>
                <p id="assess-create-hint" className="hire-assess-hint hire-assess__save-hint">
                  {createBlockedReason ??
                    `Sends to ${pickedCount} selected candidate${pickedCount === 1 ? "" : "s"}.`}
                </p>
              </>
            )}
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
