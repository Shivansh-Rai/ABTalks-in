"use client";

import { useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getHackathonSubmissionsForExport } from "@/app/actions/admin-export-actions";
import { Button } from "@/components/ui/button";
import { downloadCSV, toCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type HackathonProblemOption = {
  id: string;
  title: string;
};

export function HackathonSubmissionsFilters({
  problems,
}: {
  problems: HackathonProblemOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isExporting, startExport] = useTransition();

  const currentProblem = useMemo(
    () => searchParams.get("problem") ?? "ALL",
    [searchParams],
  );

  function pushWith(problem: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "hackathon");
    if (problem && problem !== "ALL") params.set("problem", problem);
    else params.delete("problem");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleExport() {
    startExport(async () => {
      try {
        const data = await getHackathonSubmissionsForExport({
          problemId: currentProblem === "ALL" ? undefined : currentProblem,
        });

        if (data.length === 0) {
          toast.error("No hackathon submissions to export");
          return;
        }

        const csv = toCSV(data);
        const date = new Date().toISOString().split("T")[0];
        const filename = `abtalks-hackathon-submissions-${currentProblem}-${date}.csv`;
        downloadCSV(filename, csv);
        toast.success(`Exported ${data.length} submissions`);
      } catch {
        toast.error("Export failed");
      }
    });
  }

  return (
    <div className="sticky top-14 z-30 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:relative md:top-auto md:z-auto md:mx-0 md:rounded-xl md:border md:px-3 md:backdrop-blur-none">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pushWith("ALL")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              currentProblem === "ALL"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-accent",
            )}
          >
            ALL
          </button>
          {problems.map((problem) => (
            <button
              key={problem.id}
              type="button"
              onClick={() => pushWith(problem.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                currentProblem === problem.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              {problem.title}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
