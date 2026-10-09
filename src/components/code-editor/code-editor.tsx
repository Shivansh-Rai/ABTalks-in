"use client";

import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import type { CodeLanguageId } from "@/features/code-runner/languages";

const EXTENSIONS = {
  python: [python()],
  java: [java()],
  cpp: [cpp()],
  javascript: [javascript()],
} satisfies Record<CodeLanguageId, unknown[]>;

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: CodeLanguageId;
  readOnly?: boolean;
  /** Any CSS height. Defaults to filling the parent. */
  height?: string;
  ariaLabel?: string;
};

/**
 * The code editor itself. Knows nothing about questions, tests or storage.
 * Load it with `next/dynamic` and `ssr: false`; CodeMirror needs the browser.
 */
export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = "100%",
  ariaLabel = "Code editor",
}: CodeEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={EXTENSIONS[language]}
      editable={!readOnly}
      readOnly={readOnly}
      height={height}
      theme="light"
      aria-label={ariaLabel}
      className="h-full font-mono text-sm [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono"
      basicSetup={{ tabSize: 4, foldGutter: false }}
    />
  );
}
