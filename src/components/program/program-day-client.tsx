"use client";

import { useState } from "react";
import type { CurriculumDay } from "@/features/program/progression";
import { DayShell } from "@/components/program/day-shell";
import { ConceptCheckDialog } from "@/components/program/concept-check-panel";

type ConceptStatus =
  | { status: "none" }
  | { status: "completed"; score: number; pointsAwarded: number };

export function ProgramDayClient({
  dayNumber,
  dayTitle,
  moduleNumber,
  moduleTitle,
  days,
  estimatedMin,
  missionPoints,
  conceptStatus,
  memberFullName,
  showConceptCheck,
  children,
}: {
  dayNumber: number;
  dayTitle: string;
  moduleNumber: number;
  moduleTitle: string;
  days: CurriculumDay[];
  estimatedMin: number;
  missionPoints: number;
  conceptStatus: ConceptStatus;
  memberFullName: string;
  showConceptCheck: boolean;
  children: React.ReactNode;
}) {
  const [conceptOpen, setConceptOpen] = useState(false);

  return (
    <>
      <DayShell
        dayNumber={dayNumber}
        dayTitle={dayTitle}
        moduleNumber={moduleNumber}
        moduleTitle={moduleTitle}
        days={days}
        estimatedMin={estimatedMin}
        missionPoints={missionPoints}
        onConceptCheckClick={
          showConceptCheck ? () => setConceptOpen(true) : undefined
        }
      >
        {children}
      </DayShell>

      {showConceptCheck && (
        <ConceptCheckDialog
          dayNumber={dayNumber}
          memberFullName={memberFullName}
          initialStatus={conceptStatus}
          open={conceptOpen}
          onOpenChange={setConceptOpen}
        />
      )}
    </>
  );
}
