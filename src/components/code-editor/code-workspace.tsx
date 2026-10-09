"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Loader2, Play, RotateCcw, Send } from "lucide-react";
import type {
  CodeLanguageId,
  TestRunResult,
} from "@/features/code-runner/languages";
import { cn } from "@/lib/utils";
import { TestResults } from "./test-results";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[240px] animate-pulse bg-[#F4F4F4]" />
  ),
});

export type RunOutcome =
  | { ok: true; data: TestRunResult }
  | { ok: false; message: string };

/**
 * What a Submit came back with. `result` is null when nothing was run (for
 * example the question was already solved). `note` is shown above the results.
 */
export type SubmitOutcome =
  | {
      ok: true;
      data: { result: TestRunResult | null; note: string; solved: boolean };
    }
  | { ok: false; message: string };

/** One saved submission, ready to show. Plain data from the caller. */
export type WorkspaceSubmission = {
  languageLabel: string;
  submittedAtLabel: string;
  code: string;
};

type CodeInput = { language: CodeLanguageId; code: string };

type CodeWorkspaceProps = {
  /** The problem statement, rendered by the caller (usually on the server). */
  statement: React.ReactNode;
  languages: { id: CodeLanguageId; label: string }[];
  starterCode: Partial<Record<CodeLanguageId, string>>;
  defaultLanguage: CodeLanguageId;
  /** Namespaces the per-language drafts kept in this browser. */
  storageKey: string;
  initialCode?: CodeInput | null;
  onRun: (input: CodeInput) => Promise<RunOutcome>;
  /** Omit to hide Submit entirely. */
  onSubmit?: (input: CodeInput) => Promise<SubmitOutcome>;
  /** True when the caller already knows this question is solved. */
  solved?: boolean;
  /** Pass to show the Submissions tab. Omit to hide it. */
  submissions?: WorkspaceSubmission[];
};

type MobileTab = "problem" | "code" | "result";

type RunState =
  | { kind: "idle" }
  | { kind: "running"; action: "run" | "submit" }
  | {
      kind: "done";
      scope: "sample" | "all";
      result: TestRunResult | null;
      note: string | null;
    }
  | { kind: "error"; message: string };

const DRAFT_SAVE_DELAY_MS = 500;

function draftKey(storageKey: string, language: CodeLanguageId): string {
  return `abt:code:${storageKey}:${language}`;
}

function readDraft(storageKey: string, language: CodeLanguageId): string | null {
  try {
    return window.localStorage.getItem(draftKey(storageKey, language));
  } catch {
    return null;
  }
}

function writeDraft(storageKey: string, language: CodeLanguageId, code: string) {
  try {
    window.localStorage.setItem(draftKey(storageKey, language), code);
  } catch {
    // Private mode or a full quota: the draft simply is not kept.
  }
}

function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * Statement beside a code editor with Run and a result panel.
 *
 * Reusable: it has no idea where the question, the tests or the runner live.
 * The caller supplies `onRun`. Drafts stay in this browser and nowhere else.
 */
