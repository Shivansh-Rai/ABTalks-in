"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  exportProgramAtRiskAction,
  exportProgramInterviewsAction,
  exportProgramMembersAction,
  exportProgramRecruitersAction,
} from "@/app/actions/admin-program-export-actions";
import { downloadCSV, toCSV } from "@/lib/csv";

export function ProgramExportButtons({ cohortId }: { cohortId: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function runExport(
    key: string,
    fn: () => Promise<{ ok: boolean; data?: Record<string, unknown>[]; message?: string }>,
    filename: string,
  ) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.ok || !res.data) {
        toast.error(res.message ?? "Export failed.");
        return;
      }
      downloadCSV(filename, toCSV(res.data));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!cohortId || busy !== null}
        onClick={() =>
          void runExport(
            "members",
            () => exportProgramMembersAction({ cohortId: cohortId! }),
            "program-members.csv",
          )
        }
      >
        Export members
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!cohortId || busy !== null}
        onClick={() =>
          void runExport(
            "atrisk",
            () => exportProgramAtRiskAction({ cohortId: cohortId! }),
            "program-at-risk.csv",
          )
        }
      >
        Export at-risk
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() =>
          void runExport(
            "recruiters",
            () => exportProgramRecruitersAction(),
            "program-recruiters.csv",
          )
        }
      >
        Export recruiters
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!cohortId || busy !== null}
        onClick={() =>
          void runExport(
            "interviews",
            () => exportProgramInterviewsAction({ cohortId: cohortId! }),
            "program-interviews.csv",
          )
        }
      >
        Export interviews
      </Button>
    </div>
  );
}
