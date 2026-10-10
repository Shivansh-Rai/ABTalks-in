"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type {
  CaseResult,
  TestRunResult,
} from "@/features/code-runner/languages";
import { cn } from "@/lib/utils";

const CASE_LABEL: Record<CaseResult["status"], string> = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  runtime_error: "Runtime error",
  timeout: "Time limit exceeded",
  not_run: "Not run",
};

/**
 * "sample": a Run against the sample tests.
 * "all": a Submit that included hidden tests.
 * "custom": one run against the learner's own input, with nothing to compare.
 */
type Scope = "sample" | "all" | "custom";

function headline(result: TestRunResult, scope: Scope): string {
  if (result.verdict === "compile_error") return "Compilation error";
  if (scope === "custom") {
    if (result.verdict === "timeout") return "Time limit exceeded";
    if (result.verdict === "runtime_error") return "Runtime error";
    return "Finished";
  }
  if (scope === "all") {
    return result.verdict === "accepted"
      ? "Accepted"
      : `${result.passedCount} of ${result.total} tests passed`;
  }
  if (result.verdict === "accepted") return "All sample tests passed";
  return `${result.passedCount} of ${result.total} sample tests passed`;
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#6B7280]">{label}</p>
      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[#E0E0E0] bg-[#F4F4F4] px-3 py-2 font-mono text-xs text-[#111111]">
        {text.length > 0 ? text : " "}
      </pre>
    </div>
  );
}

/** Renders the outcome of one run. Pure display; no data access. */
export function TestResults({
  result,
  scope = "sample",
}: {
  result: TestRunResult;
  scope?: Scope;
}) {
  const ok =
    scope === "custom"
      ? result.verdict === "accepted" || result.verdict === "wrong_answer"
      : result.verdict === "accepted";
  const first = result.cases[0];

  return (
    <div className="space-y-3">
      <p
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          ok ? "text-emerald-700" : "text-red-700",
        )}
      >
        {ok ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <XCircle className="size-4" aria-hidden="true" />
        )}
        {headline(result, scope)}
      </p>

      {result.verdict === "compile_error" ? (
        <Block label="Compiler output" text={result.compileOutput ?? ""} />
      ) : scope === "custom" ? (
        first ? (
          <div className="space-y-2">
            <Block label="Your output" text={first.actualOutput ?? ""} />
            {first.stderr ? <Block label="Error" text={first.stderr} /> : null}
          </div>
        ) : null
      ) : (
        <ul className="space-y-2">
          {result.cases.map((c) => (
            <li
              key={c.index}
              className="rounded-xl border border-[#E0E0E0] bg-white"
            >
              {c.hidden ? (
                <CaseHeader c={c} />
              ) : (
                <details open={c.status !== "passed"}>
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <CaseHeader c={c} />
                  </summary>
                  <div className="space-y-2 border-t border-[#E0E0E0] px-3 py-3">
                    <Block label="Input" text={c.input ?? ""} />
                    <Block label="Expected" text={c.expectedOutput ?? ""} />
                    <Block label="Your output" text={c.actualOutput ?? ""} />
                    {c.stderr ? <Block label="Error" text={c.stderr} /> : null}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CaseHeader({ c }: { c: CaseResult }) {
  return (
    <span className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="font-medium text-black">
        Test Case {c.index + 1}
      </span>
      <span
        className={cn(
          "text-xs font-semibold",
          c.status === "passed"
            ? "text-emerald-700"
            : c.status === "not_run"
              ? "text-[#6B7280]"
              : "text-red-700",
        )}
      >
        {CASE_LABEL[c.status]}
      </span>
    </span>
  );
}
