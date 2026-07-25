"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AdminActionFilterType } from "@/features/admin/get-admin-actions-feed";

const FILTER_OPTIONS: { value: AdminActionFilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "grant_synergy", label: "Grant synergy" },
  { value: "remark", label: "Remark" },
  { value: "reset_progress", label: "Reset progress" },
  { value: "other", label: "Other" },
];

type AdminOption = { id: string; name: string };

export function AdminActionsFilters({
  admins,
}: {
  admins: AdminOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentType = useMemo((): AdminActionFilterType => {
    const raw = searchParams.get("type");
    if (
      raw === "grant_synergy" ||
      raw === "remark" ||
      raw === "reset_progress" ||
      raw === "other"
    ) {
      return raw;
    }
    return "all";
  }, [searchParams]);

  const currentAdmin = searchParams.get("admin") ?? "all";

  const adminLabel = useMemo(() => {
    if (currentAdmin === "all") return "All admins";
    return (
      admins.find((admin) => admin.id === currentAdmin)?.name ?? "All admins"
    );
  }, [admins, currentAdmin]);

  function pushParams(next: { type?: AdminActionFilterType; admin?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.type !== undefined) {
      if (next.type === "all") params.delete("type");
      else params.set("type", next.type);
    }
    if (next.admin !== undefined) {
      if (next.admin === "all") params.delete("admin");
      else params.set("admin", next.admin);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pushParams({ type: opt.value })}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              currentType === opt.value
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <label className="shrink-0 text-sm text-muted-foreground">
          By Admin
        </label>
        <Select
          value={currentAdmin}
          onValueChange={(value) => {
            if (!value) return;
            pushParams({ admin: value });
          }}
        >
          <SelectTrigger className="w-full sm:w-[240px]">
            <span data-slot="select-value" className="flex flex-1 truncate text-left">
              {adminLabel}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All admins</SelectItem>
            {admins.map((admin) => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
