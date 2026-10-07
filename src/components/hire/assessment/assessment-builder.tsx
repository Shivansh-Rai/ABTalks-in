"use client";

import {
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createAndSendRecruiterAssessmentAction,
  saveRecruiterAssessmentAction,
} from "@/app/actions/recruiter-assessment-actions";
import {
  createRecruiterAssessmentTemplateAction,
  updateRecruiterAssessmentTemplateAction,
} from "@/app/actions/recruiter-assessment-template-actions";
import {
  createAndSendPlatformAssessmentAction,
  editSentPlatformAssessmentAction,
  savePlatformAssessmentAction,
} from "@/app/actions/admin-assessment-actions";
import {
  PlatformAudiencePicker,
  PlatformDeadlineField,
  SETTING_HEAD_CLASS,
  SETTING_LABEL_CLASS,
  audienceEstimate,
  defaultDeadlineLocal,
  isoToIstLocal,
  istLocalToIso,
  type PlatformAudienceOptions,
  type PlatformAudienceValue,
} from "@/components/admin/platform-audience-picker";
import {
  MAX_ASSIGN_PER_CALL,
  assessmentDraftSchema,
  type AssessmentContent,
  type AssessmentDraftInput,
} from "@/lib/validations/assessment";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentJsonImport } from "./assessment-json-import";
import { CandidateAssessmentScreen } from "./candidate-assessment-screen";
import { FormattedText } from "@/components/assessments/formatted-text";
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
  presetLocked: boolean,
): DraftQuestion[] {
  if (!existing?.questions?.length) return [NEW_MCQ()];
  return existing.questions.map((q) => ({
    ...q,
    key: crypto.randomUUID(),
    ...(presetLocked ? { locked: true } : null),
  }));
}

function stripKeys(questions: DraftQuestion[]) {
  return questions.map(({ key: _key, locked: _locked, ...rest }) => {
    void _key;
    void _locked;
    return rest;
  });
}

/** A Shortlisted candidate the assessment can be sent to — refs only, no user id. */
type SendableCandidate = { candidateRef: string; label: string; jobRole: string };

type Props = {
  /** The live Shortlist for ONE scope — this project's, or the legacy list. */
  candidates: SendableCandidate[];
  existingDraft: AssessmentDraft | null;
  presetLocked?: boolean;
  /**
   * Which project `candidates` came from, sent back with Create so the server
   * resolves the refs against the same Shortlist the checkboxes were drawn
   * from. Null = off-project, which is the legacy saved list.
   */
  projectId?: string | null;
  /** Rendered under the template picker: an h2 instead of the page h1. */
  embedded?: boolean;
  /**
   * Plan 166: set on /admin/assessments. The builder saves through the admin
   * actions and the send step picks an audience + deadline instead of a
   * Shortlist (`candidates` is then empty and unused).
   */
  platform?: {
    audienceOptions: PlatformAudienceOptions;
    /**
     * Plan 166: editing an assessment that was already sent. Anything can
     * change until someone starts; after that only wording (`startedCount`
     * > 0). The deadline can move and groups can be added, never removed.
     */
    sent?: {
      /** Null = the assessment has no deadline. */
      deadlineAt: string | null;
      audience: PlatformAudienceValue;
      startedCount: number;
    };
  };
  /**
   * Plan 185: recruiter pages only. Offers "Save as template". Admin pages
   * never pass it, and the template actions refuse a non-recruiter regardless.
   */
  canSaveTemplate?: boolean;
  /**
   * Plan 185: the recruiter's own template this builder was opened from
   * (Customize). Adds "Update template", which saves back to that template.
   */
  template?: { id: string; name: string } | null;
  /** Plan 185: lets the template landing hand an imported file to this builder. */
  ref?: Ref<AssessmentBuilderHandle>;
};

/** What the builder lets its parent do to it. */
export type AssessmentBuilderHandle = {
  /** Fill the builder from imported content, asking first if it has content. */
  importContent: (content: AssessmentContent) => void;
};

