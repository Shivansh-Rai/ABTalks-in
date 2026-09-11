"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  saveAssessmentAnswerAction,
  startAssessmentAttemptAction,
  submitAssessmentAttemptAction,
} from "@/app/actions/assessment-attempt-actions";
import { CandidateAssessmentScreen } from "@/components/hire/assessment/candidate-assessment-screen";
import type {
  CandidateAnswer,
  CandidateAssessmentView,
} from "@/components/hire/assessment/assessment-types";
import {
  MAX_PARAGRAPH_WORDS,
  countWords,
  incompleteMessage,
  isAnswerComplete,
  isHttpUrl,
} from "@/lib/validations/assessment";

/**
 * T-218 (plan 129) — a candidate taking an assessment.
 *
 * Owns persistence; `CandidateAssessmentScreen` owns what the candidate sees.
 * Every change goes to the server (board regression guard: answers must never
 * live only in React state or localStorage). Nothing here touches
 * localStorage or sessionStorage.
 */

type AttemptStatus = "ASSIGNED" | "STARTED" | "SUBMITTED";
type Stage = "instructions" | "taking" | "submitted";
type SaveState = "idle" | "saving" | "saved" | "retrying";

type AssessmentAttemptProps = {
  assignmentId: string;
  status: AttemptStatus;
  submittedAtLabel: string | null;
  view: CandidateAssessmentView;
  initialAnswers: Record<string, CandidateAnswer>;
};

/** Typing pause before a paragraph or link is sent. Choices go immediately. */
const DEBOUNCE_MS = 800;
const RETRY_DELAYS_MS = [2000, 5000, 10000];

function stageFor(status: AttemptStatus): Stage {
  if (status === "ASSIGNED") return "instructions";
  if (status === "STARTED") return "taking";
  return "submitted";
}

