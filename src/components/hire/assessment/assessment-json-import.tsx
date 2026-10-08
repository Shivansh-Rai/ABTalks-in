"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import type { AssessmentContent } from "@/lib/validations/assessment";
import {
  ASSESSMENT_IMPORT_FORMAT_FILENAME,
  ASSESSMENT_IMPORT_FORMAT_HREF,
  MAX_IMPORT_BYTES,
  parseAssessmentImport,
} from "@/lib/validations/assessment-import";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImportProblem = { message: string; issues: string[] };

/**
 * Plan 185 — "Import from JSON" and, beside it, the format to follow.
 *
 * The file is read here, in the browser, and never leaves it: a file that
 * passes is handed to `onImport` as assessment content for the builder's
 * state, and one that fails opens a dialog listing what to fix. Nothing is
 * saved either way. Shared by the recruiter and admin builders.
 */
export function AssessmentJsonImport({
  onImport,
  disabled = false,
}: {
  onImport: (content: AssessmentContent) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<ImportProblem | null>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again (after fixing it) fires a change.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      setProblem({ message: "This file is larger than 1 MB.", issues: [] });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setProblem({ message: "This file could not be read.", issues: [] });
      return;
    }

    const result = parseAssessmentImport(text);
    if (!result.ok) {
      setProblem({ message: result.message, issues: result.issues });
      return;
    }
    onImport(result.data);
  }

  return (
    <span className="hire-assess-import">
      <input
        ref={inputRef}
        type="file"
        accept=".json,.jsonc,application/json"
        hidden
        onChange={onFile}
      />
      <button
        type="button"
        className="hire-assess__addbtn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        Import from JSON
      </button>
      <a
        href={ASSESSMENT_IMPORT_FORMAT_HREF}
        download={ASSESSMENT_IMPORT_FORMAT_FILENAME}
        className="hire-assess-linkbtn"
      >
        <Download aria-hidden="true" />
        Download JSON format
      </a>

      <Dialog
        open={problem !== null}
        onOpenChange={(open) => !open && setProblem(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>This file could not be imported</DialogTitle>
            <DialogDescription>
              {problem?.message} Nothing in the builder was changed.
            </DialogDescription>
          </DialogHeader>
          {problem && problem.issues.length > 0 ? (
            <ul
              role="alert"
              className="max-h-64 list-disc space-y-1.5 overflow-y-auto pl-5 text-sm"
            >
              {problem.issues.map((issue) => (
                <li key={issue} className="break-words">
                  {issue}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <a
              href={ASSESSMENT_IMPORT_FORMAT_HREF}
              download={ASSESSMENT_IMPORT_FORMAT_FILENAME}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Download JSON format
            </a>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "default" }))}
              onClick={() => setProblem(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
