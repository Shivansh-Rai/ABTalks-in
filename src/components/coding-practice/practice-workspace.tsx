"use client";

import {
  CodeWorkspace,
  type RunOutcome,
} from "@/components/code-editor/code-workspace";
import type { CodeLanguageId } from "@/features/code-runner/languages";

type PracticeWorkspaceProps = {
  challenge: string;
  day: number;
  slot: number;
  statement: React.ReactNode;
  languages: { id: CodeLanguageId; label: string }[];
  starterCode: Partial<Record<CodeLanguageId, string>>;
  defaultLanguage: CodeLanguageId;
};

/** Binds the practice Run route into the reusable workspace. */
export function PracticeWorkspace({
  challenge,
  day,
  slot,
  statement,
  languages,
  starterCode,
  defaultLanguage,
}: PracticeWorkspaceProps) {
  async function onRun(input: {
    language: CodeLanguageId;
    code: string;
  }): Promise<RunOutcome> {
    try {
      const response = await fetch("/api/practice/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge, day, slot, ...input }),
      });
      return (await response.json()) as RunOutcome;
    } catch {
      return {
        ok: false,
        message: "Could not reach the server. Check your connection and try again.",
      };
    }
  }

  return (
    <CodeWorkspace
      statement={statement}
      languages={languages}
      starterCode={starterCode}
      defaultLanguage={defaultLanguage}
      storageKey={`practice:${challenge}:${day}:${slot}`}
      onRun={onRun}
    />
  );
}
