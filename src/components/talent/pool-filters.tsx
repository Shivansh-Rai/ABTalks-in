"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function PoolFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(formData: FormData) {
    const params = new URLSearchParams();
    const q = String(formData.get("q") ?? "").trim();
    const skills = String(formData.get("skills") ?? "").trim();
    const minYears = String(formData.get("minYears") ?? "").trim();
    const minScore = String(formData.get("minScore") ?? "").trim();

    if (q) params.set("q", q);
    if (skills) params.set("skills", skills);
    if (minYears) params.set("minYears", minYears);
    if (minScore) params.set("minScore", minScore);

    startTransition(() => {
      router.push(`/talent?${params.toString()}`);
    });
  }

  return (
    <form action={apply} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          placeholder="Name, company, role…"
          defaultValue={searchParams.get("q") ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="skills">Skills</Label>
        <Input
          id="skills"
          name="skills"
          placeholder="python, kafka"
          defaultValue={searchParams.get("skills") ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="minYears">Min years</Label>
        <Input
          id="minYears"
          name="minYears"
          type="number"
          min={0}
          defaultValue={searchParams.get("minYears") ?? ""}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="minScore">Min score</Label>
        <Input
          id="minScore"
          name="minScore"
          type="number"
          min={0}
          defaultValue={searchParams.get("minScore") ?? ""}
        />
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Filtering…" : "Apply filters"}
        </Button>
      </div>
    </form>
  );
}
