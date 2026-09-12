"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JobType, JobWorkMode } from "@prisma/client";
import {
  createRecruiterJobAction,
  updateRecruiterJobAction,
} from "@/app/actions/recruiter-job-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Initial = {
  jobId?: string;
  title: string;
  description: string;
  location: string;
  workMode: JobWorkMode;
  type: JobType;
  skills: string[];
  applyExternalUrl: string;
};

const DEFAULT_INITIAL: Initial = {
  title: "",
  description: "",
  location: "",
  workMode: "REMOTE",
  type: "FULL_TIME",
  skills: [],
  applyExternalUrl: "",
};

type Props = {
  initial?: Partial<Initial>;
  jobId?: string;
};

export function JobFormClient({ initial, jobId }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Initial>({
    ...DEFAULT_INITIAL,
    ...initial,
  });
  const [skillsInput, setSkillsInput] = useState<string>(
    (initial?.skills ?? []).join(", "),
  );
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit() {
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: values.title,
      description: values.description,
      location: values.location,
      workMode: values.workMode,
      opportunityType: values.type,
      skills,
      applyExternalUrl: values.applyExternalUrl,
    };

    startTransition(async () => {
      if (jobId) {
        const res = await updateRecruiterJobAction({ ...payload, jobId });
        if (res.ok) {
          toast.success("Job updated");
          router.refresh();
          return;
        }
        toast.error(res.message);
        return;
      }
      const res = await createRecruiterJobAction(payload);
      if (res.ok) {
        toast.success("Draft saved");
        router.push(`/hire/jobs/${res.data.id}`);
        return;
      }
      toast.error(res.message);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="job-title">Title</Label>
        <Input
          id="job-title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Full-Stack Engineer, remote India"
          maxLength={200}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="job-location">Location</Label>
          <Input
            id="job-location"
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="City, country (optional)"
            maxLength={200}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="job-workmode">Work mode</Label>
          <select
            id="job-workmode"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={values.workMode}
            onChange={(e) => set("workMode", e.target.value as JobWorkMode)}
          >
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">On-site</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="job-type">Opportunity type</Label>
          <select
            id="job-type"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={values.type}
            onChange={(e) => set("type", e.target.value as JobType)}
          >
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="CONTRACT">Contract</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="job-apply-url">External apply URL (optional)</Label>
          <Input
            id="job-apply-url"
            type="url"
            value={values.applyExternalUrl}
            onChange={(e) => set("applyExternalUrl", e.target.value)}
            placeholder="https://…"
            maxLength={2048}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="job-skills">Skills (comma-separated)</Label>
        <Input
          id="job-skills"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="react, node, aws"
          maxLength={800}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="job-description">Description</Label>
        <Textarea
          id="job-description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What the role is, who it's for, what they'll build."
          className="min-h-[200px]"
          maxLength={20000}
        />
      </div>

      <div className="flex gap-3">
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : jobId ? "Save changes" : "Save as draft"}
        </Button>
      </div>
    </div>
  );
}
