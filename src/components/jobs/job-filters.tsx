"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { JobType, JobWorkMode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JobFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [location, setLocation] = useState(searchParams.get("location") ?? "");
  const [workMode, setWorkMode] = useState(searchParams.get("workMode") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [skills, setSkills] = useState(searchParams.get("skills") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (location.trim()) params.set("location", location.trim());
    if (workMode) params.set("workMode", workMode);
    if (type) params.set("type", type);
    if (skills.trim()) params.set("skills", skills.trim());
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/jobs?${qs}` : "/jobs");
    });
  }

  function clear() {
    setLocation("");
    setWorkMode("");
    setType("");
    setSkills("");
    startTransition(() => router.push("/jobs"));
  }

  return (
    <div className="mt-6 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="grid gap-1">
          <Label htmlFor="filter-location" className="text-xs">
            Location
          </Label>
          <Input
            id="filter-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Any"
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filter-workmode" className="text-xs">
            Work mode
          </Label>
          <select
            id="filter-workmode"
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Any</option>
            <option value={JobWorkMode.REMOTE}>Remote</option>
            <option value={JobWorkMode.HYBRID}>Hybrid</option>
            <option value={JobWorkMode.ONSITE}>On-site</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filter-type" className="text-xs">
            Type
          </Label>
          <select
            id="filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Any</option>
            <option value={JobType.FULL_TIME}>Full-time</option>
            <option value={JobType.PART_TIME}>Part-time</option>
            <option value={JobType.INTERNSHIP}>Internship</option>
            <option value={JobType.CONTRACT}>Contract</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filter-skills" className="text-xs">
            Skills (comma-sep.)
          </Label>
          <Input
            id="filter-skills"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="react, node"
            className="h-9"
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={apply} disabled={pending}>
          Apply filters
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clear}
          disabled={pending}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
