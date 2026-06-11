"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  publishRecruiterProfileAction,
  regenerateShareTokenAction,
  unpublishRecruiterProfileAction,
  upsertRecruiterReviewAction,
} from "@/app/actions/recruiter-review-actions";
import { cn } from "@/lib/utils";
import type { Education, Project } from "@/lib/validations/recruiter";

type ReviewData = {
  confidenceRating: number | null;
  codingRating: number | null;
  communicationRating: number | null;
  headline: string;
  summary: string;
  strengths: string[];
  recommendedRoles: string[];
  projects: Project[];
  education: Education[];
  achievements: string[];
  certifications: string[];
  adminNote: string;
  isPublished: boolean;
  shareToken: string | null;
};

type Props = {
  studentId: string;
  studentName: string;
  review: ReviewData;
};

const RATING_LABELS = [
  { key: "confidenceRating" as const, label: "Confidence" },
  { key: "codingRating" as const, label: "Coding skills" },
  { key: "communicationRating" as const, label: "Communication" },
];

function RatingSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md border text-sm font-medium transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted",
            )}
            aria-label={`${label}: ${n} of 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagInput({
  label,
  tags,
  onChange,
  placeholder,
  maxTags = 10,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  maxTags?: number;
}) {
  const [draft, setDraft] = useState("");

  const addFromDraft = useCallback(() => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) {
      if (next.length >= maxTags) break;
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setDraft("");
  }, [draft, tags, onChange, maxTags]);

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button
              type="button"
              className="rounded p-0.5 hover:bg-muted-foreground/20"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromDraft();
            }
          }}
          disabled={tags.length >= maxTags}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addFromDraft}
          disabled={tags.length >= maxTags}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function ProjectsEditor({
  projects,
  onChange,
}: {
  projects: Project[];
  onChange: (projects: Project[]) => void;
}) {
  function updateProject(index: number, patch: Partial<Project>) {
    onChange(projects.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removeProject(index: number) {
    onChange(projects.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <Label>Projects</Label>
      {projects.map((project, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Project {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeProject(index)}
            >
              Remove
            </Button>
          </div>
          <Input
            placeholder="Title"
            value={project.title}
            onChange={(e) => updateProject(index, { title: e.target.value })}
          />
          <Textarea
            placeholder="Description"
            value={project.description}
            rows={2}
            onChange={(e) =>
              updateProject(index, { description: e.target.value })
            }
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={projects.length >= 8}
        onClick={() =>
          onChange([...projects, { title: "", description: "" }])
        }
      >
        Add project
      </Button>
    </div>
  );
}

function EducationEditor({
  education,
  onChange,
}: {
  education: Education[];
  onChange: (education: Education[]) => void;
}) {
  function updateRow(index: number, patch: Partial<Education>) {
    onChange(education.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(education.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <Label>Education & marks</Label>
      {education.map((row, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Education {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeRow(index)}
            >
              Remove
            </Button>
          </div>
          <Input
            placeholder="Degree"
            value={row.degree}
            onChange={(e) => updateRow(index, { degree: e.target.value })}
          />
          <Input
            placeholder="Institution"
            value={row.institution}
            onChange={(e) => updateRow(index, { institution: e.target.value })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Year (e.g. 2025 or 2021–2025)"
              value={row.year}
              onChange={(e) => updateRow(index, { year: e.target.value })}
            />
            <Input
              placeholder="Score (e.g. 8.4 CGPA or 82%)"
              value={row.score}
              onChange={(e) => updateRow(index, { score: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={education.length >= 6}
        onClick={() =>
          onChange([
            ...education,
            { degree: "", institution: "", year: "", score: "" },
          ])
        }
      >
        Add education
      </Button>
    </div>
  );
}

export function RecruiterReviewPanel({ studentId, studentName, review }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [confidenceRating, setConfidenceRating] = useState(
    review.confidenceRating,
  );
  const [codingRating, setCodingRating] = useState(review.codingRating);
  const [communicationRating, setCommunicationRating] = useState(
    review.communicationRating,
  );
  const [headline, setHeadline] = useState(review.headline);
  const [summary, setSummary] = useState(review.summary);
  const [strengths, setStrengths] = useState(review.strengths);
  const [recommendedRoles, setRecommendedRoles] = useState(
    review.recommendedRoles,
  );
  const [projects, setProjects] = useState(review.projects);
  const [education, setEducation] = useState(review.education);
  const [achievements, setAchievements] = useState(review.achievements);
  const [certifications, setCertifications] = useState(review.certifications);
  const [adminNote, setAdminNote] = useState(review.adminNote);
  const [isPublished, setIsPublished] = useState(review.isPublished);
  const [shareToken, setShareToken] = useState(review.shareToken);

  function handleSave() {
    startTransition(async () => {
      const result = await upsertRecruiterReviewAction({
        userId: studentId,
        confidenceRating,
        codingRating,
        communicationRating,
        headline: headline || undefined,
        summary: summary || undefined,
        adminNote: adminNote || undefined,
        strengths,
        recommendedRoles,
        projects: projects.filter((p) => p.title.trim()),
        education: education.filter((e) => e.degree.trim() && e.institution.trim()),
        achievements,
        certifications,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Recruiter review saved");
      router.refresh();
    });
  }

  function handlePublish() {
    startTransition(async () => {
      const result = await publishRecruiterProfileAction({ userId: studentId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setShareToken(result.data.shareToken);
      setIsPublished(true);
      toast.success("Recruiter profile published");
      router.refresh();
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishRecruiterProfileAction({ userId: studentId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setIsPublished(false);
      toast.success("Recruiter profile unpublished");
      router.refresh();
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateShareTokenAction({ userId: studentId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setShareToken(result.data.shareToken);
      toast.success("Share link regenerated");
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!shareToken) return;
    const url = `${window.location.origin}/r/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Rate and curate a recruiter-facing profile for {studentName}. Contact
        details are never shown on the shared page.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Ratings (1–5)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {RATING_LABELS.map(({ key, label }) => {
            const value =
              key === "confidenceRating"
                ? confidenceRating
                : key === "codingRating"
                  ? codingRating
                  : communicationRating;
            const setValue =
              key === "confidenceRating"
                ? setConfidenceRating
                : key === "codingRating"
                  ? setCodingRating
                  : setCommunicationRating;
            return (
              <RatingSelector
                key={key}
                label={label}
                value={value}
                onChange={setValue}
              />
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Curated content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Strong full-stack candidate with consistent delivery"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Brief overview for recruiters…"
            />
          </div>
          <TagInput
            label="Key strengths"
            tags={strengths}
            onChange={setStrengths}
            placeholder="Type strengths, comma-separated, then Add"
          />
          <TagInput
            label="Recommended roles"
            tags={recommendedRoles}
            onChange={setRecommendedRoles}
            placeholder="Type roles, comma-separated, then Add"
          />
          <ProjectsEditor projects={projects} onChange={setProjects} />
          <EducationEditor education={education} onChange={setEducation} />
          <TagInput
            label="Achievements"
            tags={achievements}
            onChange={setAchievements}
            placeholder="Type achievements, comma-separated, then Add"
            maxTags={12}
          />
          <TagInput
            label="Certifications"
            tags={certifications}
            onChange={setCertifications}
            placeholder="Type certifications, comma-separated, then Add"
            maxTags={12}
          />
          <div className="space-y-2">
            <Label htmlFor="adminNote">
              Private admin note — never shown to recruiters
            </Label>
            <Textarea
              id="adminNote"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
              placeholder="Internal notes only…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save review"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish & share</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPublished ? (
            <Button type="button" onClick={handlePublish} disabled={pending}>
              {pending ? "Publishing…" : "Publish recruiter profile"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  readOnly
                  value={
                    shareToken
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${shareToken}`
                      : ""
                  }
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopy}
                    disabled={!shareToken || pending}
                  >
                    <Copy className="mr-2 size-4" />
                    Copy
                  </Button>
                  {shareToken ? (
                    <Link
                      href={`/r/${shareToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Preview
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={pending}
                >
                  Regenerate link
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleUnpublish}
                  disabled={pending}
                >
                  Unpublish
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
