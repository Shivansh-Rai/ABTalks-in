"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { getStudentsForExport } from "@/app/actions/admin-export-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { downloadCSV, toCSV } from "@/lib/csv";
import type { StudentDomainCounts } from "@/features/admin/get-students";
import { cn } from "@/lib/utils";
import type { Domain } from "@prisma/client";

const domainOptions = ["ALL", "SE", "DS", "AI", "CLAUDE"] as const;
const statusOptions = ["ALL", "ACTIVE", "COMPLETED"] as const;
const sortOptions = [
  { value: "recent", label: "Recently joined" },
  { value: "days", label: "Days completed" },
  { value: "streak", label: "Current streak" },
  { value: "referrals", label: "Referrals" },
] as const;

export function StudentsFilters({
  domainCounts,
}: {
  domainCounts: StudentDomainCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isExporting, startExport] = useTransition();

  const currentDomain = useMemo(
    () => searchParams.get("domain") ?? "ALL",
    [searchParams],
  );
  const currentStatus = useMemo(
    () => searchParams.get("status") ?? "ALL",
    [searchParams],
  );
  const currentSort = useMemo(
    () => searchParams.get("sort") ?? "recent",
    [searchParams],
  );

  function pushWith(next: {
    q?: string;
    domain?: string;
    status?: string;
    sort?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q !== undefined) {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (next.domain !== undefined) {
      if (next.domain && next.domain !== "ALL") params.set("domain", next.domain);
      else params.delete("domain");
    }
    if (next.status !== undefined) {
      if (next.status && next.status !== "ALL") params.set("status", next.status);
      else params.delete("status");
    }
    if (next.sort !== undefined) {
      if (next.sort && next.sort !== "recent") params.set("sort", next.sort);
      else params.delete("sort");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function domainCountLabel(domain: (typeof domainOptions)[number]) {
    const count = domainCounts[domain];
    return count > 0 ? `${domain} (${count})` : domain;
  }

  function handleClearFilters() {
    pushWith({ domain: "ALL", status: "ALL", sort: "recent" });
  }

  function handleExport() {
    startExport(async () => {
      try {
        const domain =
          currentDomain === "ALL" ? "ALL" : (currentDomain as Domain);
        const data = await getStudentsForExport({
          domain,
          search: searchParams.get("q") ?? undefined,
        });

        if (data.length === 0) {
          toast.error("No students to export");
          return;
        }

        const csv = toCSV(data);
        const date = new Date().toISOString().split("T")[0];
        const filename = `abtalks-students-${currentDomain}-${date}.csv`;
        downloadCSV(filename, csv);
        toast.success(`Exported ${data.length} students`);
      } catch {
        toast.error("Export failed");
      }
    });
  }

  const activeFilterCount =
    (currentDomain !== "ALL" ? 1 : 0) +
    (currentStatus !== "ALL" ? 1 : 0) +
    (currentSort !== "recent" ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        className="flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          pushWith({ q: search });
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by full name or email"
          aria-label="Search students"
        />
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DropdownMenuTrigger
            type="button"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium transition-colors hover:bg-accent",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Filters</span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-primary hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Domain
                </p>
                <div className="flex flex-wrap gap-2">
                  {domainOptions.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => pushWith({ domain })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        currentDomain === domain
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {domainCountLabel(domain)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => pushWith({ status })}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        currentStatus === status
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sort / Time
                </p>
                <div className="flex flex-col gap-1">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pushWith({ sort: option.value })}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-left text-xs",
                        currentSort === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent hover:bg-accent",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setFiltersOpen(false)}
            >
              Apply
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
    </div>
  );
}