export function CodeWorkspace({
  statement,
  languages,
  starterCode,
  defaultLanguage,
  storageKey,
  initialCode = null,
  onRun,
  onSubmit,
  solved = false,
  submissions,
}: CodeWorkspaceProps) {
  const [language, setLanguage] = useState<CodeLanguageId>(
    initialCode?.language ?? defaultLanguage,
  );
  // What the learner has typed in this visit, per language.
  const [edits, setEdits] = useState<Partial<Record<CodeLanguageId, string>>>(
    {},
  );
  const [run, setRun] = useState<RunState>({ kind: "idle" });
  const [tab, setTab] = useState<MobileTab>("problem");
  const [panel, setPanel] = useState<"result" | "submissions">("result");
  // Set the moment a Submit is accepted, before the caller's data catches up.
  const [solvedNow, setSolvedNow] = useState(false);
  const isSolved = solved || solvedNow;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fallbackFor = (lang: CodeLanguageId) =>
    initialCode?.language === lang ? initialCode.code : (starterCode[lang] ?? "");

  // A draft saved in this browser wins over the starter code. Read through
  // useSyncExternalStore so the server render (no storage) and the first
  // client render agree.
  const storedDraft = useSyncExternalStore(
    subscribeToNothing,
    () => readDraft(storageKey, language),
    () => null,
  );
  const code = edits[language] ?? storedDraft ?? fallbackFor(language);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  function editCode(next: string) {
    setEdits((current) => ({ ...current, [language]: next }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => writeDraft(storageKey, language, next),
      DRAFT_SAVE_DELAY_MS,
    );
  }

  function changeLanguage(next: CodeLanguageId) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    writeDraft(storageKey, language, code);
    setLanguage(next);
  }

  function resetCode() {
    if (!window.confirm("Reset your code to the starting template?")) return;
    const starter = starterCode[language] ?? "";
    setEdits((current) => ({ ...current, [language]: starter }));
    writeDraft(storageKey, language, starter);
  }

  async function runCode() {
    if (run.kind === "running") return;
    setRun({ kind: "running", action: "run" });
    setTab("result");
    setPanel("result");
    const outcome = await onRun({ language, code });
    setRun(
      outcome.ok
        ? { kind: "done", scope: "sample", result: outcome.data, note: null }
        : { kind: "error", message: outcome.message },
    );
  }

  async function submitCode() {
    if (!onSubmit || run.kind === "running") return;
    setRun({ kind: "running", action: "submit" });
    setTab("result");
    setPanel("result");
    const outcome = await onSubmit({ language, code });
    if (!outcome.ok) {
      setRun({ kind: "error", message: outcome.message });
      return;
    }
    if (outcome.data.solved) setSolvedNow(true);
    setRun({
      kind: "done",
      scope: "all",
      result: outcome.data.result,
      note: outcome.data.note,
    });
  }

  const running = run.kind === "running";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="tablist"
        aria-label="Workspace sections"
        className="flex gap-1 rounded-xl border border-[#E0E0E0] bg-white p-1 lg:hidden"
      >
        {(
          [
            ["problem", "Problem"],
            ["code", "Code"],
            ["result", "Result"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "h-9 flex-1 rounded-lg text-sm font-medium transition-colors",
              tab === id
                ? "bg-[#E7F2F3] text-[#03535F]"
                : "text-[#4B4B4B] hover:text-[#03535F]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-label="Problem"
          className={cn(
            "min-h-0 overflow-y-auto rounded-2xl border border-[#E0E0E0] bg-white p-5",
            tab === "problem" ? "block" : "hidden lg:block",
          )}
        >
          {statement}
        </section>

        <div
          className={cn(
            "min-h-0 flex-col gap-4",
            tab === "problem" ? "hidden lg:flex" : "flex",
          )}
        >
          <section
            aria-label="Code"
            className={cn(
              "min-h-0 flex-[3] flex-col overflow-hidden rounded-2xl border border-[#E0E0E0] bg-white",
              tab === "result" ? "hidden lg:flex" : "flex",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-[#E0E0E0] px-3 py-2">
              <label className="sr-only" htmlFor={`${storageKey}-language`}>
                Language
              </label>
              <select
                id={`${storageKey}-language`}
                value={language}
                onChange={(e) => changeLanguage(e.target.value as CodeLanguageId)}
                disabled={running}
                className="h-9 rounded-lg border border-[#E0E0E0] bg-white px-2 text-sm font-medium text-black focus-visible:outline-2 focus-visible:outline-[#03535F]"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={resetCode}
                disabled={running}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#4B4B4B] hover:text-[#03535F] disabled:opacity-50"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </button>
              <button
                type="button"
                onClick={runCode}
                disabled={running || code.trim().length === 0}
                className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 text-sm font-semibold text-black transition-colors hover:border-[#03535F] hover:text-[#03535F] disabled:opacity-60"
              >
                {run.kind === "running" && run.action === "run" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {run.kind === "running" && run.action === "run"
                  ? "Running..."
                  : "Run"}
              </button>
              {onSubmit && isSolved ? (
                <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Solved
                </span>
              ) : null}
              {onSubmit && !isSolved ? (
                <button
                  type="button"
                  onClick={submitCode}
                  disabled={running || code.trim().length === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#03535F] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#076573] disabled:opacity-60"
                >
                  {run.kind === "running" && run.action === "submit" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {run.kind === "running" && run.action === "submit"
                    ? "Submitting..."
                    : "Submit"}
                </button>
              ) : null}
            </div>
            <div className="h-[55svh] min-h-[280px] lg:h-auto lg:min-h-0 lg:flex-1">
              <CodeEditor
                value={code}
                onChange={editCode}
                language={language}
                readOnly={running}
              />
            </div>
          </section>

          <section
            aria-label="Result"
            aria-live="polite"
            className={cn(
              "min-h-[160px] flex-[2] overflow-y-auto rounded-2xl border border-[#E0E0E0] bg-white p-4",
              tab === "code" ? "hidden lg:block" : "block",
            )}
          >
            <div className="mb-3 flex gap-1">
              <PanelTab
                label="Result"
                active={panel === "result"}
                onClick={() => setPanel("result")}
              />
              {submissions ? (
                <PanelTab
                  label="Submissions"
                  active={panel === "submissions"}
                  onClick={() => setPanel("submissions")}
                />
              ) : null}
            </div>

            {panel === "submissions" && submissions ? (
              <SubmissionList submissions={submissions} />
            ) : (
              <>
                {run.kind === "idle" ? (
                  <p className="text-sm text-[#6B7280]">
                    Run your code to see the result of the sample tests here.
                  </p>
                ) : null}
                {run.kind === "running" ? (
                  <p className="flex items-center gap-2 text-sm text-[#4B4B4B]">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {run.action === "submit"
                      ? "Checking your solution against all tests..."
                      : "Running your code..."}
                  </p>
                ) : null}
                {run.kind === "error" ? (
                  <p role="alert" className="text-sm text-red-700">
                    {run.message}
                  </p>
                ) : null}
                {run.kind === "done" ? (
                  <div className="space-y-3">
                    {run.note ? (
                      <p className="text-sm font-medium text-black">{run.note}</p>
                    ) : null}
                    {run.result ? (
                      <TestResults result={run.result} scope={run.scope} />
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PanelTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-[#E7F2F3] text-[#03535F]"
          : "text-[#4B4B4B] hover:text-[#03535F]",
      )}
    >
      {label}
    </button>
  );
}

function SubmissionList({
  submissions,
}: {
  submissions: WorkspaceSubmission[];
}) {
  if (submissions.length === 0) {
    return (
      <p className="text-sm text-[#6B7280]">
        No accepted submission yet. Only accepted solutions are saved.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {submissions.map((s, i) => (
        <li key={i} className="rounded-xl border border-[#E0E0E0]">
          <p className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Accepted
            </span>
            <span className="text-xs text-[#6B7280]">
              {s.languageLabel} · {s.submittedAtLabel}
            </span>
          </p>
          <pre className="max-h-64 overflow-auto border-t border-[#E0E0E0] bg-[#F4F4F4] px-3 py-2 font-mono text-xs text-[#111111]">
            {s.code}
          </pre>
        </li>
      ))}
    </ul>
  );
}
