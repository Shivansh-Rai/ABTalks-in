"use client";

import { useRef } from "react";
import type { AssessmentContent } from "@/lib/validations/assessment";
import {
  AssessmentBuilder,
  type AssessmentBuilderHandle,
} from "./assessment-builder";
import { AssessmentJsonImport } from "./assessment-json-import";
import { AssessmentPresetPicker, type PresetSummary } from "./preset-picker";

type SendableCandidate = { candidateRef: string; label: string; jobRole: string };

/**
 * Plan 185 — the two halves of the /hire/create-test landing: the ABTalks
 * template picker and, under it, the blank builder.
 *
 * They are one component only so that "Import from JSON", which sits in the
 * picker's head beside "Start from blank", can fill the builder below it. The
 * builder owns its state and the confirm-before-replace rule; this just hands
 * it the parsed file and scrolls it into view.
 */
export function CreateTestLanding({
  presets,
  candidates,
  projectId,
}: {
  presets: PresetSummary[];
  candidates: SendableCandidate[];
  projectId: string | null;
}) {
  const builderRef = useRef<AssessmentBuilderHandle>(null);

  function importIntoBuilder(content: AssessmentContent) {
    builderRef.current?.importContent(content);
    document
      .getElementById("blank-assessment")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <AssessmentPresetPicker
        presets={presets}
        candidates={candidates}
        projectId={projectId}
        headActions={<AssessmentJsonImport onImport={importIntoBuilder} />}
      />
      <AssessmentBuilder
        ref={builderRef}
        candidates={candidates}
        existingDraft={null}
        presetLocked={false}
        projectId={projectId}
        embedded
        canSaveTemplate
      />
    </>
  );
}