/** The reusable part of a validated draft: what a template stores. */
function toContent(draft: AssessmentDraftInput): AssessmentContent {
  return {
    title: draft.title,
    subheading: draft.subheading ?? null,
    instructions: draft.instructions ?? null,
    durationMinutes: draft.durationMinutes,
    passMarkPercent: draft.passMarkPercent,
    cameraRequired: draft.cameraRequired,
    questions: draft.questions,
  };
}

/** Plan 166 — the formatting authors can use, shown in the callout. */
function FormattingHelp() {
  const chip =
    "rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-[#03535F] ring-1 ring-[#D4EBEC]";
  return (
    <div>
      <p>
        <strong>Formatting</strong> works in questions, help text, options and
        instructions:
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
        <li>
          <code className={chip}>*bold*</code> → <strong>bold</strong>
        </li>
        <li>
          <code className={chip}>_italic_</code> → <em>italic</em>
        </li>
        <li>
          <code className={chip}>`code`</code> → <FormattedText text="`code`" />
        </li>
        <li>
          <kbd className={chip}>Enter</kbd> → new line (questions and
          instructions)
        </li>
      </ul>
    </div>
  );
}

/** Mirrors `durationMinutes` max in assessmentDraftSchema. */
const MAX_DURATION_MINUTES = 480;

const EMPTY_AUDIENCE: PlatformAudienceValue = { all: false, domains: [], workshopEventIds: [] };

