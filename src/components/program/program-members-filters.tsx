"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const STATUSES = [
  "",
  "APPLIED",
  "WAITLISTED",
  "ENROLLED",
  "COMPLETED",
  "DROPPED",
] as const;

export function ProgramMembersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const q = String(formData.get("q") ?? "").trim();
    const status = String(formData.get("status") ?? "");
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    startTransition(() => {
      router.push(`/admin/program/members?${params.toString()}`);
    });
  }

  return (
    <form action={apply} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <div className="space-y-1">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          placeholder="Name, company, role"
          defaultValue={searchParams.get("q") ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={searchParams.get("status") ?? ""}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        Filter
      </Button>
    </form>
  );
}
