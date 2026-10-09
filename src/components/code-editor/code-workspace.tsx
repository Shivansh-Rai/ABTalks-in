"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { Loader2, Play, RotateCcw } from "lucide-react";
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
};

type MobileTab = "problem" | "code" | "result";

type RunState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: TestRunResult }
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
    setRun({ kind: "running" });
    setTab("result");
    const outcome = await onRun({ language, code });
    setRun(
      outcome.ok
        ? { kind: "done", result: outcome.data }
        : { kind: "error", message: outcome.message },
    );
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
                {running ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {running ? "Running..." : "Run"}
              </button>
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
            <p className="mb-3 inline-block rounded-lg bg-[#E7F2F3] px-3 py-1 text-sm font-medium text-[#03535F]">
              Result
            </p>
            {run.kind === "idle" ? (
              <p className="text-sm text-[#6B7280]">
                Run your code to see the result of the sample tests here.
              </p>
            ) : null}
            {run.kind === "running" ? (
              <p className="flex items-center gap-2 text-sm text-[#4B4B4B]">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Running your code...
              </p>
            ) : null}
            {run.kind === "error" ? (
              <p role="alert" className="text-sm text-red-700">
                {run.message}
              </p>
            ) : null}
            {run.kind === "done" ? <TestResults result={run.result} /> : null}
          </section>
        </div>
      </div>
    </div>
  );
}