export function AssessmentBuilder({
  candidates,
  existingDraft,
  presetLocked = false,
  projectId = null,
  embedded = false,
  platform,
  canSaveTemplate = false,
  template = null,
  ref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<
    "save" | "create" | "template" | null
  >(null);
  // Plan 185: an imported file waiting for "Replace what's here?".
  const [pendingImport, setPendingImport] = useState<AssessmentContent | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [previewOpen, setPreviewOpen] = useState(false);
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
  const [cameraRequired, setCameraRequired] = useState(
    existingDraft?.cameraRequired ?? false,
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    toDraftQuestions(existingDraft, presetLocked),
  );
  const [announce, setAnnounce] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const sent = platform?.sent ?? null;
  // Someone has started a sent assessment: only wording may change.
  const wordingOnly = (sent?.startedCount ?? 0) > 0;
  const [audience, setAudience] = useState<PlatformAudienceValue>(
    sent?.audience ?? EMPTY_AUDIENCE,
  );
  const [deadlineLocal, setDeadlineLocal] = useState(() =>
    sent?.deadlineAt
      ? isoToIstLocal(sent.deadlineAt)
      : platform
        ? defaultDeadlineLocal()
        : "",
  );
  // Plan 166: a platform assessment may stay open with no closing date.
  const [noDeadline, setNoDeadline] = useState(
    sent !== null && sent.deadlineAt === null,
  );
  const deadlineMissing = !noDeadline && !istLocalToIso(deadlineLocal);
  const audienceCount = platform ? audienceEstimate(platform.audienceOptions, audience) : 0;
  const hasAudience =
    audience.all || audience.domains.length > 0 || audience.workshopEventIds.length > 0;
  const addsGroups =
    sent !== null &&
    ((audience.all && !sent.audience.all) ||
      audience.domains.some((d) => !sent.audience.domains.includes(d)) ||
      audience.workshopEventIds.some((w) => !sent.audience.workshopEventIds.includes(w)));
  // Upper bound; anyone who already has it is skipped on save.
  const addedCount =
    sent && platform
      ? Math.max(0, audienceCount - audienceEstimate(platform.audienceOptions, sent.audience))
      : 0;

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
      cameraRequired,
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
      cameraRequired,
      shortlistRefs,
      questions,
    ],
  );

  // Only refs still on the Shortlist are ever sent.
  const picked = candidates.filter((c) => selected.has(c.candidateRef));
  const pickedCount = picked.length;
  const allPicked = candidates.length > 0 && pickedCount === candidates.length;
  // Plan 184: for a recruiter, nobody ticked is not a block — publishing never
  // needs a candidate. The primary button says which of the two it will do.
  const sendsNow = pickedCount > 0;
  const createLabel = platform ? "Create" : sendsNow ? "Publish and send" : "Publish";
  const creatingLabel = platform ? "Creating…" : "Publishing…";
  const createBlockedReason = sent
    ? deadlineMissing
      ? "Set a deadline, or tick No deadline."
      : null
    : platform
    ? !hasAudience
      ? "Pick who this assessment goes to."
      : audienceCount === 0
        ? "Nobody is in the groups you picked yet."
        : deadlineMissing
          ? "Set a deadline, or tick No deadline."
          : null
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
      const res = platform
        ? await savePlatformAssessmentAction(draft)
        : await saveRecruiterAssessmentAction(draft);
      setPendingAction(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setAssessmentId(res.data.id);
      toast.success("Draft saved");
      router.push(platform ? "/admin/assessments" : "/hire/assessments");
    });
  }

  // ---- Plan 185: import from JSON ------------------------------------------
  // Never on a locked ABTalks preset (it would swap out the locked questions)
  // or on a sent platform assessment (its questions may already be answered).
  const canImport = !presetLocked && !sent;
  // Embedded, the landing shows the control beside "Start from blank" instead
  // and reaches this builder through its ref.
  const showImport = canImport && !embedded;

  /** Nothing typed or set yet: an import can fill the builder without asking. */
  function isUntouched(): boolean {
    return (
      title.trim() === "" &&
      subheading.trim() === "" &&
      instructions.trim() === "" &&
      untimed &&
      passMarkPercent === 60 &&
      !cameraRequired &&
      questions.every(
        (q) =>
          q.title.trim() === "" &&
          (q.type !== "MULTIPLE_CHOICE" ||
            q.options.every((o) => o.body.trim() === "")),
      )
    );
  }

  /** Replace the builder's content. State only: nothing is saved here. */
  function applyImport(content: AssessmentContent) {
    setTitle(content.title);
    setSubheading(content.subheading ?? "");
    setInstructions(content.instructions ?? "");
    setDurationMinutes(content.durationMinutes);
    setUntimed(content.durationMinutes == null);
    setPassMarkPercent(content.passMarkPercent);
    setCameraRequired(content.cameraRequired);
    // Imported questions are the author's own: editable, never locked.
    setQuestions(
      content.questions.map((q) => ({ ...q, key: crypto.randomUUID() })),
    );
    setFieldErrors({});
    setConfirming(false);
    setPendingImport(null);
    const n = content.questions.length;
    toast.success(
      `Imported ${n} question${n === 1 ? "" : "s"}. Review them, then save.`,
    );
  }

  function importContent(content: AssessmentContent) {
    if (!canImport) return;
    if (isUntouched()) applyImport(content);
    else setPendingImport(content);
  }

  useImperativeHandle(ref, () => ({ importContent }));

  // ---- Plan 185: the recruiter's own templates ------------------------------
  // Not while customizing an ABTalks preset: a template's questions are
  // editable, so saving one there would unlock the locked questions.
  const showTemplateActions = canSaveTemplate && !platform && !presetLocked;

  /** Opens the name dialog once the content is valid: a template always works. */
  function askSaveTemplate() {
    if (!validDraft()) return;
    setTemplateName(title.trim().slice(0, 120));
    setTemplateDescription("");
    setTemplateDialogOpen(true);
  }

  function saveTemplate() {
    const draft = validDraft();
    if (!draft) {
      setTemplateDialogOpen(false);
      return;
    }
    const name = templateName.trim();
    if (!name) {
      toast.error("Give the template a name");
      return;
    }
    setPendingAction("template");
    startTransition(async () => {
      const res = await createRecruiterAssessmentTemplateAction({
        name,
        description: templateDescription.trim() || null,
        content: toContent(draft),
      });
      setPendingAction(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setTemplateDialogOpen(false);
      toast.success("Template saved. Find it under My templates.");
      // The landing lists templates above this builder; the builder keeps its state.
      router.refresh();
    });
  }

  /** Save the builder's content back to the template it was opened from. */
  function updateTemplate() {
    if (!template) return;
    const draft = validDraft();
    if (!draft) return;
    setPendingAction("template");
    startTransition(async () => {
      const res = await updateRecruiterAssessmentTemplateAction({
        templateId: template.id,
        content: toContent(draft),
      });
      setPendingAction(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Template updated.");
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
    if (platform) {
      createPlatform(draft);
      return;
    }
    const candidateRefs = picked.map((c) => c.candidateRef);
    setPendingAction("create");
    startTransition(async () => {
      const res = await createAndSendRecruiterAssessmentAction({
        draft,
        candidateRefs,
        projectId,
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
      } else if (candidateRefs.length === 0) {
        toast.success("Published. Pick candidates on this page to send it.");
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
      // The project rides along so the assign panel there offers the same
      // Shortlist this builder did — a new assessment is filed under no project.
      router.push(
        projectId
          ? `/hire/assessments/${id}?projectId=${encodeURIComponent(projectId)}`
          : `/hire/assessments/${id}`,
      );
    });
  }

  function createPlatform(draft: AssessmentDraftInput) {
    const deadlineAt = noDeadline ? null : istLocalToIso(deadlineLocal);
    if (deadlineMissing) {
      setConfirming(false);
      toast.error("Set a deadline, or tick No deadline.");
      return;
    }
    setPendingAction("create");
    startTransition(async () => {
      const res = await createAndSendPlatformAssessmentAction({ draft, audience, deadlineAt });
      setPendingAction(null);
      if (!res.ok) {
        if (res.assessmentId) setAssessmentId(res.assessmentId);
        setConfirming(false);
        toast.error(res.message);
        return;
      }
      const n = res.data.assigned;
      toast.success(
        `Published and sent to ${n.toLocaleString("en-IN")} candidate${n === 1 ? "" : "s"}.`,
      );
      router.push(`/admin/assessments/${res.data.id}`);
    });
  }

  /** Editing a sent assessment: confirm first only when it reaches new people. */
  function askSaveSent() {
    if (createBlockedReason) {
      toast.error(createBlockedReason);
      return;
    }
    const draft = validDraft();
    if (!draft) return;
    if (addsGroups) {
      setConfirming(true);
      return;
    }
    saveSent(draft);
  }

  function saveSent(draft: AssessmentDraftInput | null = validDraft()) {
    const deadlineAt = noDeadline ? null : istLocalToIso(deadlineLocal);
    if (!draft || deadlineMissing || !assessmentId) {
      setConfirming(false);
      if (deadlineMissing) toast.error("Set a deadline, or tick No deadline.");
      return;
    }
    setPendingAction("create");
    startTransition(async () => {
      const res = await editSentPlatformAssessmentAction({
        assessmentId,
        draft,
        audience,
        deadlineAt,
      });
      setPendingAction(null);
      setConfirming(false);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const n = res.data.added;
      toast.success(
        n > 0
          ? `Changes saved and sent to ${n.toLocaleString("en-IN")} more candidate${n === 1 ? "" : "s"}.`
          : "Changes saved.",
      );
      router.push(`/admin/assessments/${assessmentId}`);
    });
  }

  const heading = sent
    ? "Edit sent assessment"
    : presetLocked
    ? "Customize a template"
    : template
      ? "Customize your template"
      : assessmentId
        ? "Edit assessment"
        : "Create an assessment";

  return (
    <div
      className={cn("hire-assess hire-assess--builder", embedded && "hire-assess--embedded")}
      id={embedded ? "blank-assessment" : undefined}
    >
      <div className="hire-assess__top">
        <div className="hire-assess__heading">
          {embedded ? (
            <>
              <h2 className="hire-assess__embedded-title">
                Or start from a blank assessment
              </h2>
              <p className="hire-assess__sub">
                Write your own questions for {candidates.length} shortlisted
                candidate{candidates.length === 1 ? "" : "s"}.
              </p>
            </>
          ) : (
            <>
              {platform ? null : (
                <p className="hire-assess__kicker">Assessment builder</p>
              )}
              <h1>{heading}</h1>
              <p className="hire-assess__sub">
                {platform
                  ? ""
                  : `For ${candidates.length} shortlisted candidate${candidates.length === 1 ? "" : "s"}`}
              </p>
            </>
          )}
        </div>
        <div className="hire-assess__top-actions">
          {showImport ? (
            <AssessmentJsonImport onImport={importContent} disabled={pending} />
          ) : null}
          {/* Desktop: the preview opens in a modal, never beside the form. */}
          <button
            type="button"
            className="hire-assess__previewbtn"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye aria-hidden="true" />
            Open preview
          </button>
          {/* Below 1100px: switch the one pane between edit and preview. */}
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
      </div>

      <div className="hire-assess__callout">
        {presetLocked ? (
          <p>
            Template questions can’t be edited, but you can remove them or add
            your own.
          </p>
        ) : null}
        {template ? (
          <p>
            You are working from your template “{template.name}”. Saving a draft
            or publishing creates a new assessment and leaves the template as it
            is. Update template saves these changes back to it.
          </p>
        ) : null}
        {sent ? (
          <p>
            {wordingOnly
              ? `${sent.startedCount} candidate${sent.startedCount === 1 ? " has" : "s have"} started, so questions, answers, points and settings are locked. You can still fix wording, move the deadline and add groups.`
              : "Nobody has started yet, so you can change anything. Once someone starts, only wording and the deadline can change."}
          </p>
        ) : null}
        {platform ? null : (
          <p>
            Published assessments run in strict mode: laptop or desktop only,
            fullscreen required, copy and paste blocked, and page activity
            recorded for you to review.
          </p>
        )}
        <FormattingHelp />
      </div>

      <div className="hire-assess__panes" data-mode={mode}>
        <div
          className="hire-assess__form"
          data-active={mode === "edit" ? "true" : "false"}
        >
          <section className="hire-assess__card" aria-labelledby="assess-details-heading">
            <h2 id="assess-details-heading" className="hire-assess__card-title">
              Details
            </h2>
            <div className="hire-assess__grid">
              <label className="hire-assess-field">
                <span>Assessment title</span>
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

              <label className="hire-assess-field hire-assess__grid-full">
                <span>Instructions</span>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="What the candidate should know before starting"
                />
              </label>
            </div>
          </section>

          <section className="hire-assess__card" aria-labelledby="assess-settings-heading">
            <h2 id="assess-settings-heading" className="hire-assess__card-title">
              Settings
            </h2>
            <div className="hire-assess__settings">
              {/* Every setting is a heading row (with its checkbox, if any)
                  above one control, so the columns line up. Checkboxes stay
                  out of .hire-assess-field, which styles inputs as text boxes. */}
              <div className="hire-assess-setting">
                <div className={SETTING_HEAD_CLASS}>
                  <label htmlFor="assess-duration" className={SETTING_LABEL_CLASS}>
                    Duration (minutes)
                  </label>
                  <label className="hire-assess-check">
                    <input
                      type="checkbox"
                      checked={untimed}
                      disabled={wordingOnly}
                      onChange={(e) => {
                        setUntimed(e.target.checked);
                        if (e.target.checked) setDurationMinutes(null);
                        else if (durationMinutes == null) setDurationMinutes(30);
                      }}
                    />
                    <span>Untimed</span>
                  </label>
                </div>
                <div className="hire-assess-field">
                  <input
                    id="assess-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={180}
                    step={1}
                    disabled={untimed || wordingOnly}
                    value={durationMinutes ?? ""}
                    placeholder={untimed ? "Untimed" : undefined}
                    onKeyDown={(e) => {
                      // Whole positive minutes only: no sign, decimal or exponent.
                      if (["-", "+", ".", ",", "e", "E"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      // Also covers paste and spinner/wheel input: strip
                      // anything but digits, reject 0, cap at the schema max.
                      const digits = e.target.value.replace(/\D/g, "");
                      const minutes = digits === "" ? 0 : parseInt(digits, 10);
                      setDurationMinutes(
                        minutes < 1 ? null : Math.min(minutes, MAX_DURATION_MINUTES),
                      );
                    }}
                  />
                </div>
              </div>
              <div className="hire-assess-setting">
                <div className={SETTING_HEAD_CLASS}>
                  <label htmlFor="assess-pass" className={SETTING_LABEL_CLASS}>
                    Pass percentage
                  </label>
                </div>
                <div className="hire-assess-field">
                  <input
                    id="assess-pass"
                    type="number"
                    min={0}
                    max={100}
                    value={passMarkPercent}
                    disabled={wordingOnly}
                    onChange={(e) =>
                      setPassMarkPercent(Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              <div className="hire-assess-setting">
                <div className={SETTING_HEAD_CLASS}>
                  <span className={SETTING_LABEL_CLASS}>Camera</span>
                </div>
                <label className="hire-assess-check" style={{ minHeight: 42 }}>
                  <input
                    type="checkbox"
                    checked={cameraRequired}
                    disabled={wordingOnly}
                    onChange={(e) => setCameraRequired(e.target.checked)}
                  />
                  <span>Require camera</span>
                </label>
              </div>
              {platform ? (
                <div className="hire-assess-setting" style={{ gridColumn: "span 2" }}>
                  <PlatformDeadlineField
                    value={deadlineLocal}
                    onChange={setDeadlineLocal}
                    noDeadline={noDeadline}
                    onNoDeadlineChange={setNoDeadline}
                    disabled={pending}
                    sent={sent !== null}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="hire-assess__questions" aria-labelledby="assess-questions-heading">
            <div className="hire-assess__questions-head">
              <h2 id="assess-questions-heading">
                Questions <span className="hire-assess__count">{questions.length}</span>
              </h2>
              {wordingOnly ? null : (
                <button
                  type="button"
                  className="hire-assess__addbtn"
                  onClick={() => setQuestions((q) => [...q, NEW_MCQ()])}
                >
                  <Plus aria-hidden="true" />
                  Add question
                </button>
              )}
            </div>
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.key}
                question={q}
                locked={q.locked ?? false}
                wordingOnly={wordingOnly}
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
            {wordingOnly ? null : (
              <button
                type="button"
                className="hire-assess__addrow"
                onClick={() => setQuestions((q) => [...q, NEW_MCQ()])}
              >
                <Plus aria-hidden="true" />
                Add another question
              </button>
            )}
            {fieldErrors.questions ? (
              <span className="hire-assess-error">{fieldErrors.questions}</span>
            ) : null}
          </section>

          {platform ? (
            <PlatformAudiencePicker
              options={platform.audienceOptions}
              audience={audience}
              onAudienceChange={setAudience}
              disabled={pending}
              lockedAudience={sent?.audience}
            />
          ) : (
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

              {candidates.length === 0 ? (
                <p className="hire-assess__send-empty">
                  Your Shortlist is empty. You can still publish this now, then
                  shortlist candidates on Hire and assign them from the
                  assessment&apos;s page.
                </p>
              ) : (
                <fieldset className="hire-assess-assign__fieldset" aria-busy={pending}>
                  <legend className="sr-only">Shortlisted candidates</legend>
                  <p className="hire-assess-hint">
                    Optional — tick who gets it now, or publish first and assign
                    candidates later from the assessment&apos;s page.
                  </p>
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
          )}

          <div className="hire-assess__save">
            {confirming ? (
              <div
                className="hire-assess-assign__confirm hire-assess__confirm"
                role="group"
                aria-label="Confirm create"
              >
                {sent ? (
                  <p>
                    Save changes and send to up to {addedCount.toLocaleString("en-IN")}{" "}
                    more candidate{addedCount === 1 ? "" : "s"}? Anyone who already
                    has it isn&apos;t sent a second copy.
                  </p>
                ) : platform ? (
                  <p>
                    Publish and send to up to {audienceCount.toLocaleString("en-IN")}{" "}
                    candidate{audienceCount === 1 ? "" : "s"}? It goes out now. You
                    can edit anything until someone starts, then only wording, the
                    deadline and groups.
                  </p>
                ) : sendsNow ? (
                  <p>
                    Publish and send to {pickedCount} candidate
                    {pickedCount === 1 ? "" : "s"}? Publishing locks the questions
                    and the pass mark, and each candidate is notified.
                  </p>
                ) : (
                  <p>
                    Publish without sending it to anyone yet? Publishing locks the
                    questions and the pass mark. You pick the candidates next, on
                    the assessment&apos;s page.
                  </p>
                )}
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
                    onClick={sent ? () => saveSent() : create}
                  >
                    {sent
                      ? pendingAction === "create"
                        ? "Saving…"
                        : "Save and send"
                      : pendingAction === "create"
                        ? creatingLabel
                        : createLabel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p id="assess-create-hint" className="hire-assess-hint hire-assess__save-hint">
                  {createBlockedReason ??
                    (sent
                      ? addsGroups
                        ? `Also sends it to up to ${addedCount.toLocaleString("en-IN")} more candidate${addedCount === 1 ? "" : "s"}.`
                        : "Candidates see your changes the next time they open it."
                      : platform
                      ? `Sends to up to ${audienceCount.toLocaleString("en-IN")} candidate${audienceCount === 1 ? "" : "s"}.`
                      : sendsNow
                        ? `Publishes and sends to ${pickedCount} selected candidate${pickedCount === 1 ? "" : "s"}.`
                        : "Publishes without sending. You pick the candidates next, on the assessment's page.")}
                </p>
                {sent ? (
                  <div className="hire-assess__save-actions">
                    <button
                      type="button"
                      className="hire-assess__savebtn"
                      disabled={pending || Boolean(createBlockedReason)}
                      aria-describedby="assess-create-hint"
                      onClick={askSaveSent}
                    >
                      {pendingAction === "create" ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                ) : (
                  <div className="hire-assess__save-actions">
                    {showTemplateActions && template ? (
                      <button
                        type="button"
                        className="hire-assess-linkbtn"
                        disabled={pending}
                        onClick={updateTemplate}
                      >
                        {pendingAction === "template" && !templateDialogOpen
                          ? "Updating…"
                          : "Update template"}
                      </button>
                    ) : null}
                    {showTemplateActions ? (
                      <button
                        type="button"
                        className="hire-assess-linkbtn"
                        disabled={pending}
                        onClick={askSaveTemplate}
                      >
                        {template ? "Save as new template" : "Save as template"}
                      </button>
                    ) : null}
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
                      {createLabel}
                    </button>
                  </div>
                )}
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="hire-assess-preview-modal max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] gap-3 p-5 sm:max-w-[min(880px,calc(100%-4rem))]">
          <DialogHeader>
            <DialogTitle>Candidate preview</DialogTitle>
            <DialogDescription>
              What candidates see when they open this assessment. Read-only.
            </DialogDescription>
          </DialogHeader>
          <div className="hire-assess-preview-modal__body">
            {previewOpen ? (
              <CandidateAssessmentScreen draft={previewDraft} readOnly />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan 185: an import never overwrites typed content without asking. */}
      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Replace what is in the builder?</DialogTitle>
            <DialogDescription>
              Importing replaces the title, settings and all{" "}
              {questions.length} question{questions.length === 1 ? "" : "s"}{" "}
              here with the {pendingImport?.questions.length ?? 0} in the file.
              Nothing is saved until you save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              onClick={() => setPendingImport(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }))}
              onClick={() => pendingImport && applyImport(pendingImport)}
            >
              Replace
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan 185: recruiter only. `showTemplateActions` is what opens it. */}
      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => !pending && setTemplateDialogOpen(open)}
      >
        <DialogContent className="hire-app sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Saves the questions and settings in the builder to My templates.
              Only you can see or use it. Candidates and your Shortlist are not
              part of a template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="assess-template-name">Template name</Label>
              <Input
                id="assess-template-name"
                value={templateName}
                maxLength={120}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Backend screen, round 1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assess-template-description">
                Description (optional)
              </Label>
              <Textarea
                id="assess-template-description"
                rows={2}
                value={templateDescription}
                maxLength={300}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="What this template is for"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }))}
              disabled={pending}
              onClick={() => setTemplateDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }))}
              disabled={pending || templateName.trim() === ""}
              onClick={saveTemplate}
            >
              {pendingAction === "template" ? "Saving…" : "Save template"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
