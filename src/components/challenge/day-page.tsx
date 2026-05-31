"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Wrench,
  ListChecks,
  FileCode,
  Share2,
  FileOutput,
  Copy,
  Check,
  ExternalLink,
  Send,
  Clock,
  Award,
  Tag,
  PlayCircle,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  submitGithubStepAction,
  submitLinkedinStepAction,
} from "@/app/actions/submission-actions";

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  animationDelay?: number;
  extraClassName?: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  icon,
  iconBg,
  title,
  subtitle,
  defaultOpen = false,
  animationDelay = 0.1,
  extraClassName,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.4 }}
      className={cn(
        "rounded-2xl border bg-card overflow-hidden",
        extraClassName,
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-4 md:p-6 hover:bg-muted/30 transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`rounded-lg p-2 shrink-0 ${iconBg}`}>{icon}</div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-semibold text-base md:text-lg">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 md:px-6 md:pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export interface LearningBullet {
  label: string;
  text: string;
}

export interface DayContent {
  title: string;
  tagline: string;
  module: string;
  difficulty: string;
  estimatedMinutes: number;
  deliverableFormat: string;
  learning: {
    summary: string;
    bullets: LearningBullet[];
  };
  tool?: {
    name: string;
    type: string;
    description: string;
    setupTitle: string;
    setupSteps: string[];
    linkUrl: string;
    linkLabel: string;
  };
  task: {
    title: string;
    steps: string[];
    solutionVideoUrl?: string;
  };
  solutionVideoUrl?: string;
  resources?: string[];
  promptTemplate: string;
  engagement: {
    type: string;
    description: string;
    hashtag: string;
  };
  deliverable: {
    description: string;
    format: string;
  };
}

interface Props {
  dayNumber: number;
  content: DayContent;
  enrollmentId: string;
  /** Seeded from DailyTask.resources when passed by the parent page */
  resources?: string[];
  existingSubmission?: { githubUrl: string; linkedinUrl: string } | null;
}