function clockTime(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function withoutKey(
  record: Record<string, string>,
  key: string,
): Record<string, string> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function AssessmentAttempt({
  assignmentId,
  status,
  submittedAtLabel,
  view,
  initialAnswers,
}: AssessmentAttemptProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(() => stageFor(status));
  const [seenStatus, setSeenStatus] = useState(status);
  const [answers, setAnswers] =
    useState<Record<string, CandidateAnswer>>(initialAnswers);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  // Reopening an attempt shows what the server already holds, so it is saved.
  const [saveState, setSaveState] = useState<SaveState>(() =>
    Object.keys(initialAnswers).length > 0 ? "saved" : "idle",
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();

  // A refresh that finds the attempt moved on (started, or submitted here or on
  // another device) moves the screen with it. On SUBMITTED it also shows the
  // answers the server holds, which are the ones that were submitted.
  if (status !== seenStatus) {
    setSeenStatus(status);
    setStage(stageFor(status));
    if (status === "SUBMITTED") setAnswers(initialAnswers);
  }

  // The autosave queue. Refs: they change without re-rendering, and one save
  // in flight per tab keeps this tab's writes in the order they were made.
  /** Ready to send, latest value per question. */
  const pendingRef = useRef(new Map<string, CandidateAnswer>());
  /** Waiting for typing to pause. */
  const debouncedRef = useRef(new Map<string, CandidateAnswer>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);
  const retryCountRef = useRef(0);
  /** Questions whose last save was refused as invalid. */
  const erroredRef = useRef(new Set<string>());
  const waitersRef = useRef<((drained: boolean) => void)[]>([]);

  const settle = useCallback((drained: boolean) => {
    const waiters = waitersRef.current.splice(0);
    for (const resolve of waiters) resolve(drained);
  }, []);

  /** The attempt is closed (submitted, or gone): nothing more is sent. */
  const stopAutosave = useCallback(() => {
    stoppedRef.current = true;
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
    debouncedRef.current.clear();
    pendingRef.current.clear();
    settle(false);
  }, [settle]);

  const flush = useCallback(async () => {
    if (inFlightRef.current || stoppedRef.current) return;
    inFlightRef.current = true;
    try {
      while (pendingRef.current.size > 0 && !stoppedRef.current) {
        const next = pendingRef.current.entries().next();
        if (next.done) break;
        const [questionId, answer] = next.value;
        pendingRef.current.delete(questionId);
        setSaveState("saving");

        let res: Awaited<ReturnType<typeof saveAssessmentAnswerAction>>;
        try {
          res = await saveAssessmentAnswerAction({ assignmentId, questionId, answer });
        } catch {
          // Offline or the server is down. Keep the value unless a newer one
          // is already queued for the question, and try again shortly.
          if (!pendingRef.current.has(questionId)) {
            pendingRef.current.set(questionId, answer);
          }
          setSaveState("retrying");
          setRetryNonce((n) => n + 1);
          settle(false);
          return;
        }

        if (res.ok) {
          retryCountRef.current = 0;
          if (erroredRef.current.delete(questionId)) {
            setQuestionErrors((prev) => withoutKey(prev, questionId));
          }
          continue;
        }
        if (res.status === 409) {
          // Submitted from another tab or device.
          stopAutosave();
          setStage("submitted");
          toast("This assessment was already submitted.");
          router.refresh();
          return;
        }
        if (res.status === 404 || res.status === 401) {
          stopAutosave();
          toast.error(res.message);
          router.refresh();
          return;
        }
        // Refused as invalid: say so under the question and don't retry it.
        const message = res.message;
        erroredRef.current.add(questionId);
        setQuestionErrors((prev) => ({ ...prev, [questionId]: message }));
      }
      if (!stoppedRef.current) {
        setSaveState("saved");
        setSavedAt(clockTime());
        settle(true);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [assignmentId, router, settle, stopAutosave]);

  // Retry after a failed save, backing off 2s → 5s → every 10s.
  useEffect(() => {
    if (retryNonce === 0) return;
    const delay =
      RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
    retryCountRef.current += 1;
    const timer = setTimeout(() => void flush(), delay);
    return () => clearTimeout(timer);
  }, [retryNonce, flush]);

  // Closing the tab with a save still pending asks first.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (
        pendingRef.current.size > 0 ||
        debouncedRef.current.size > 0 ||
        inFlightRef.current
      ) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Leaving by an in-app link mid-typing: send what is still queued rather
  // than drop the last few words. The Maps are created once, so these are the
  // same instances the queue writes to.
  useEffect(() => {
    const timers = timersRef.current;
    const debounced = debouncedRef.current;
    const pending = pendingRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      const leftovers = [...pending, ...debounced];
      pending.clear();
      debounced.clear();
      if (leftovers.length === 0) return;
      void (async () => {
        for (const [questionId, answer] of leftovers) {
          try {
            await saveAssessmentAnswerAction({ assignmentId, questionId, answer });
          } catch {
            // Nothing left to show an error on; beforeunload covers hard closes.
          }
        }
      })();
    };
  }, [assignmentId]);

  function handleAnswerChange(questionId: string, answer: CandidateAnswer) {
    if (stage !== "taking") return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (erroredRef.current.delete(questionId)) {
      setQuestionErrors((prev) => withoutKey(prev, questionId));
    }
    if (stoppedRef.current) return;

    const existing = timersRef.current.get(questionId);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(questionId);
    }
    debouncedRef.current.delete(questionId);

    if (answer.kind === "choice") {
      pendingRef.current.set(questionId, answer);
      void flush();
      return;
    }

    let toSend: CandidateAnswer = answer;
    if (answer.kind === "file") {
      const trimmed = answer.fileUrl.trim();
      // Only a real link (or clearing it) is stored; the screen shows the hint.
      if (trimmed !== "" && !isHttpUrl(trimmed)) return;
      toSend = { kind: "file", fileUrl: trimmed };
    }

    setSaveState("saving");
    debouncedRef.current.set(questionId, toSend);
    timersRef.current.set(
      questionId,
      setTimeout(() => {
        timersRef.current.delete(questionId);
        const latest = debouncedRef.current.get(questionId);
        if (!latest) return;
        debouncedRef.current.delete(questionId);
        pendingRef.current.set(questionId, latest);
        void flush();
      }, DEBOUNCE_MS),
    );
  }

  /** Send everything now and resolve once it is stored (true) or not (false). */
  function waitForIdle(): Promise<boolean> {
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
    for (const [questionId, answer] of debouncedRef.current) {
      pendingRef.current.set(questionId, answer);
    }
    debouncedRef.current.clear();
    if (stoppedRef.current) return Promise.resolve(false);
    if (!inFlightRef.current && pendingRef.current.size === 0) {
      return Promise.resolve(true);
    }
    const done = new Promise<boolean>((resolve) => {
      waitersRef.current.push(resolve);
    });
    void flush();
    return done;
  }

  // Mirrors the server's submit check, in the same words (incompleteMessage).
  const blockedReason = useMemo(() => {
    let missing = 0;
    let over = 0;
    let badLink = false;
    view.questions.forEach((q, qi) => {
      const a = answers[q.id ?? String(qi)];
      if (q.isRequired && !isAnswerComplete(q.type, a)) missing++;
      if (
        q.type === "PARAGRAPH" &&
        a?.kind === "text" &&
        countWords(a.text) > (q.maxWords ?? MAX_PARAGRAPH_WORDS)
      ) {
        over++;
      }
      if (
        q.type === "FILE_UPLOAD" &&
        a?.kind === "file" &&
        a.fileUrl.trim() !== "" &&
        !isHttpUrl(a.fileUrl.trim())
      ) {
        badLink = true;
      }
    });
    if (missing > 0 || over > 0) return incompleteMessage(missing, over);
    if (badLink) return "Paste a full link starting with https:// before submitting.";
    if (Object.keys(questionErrors).length > 0) {
      return "Fix the highlighted answers before submitting.";
    }
    return null;
  }, [answers, questionErrors, view.questions]);

  function start() {
    startTransition(async () => {
      const res = await startAssessmentAttemptAction({ assignmentId });
      if (!res.ok) {
        toast.error(res.message);
        if (res.status === 409 || res.status === 404) router.refresh();
        return;
      }
      setStage("taking");
      router.refresh();
    });
  }

  function confirmSubmit() {
    if (blockedReason) {
      setConfirming(false);
      toast.error(blockedReason);
      return;
    }
    startTransition(async () => {
      const drained = await waitForIdle();
      if (!drained || erroredRef.current.size > 0) {
        setConfirming(false);
        toast.error(
          erroredRef.current.size > 0
            ? "Fix the highlighted answers before submitting."
            : "Some answers aren't saved yet — check your connection and try again.",
        );
        return;
      }
      const res = await submitAssessmentAttemptAction({ assignmentId });
      setConfirming(false);
      if (!res.ok) {
        if (res.status === 409) {
          stopAutosave();
          setStage("submitted");
          toast("This assessment was already submitted.");
          router.refresh();
          return;
        }
        toast.error(res.message);
        return;
      }
      stopAutosave();
      setStage("submitted");
      toast.success("Assessment submitted.");
      router.refresh();
    });
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "retrying"
        ? "Couldn't save — retrying…"
        : saveState === "saved"
          ? `All answers saved${savedAt ? ` · ${savedAt}` : ""}`
          : "Your answers save automatically";

  const statusSlot = (
    <p
      className="hire-cand-assess__status"
      data-state={saveState}
      role="status"
      aria-live="polite"
    >
      <span className="hire-cand-assess__status-dot" aria-hidden="true" />
      {saveLabel}
    </p>
  );

  return (
    <CandidateAssessmentScreen
      draft={view}
      readOnly={stage !== "taking" || busy}
      stage={stage}
      answers={answers}
      onAnswerChange={handleAnswerChange}
      questionErrors={questionErrors}
      statusSlot={statusSlot}
      onStart={start}
      onSubmit={() => setConfirming(true)}
      confirmingSubmit={confirming}
      onConfirmSubmit={confirmSubmit}
      onCancelSubmit={() => setConfirming(false)}
      submitBlockedReason={blockedReason}
      busy={busy}
      submittedAtLabel={submittedAtLabel}
    />
  );
}