export function DayPage({
  dayNumber,
  content,
  enrollmentId,
  resources: resourcesProp,
  existingSubmission,
}: Props) {
  const router = useRouter();
  const [linkedinUrl, setLinkedinUrl] = useState(
    existingSubmission?.linkedinUrl ?? "",
  );
  const [artifactUrl, setArtifactUrl] = useState(
    existingSubmission?.githubUrl ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const solutionVideoUrl =
    content.solutionVideoUrl ?? content.task.solutionVideoUrl;
  const resources = resourcesProp ?? content.resources ?? [];

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(content.promptTemplate);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      toast.error("Could not copy — select the text manually");
    }
  };

  const handleSubmit = async () => {
    if (!linkedinUrl.trim() || !artifactUrl.trim()) {
      toast.error("Both fields are required");
      return;
    }

    setSubmitting(true);
    try {
      const githubFd = new FormData();
      githubFd.append("githubUrl", artifactUrl.trim());
      githubFd.append("dayNumber", String(dayNumber));
      githubFd.append("enrollmentId", enrollmentId);

      const githubResult = await submitGithubStepAction(githubFd);
      if (!githubResult.ok) {
        toast.error(githubResult.message);
        setSubmitting(false);
        return;
      }

      const linkedinFd = new FormData();
      linkedinFd.append("githubUrl", githubResult.githubUrl);
      linkedinFd.append("linkedinUrl", linkedinUrl.trim());
      linkedinFd.append("dayNumber", String(dayNumber));
      linkedinFd.append("enrollmentId", enrollmentId);

      const result = await submitLinkedinStepAction(linkedinFd);

      if (result.ok) {
        toast.success(`Day ${dayNumber} submitted! 🔥`);
        router.push(
          `/dashboard?challenge=${encodeURIComponent(enrollmentId)}`,
        );
      } else {
        toast.error(result.message);
        setSubmitting(false);
      }
    } catch {
      toast.error("Submission failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{content.module}</span>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-display text-sm font-bold tracking-wider text-primary uppercase">
              Day {dayNumber}
            </span>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {content.title}
          </h1>
          <p className="text-base text-muted-foreground italic md:text-lg">
            {content.tagline}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Award className="h-3 w-3" />
              {content.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
              <Clock className="h-3 w-3" />
              {content.estimatedMinutes} min
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs">
              <FileOutput className="h-3 w-3" />
              Deliverable: {content.deliverableFormat}
            </span>
          </div>
        </motion.div>

        <CollapsibleSection
          icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-500/10"
          title="What You'll Learn"
          animationDelay={0.1}
        >
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {content.learning.summary}
          </p>

          <ol className="space-y-2.5">
            {content.learning.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {i + 1}
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-semibold">{bullet.label}:</span>
                  <span className="text-muted-foreground"> {bullet.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        {content.tool ? (
          <CollapsibleSection
            icon={<Wrench className="h-5 w-5 text-orange-500" />}
            iconBg="bg-orange-500/10"
            title="Tool of the Day"
            subtitle={content.tool.name}
            animationDelay={0.15}
            extraClassName="border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-pink-500/5"
          >
            <p className="mb-3 text-xs text-muted-foreground">
              {content.tool.type}
            </p>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              {content.tool.description}
            </p>

            <div className="mb-4 rounded-xl border bg-background/60 p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {content.tool.setupTitle}
              </h3>
              <ol className="space-y-2">
                {content.tool.setupSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm text-muted-foreground">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <a
              href={content.tool.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              {content.tool.linkLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          icon={<ListChecks className="h-5 w-5 text-emerald-500" />}
          iconBg="bg-emerald-500/10"
          title={content.task.title}
          animationDelay={0.2}
        >
          <ol className="space-y-3">
            {content.task.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {i + 1}
                </div>
                <span className="pt-0.5 text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        {solutionVideoUrl ? (
          <CollapsibleSection
            icon={<PlayCircle className="h-5 w-5 text-red-500" />}
            iconBg="bg-red-500/10"
            title="Solution Walkthrough"
            subtitle="Step-by-step video guide"
            animationDelay={0.22}
          >
            {solutionVideoUrl.includes("REPLACE_WITH") ? (
              <p className="text-sm text-muted-foreground">
                Solution walkthrough video coming soon — check back shortly.
              </p>
            ) : (
              <a
                href={solutionVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
              >
                <PlayCircle className="h-4 w-4" />
                Watch on YouTube
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CollapsibleSection>
        ) : null}

        {resources.length > 0 ? (
          <CollapsibleSection
            icon={<BookOpen className="h-5 w-5 text-sky-500" />}
            iconBg="bg-sky-500/10"
            title="Resources"
            animationDelay={0.24}
          >
            <ul className="space-y-2">
              {resources.map((url, i) => {
                let label = url;
                try {
                  const u = new URL(url);
                  label = u.hostname.replace("www.", "") + u.pathname;
                  if (label.endsWith("/")) label = label.slice(0, -1);
                } catch {
                  // fall back to raw URL if parsing fails
                }

                return (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-sky-600 hover:underline dark:text-sky-400"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="break-all">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          icon={<FileCode className="h-5 w-5 text-violet-500" />}
          iconBg="bg-violet-500/10"
          title="Prompt Template"
          animationDelay={0.28}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Customize the bracketed parts for your situation
            </span>
            <button
              type="button"
              onClick={() => void handleCopyPrompt()}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              {copiedPrompt ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          <pre className="overflow-x-auto rounded-xl border bg-muted/50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap md:text-sm">
            {content.promptTemplate}
          </pre>
        </CollapsibleSection>

        <CollapsibleSection
          icon={<Share2 className="h-5 w-5 text-pink-500" />}
          iconBg="bg-pink-500/10"
          title="LinkedIn Post Guidelines"
          subtitle={content.engagement.type}
          animationDelay={0.32}
        >
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
            {content.engagement.description}
          </p>

          <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1 font-mono text-xs font-semibold text-pink-600 dark:text-pink-400">
            <Tag className="h-3 w-3" />
            {content.engagement.hashtag}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          icon={<FileOutput className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-500/10"
          title="Your Deliverable"
          animationDelay={0.36}
        >
          <p className="text-sm text-muted-foreground">
            {content.deliverable.description}
          </p>
          <span className="mt-2 inline-block font-mono text-xs font-semibold text-muted-foreground">
            Format: {content.deliverable.format}
          </span>
        </CollapsibleSection>

        <div className="rounded-2xl border bg-card p-6">
          <p className="mb-2 text-xs text-muted-foreground">
            
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                type="url"
                placeholder="LinkedIn post URL"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="text-sm"
                disabled={submitting}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                type="url"
                placeholder="Github Commit URL"
                aria-label="GitHub commit URL"
                value={artifactUrl}
                onChange={(e) => setArtifactUrl(e.target.value)}
                className="text-sm"
                disabled={submitting}
              />
            </div>
            <Button
              onClick={() => void handleSubmit()}
              disabled={submitting || !linkedinUrl.trim() || !artifactUrl.trim()}
              className="shrink-0 gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : `Submit Day ${dayNumber}`}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
