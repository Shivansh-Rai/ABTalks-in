"use client";

import { useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Send, SkipForward, Sparkles } from "lucide-react";
import type { ProgramMissionType } from "@prisma/client";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckList, type CheckItem } from "@/components/program/workbench/check-list";
import type { MissionState } from "@/features/program/missions";
import { PROGRAM_TOTAL_DAYS } from "@/features/program/constants";
import {
  submitMissionRunAction,
  useSkipTokenAction,
} from "@/app/actions/program-mission-actions";
import { requestMentorReviewAction } from "@/app/actions/program-ai-actions";
import { cn } from "@/lib/utils";

type Props = {
  dayNumber: number;
  dayTitle: string;
  missionType: ProgramMissionType;
  githubRepoUrl: string;
  missionState: MissionState;
  initialMentorFeedback?: string | null;
};

function MentorFeedbackCard({ feedback }: { feedback: string }) {
  return (
    <div className="rounded-xl border bg-background p-4 text-sm [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AI Mentor review
      </p>
      <ReactMarkdown>{feedback}</ReactMarkdown>
    </div>
  );
}

function fireConfetti() {
  void confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}

export function MissionPanel({
  dayNumber,
  missionType,
  githubRepoUrl,
  missionState: initialState,
  initialMentorFeedback = null,
}: Props) {
  const [missionState, setMissionState] = useState(initialState);
  const [mentorFeedback, setMentorFeedback] = useState<string | null>(
    initialMentorFeedback,
  );
  const [mentorLoading, setMentorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<CheckItem[] | null>(null);
  const [passedBanner, setPassedBanner] = useState<{
    points: number;
    unlockedDay?: number;
  } | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [bossRepo, setBossRepo] = useState(githubRepoUrl);
  const [bossWriteup, setBossWriteup] = useState("");
  const [answers, setAnswers] = useState<string[]>(
    Array(missionState.dataRoomQuestionCount ?? 1).fill(""),
  );

  async function handleSubmit() {
    setSubmitting(true);
    setVerdict(null);
    try {
      let payload: unknown = {};

      if (missionType === "CODE_SPRINT") {
        toast.error(
          "In-browser code execution was removed. Complete CODE_SPRINT missions locally; this day type is unused in the current curriculum.",
        );
        return;
      } else if (missionType === "SHIP_IT") {
        payload = {};
      } else if (missionType === "DATA_ROOM") {
        payload = {
          answers: answers.map((a) => {
            const n = Number(a);
            return a.trim() !== "" && !Number.isNaN(n) ? n : a;
          }),
        };
      } else if (missionType === "PROMPT_FORGE") {
        payload = { prompt };
      } else if (missionType === "BOSS_BUILD") {
        payload = { repoUrl: bossRepo, writeup: bossWriteup };
      }

      const result = await submitMissionRunAction({ dayNumber, payload });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const lines: CheckItem[] = result.data.verdict.map((v) => ({
        check: v.check,
        passed: v.passed,
        detail: v.detail,
      }));
      setVerdict(lines);

      if (result.data.passed) {
        fireConfetti();
        setPassedBanner({
          points: result.data.pointsAwarded,
          unlockedDay: result.data.unlockedDay,
        });
        setMissionState((s) => ({
          ...s,
          dayState: "PASSED",
          passed: true,
        }));
      } else {
        setMissionState((s) => ({
          ...s,
          failedRunCount: s.failedRunCount + 1,
          canSkip: s.skipTokensLeft > 0 && s.failedRunCount + 1 >= 3,
        }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMentorReview() {
    if (mentorFeedback) {
      toast.info("Already reviewed — showing your saved note.");
      return;
    }
    setMentorLoading(true);
    try {
      const result = await requestMentorReviewAction({ dayNumber });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setMentorFeedback(result.data.feedback);
      toast.success("AI Mentor review ready!");
    } finally {
      setMentorLoading(false);
    }
  }

  async function handleSkip() {
    const result = await useSkipTokenAction({ dayNumber });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Day skipped — Day ${result.data.unlockedDay} unlocked`);
    setSkipOpen(false);
    setMissionState((s) => ({
      ...s,
      dayState: "SKIPPED",
      skipTokensLeft: s.skipTokensLeft - 1,
      canSkip: false,
    }));
  }

  if (missionState.dayState === "PASSED") {
    return (
      <div className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <p className="font-semibold text-emerald-600 dark:text-emerald-400">
          Mission cleared ✓
        </p>
        {passedBanner?.unlockedDay &&
          passedBanner.unlockedDay <= PROGRAM_TOTAL_DAYS && (
            <Link
              href={`/program/day/${passedBanner.unlockedDay}`}
              className={buttonVariants({ size: "sm" })}
            >
              Continue to Day {passedBanner.unlockedDay}
            </Link>
          )}
        {verdict && <CheckList items={verdict} />}
        {mentorFeedback ? (
          <MentorFeedbackCard feedback={mentorFeedback} />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void handleMentorReview()}
            disabled={mentorLoading}
          >
            <Sparkles className="size-4" />
            {mentorLoading ? "Reviewing…" : "Get AI Mentor review"}
          </Button>
        )}
      </div>
    );
  }

  if (missionState.dayState === "SKIPPED") {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-muted-foreground">
        You skipped this mission (0 points). The concept check below is still
        available.
      </div>
    );
  }

  const submitLabel =
    missionType === "SHIP_IT"
      ? submitting
        ? "Verifying…"
        : "Verify my repo"
      : submitting
        ? "Verifying…"
        : "Submit for verification";

  return (
    <div className="space-y-4">
      {passedBanner && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
            Day {dayNumber} cleared — +{passedBanner.points} pts
            {passedBanner.unlockedDay
              ? ` · Day ${passedBanner.unlockedDay} unlocked`
              : ""}
          </p>
          {passedBanner.unlockedDay &&
            passedBanner.unlockedDay <= PROGRAM_TOTAL_DAYS && (
              <Link
                href={`/program/day/${passedBanner.unlockedDay}`}
                className={cn(buttonVariants({ size: "sm" }), "mt-2 inline-flex")}
              >
                Go to Day {passedBanner.unlockedDay}
              </Link>
            )}
        </div>
      )}

      {missionType === "SHIP_IT" && (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Build locally in VS Code, then push your artifact to{" "}
            <a
              href={githubRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {githubRepoUrl}
            </a>
            . We verify the repo against the mission checklist.
          </p>
          {missionState.shipItHints && missionState.shipItHints.length > 0 && (
            <ul className="space-y-1 text-sm">
              {missionState.shipItHints.map((h) => (
                <li key={h.path} className="font-mono text-muted-foreground">
                  {h.check}: <span className="text-foreground">{h.path}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {missionType === "PROMPT_FORGE" && (
        <div className="space-y-2">
          <Label htmlFor="prompt">Your system prompt</Label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-40 w-full rounded-lg border bg-muted/30 p-3 font-mono text-sm"
            placeholder="Write the prompt that satisfies the mission spec…"
          />
        </div>
      )}

      {missionType === "BOSS_BUILD" && (
        <div className="space-y-4 rounded-xl border p-4">
          <div className="space-y-2">
            <Label htmlFor="boss-repo">Project repository URL</Label>
            <Input
              id="boss-repo"
              value={bossRepo}
              onChange={(e) => setBossRepo(e.target.value)}
              placeholder="https://github.com/you/project"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="boss-writeup">Write-up</Label>
            <textarea
              id="boss-writeup"
              value={bossWriteup}
              onChange={(e) => setBossWriteup(e.target.value)}
              className="min-h-32 w-full rounded-lg border bg-muted/30 p-3 text-sm"
              placeholder="Describe what you built and how to run it…"
            />
          </div>
        </div>
      )}

      {missionType === "DATA_ROOM" && missionState.dataRoomQuestionCount && (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Your answers</p>
          {answers.map((val, i) => (
            <div key={i} className="space-y-1">
              <Label htmlFor={`answer-${i}`}>Answer {i + 1}</Label>
              <Input
                id={`answer-${i}`}
                value={val}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = e.target.value;
                  setAnswers(next);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {missionType === "CODE_SPRINT" && (
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          In-browser Workbench was removed. CODE_SPRINT days are not used in the
          current curriculum — build and verify via SHIP_IT repo checks instead.
        </div>
      )}

      {verdict && (
        <div className="rounded-xl border p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Verification
          </h3>
          <CheckList items={verdict} running={submitting} />
        </div>
      )}

      {missionType !== "CODE_SPRINT" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="gap-2"
          >
            <Send className="size-4" />
            {submitLabel}
          </Button>

          {missionState.canSkip && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setSkipOpen(true)}
              className="gap-2"
            >
              <SkipForward className="size-4" />
              Use skip token ({missionState.skipTokensLeft} left)
            </Button>
          )}
        </div>
      )}

      {missionState.failedRunCount > 0 && missionState.failedRunCount < 3 && (
        <p className="text-xs text-muted-foreground">
          {3 - missionState.failedRunCount} more failed run
          {3 - missionState.failedRunCount === 1 ? "" : "s"} until skip token
          unlocks.
        </p>
      )}

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use a skip token?</DialogTitle>
            <DialogDescription>
              This is irreversible. You will earn 0 mission points for Day{" "}
              {dayNumber}, but the next day will unlock. You have{" "}
              {missionState.skipTokensLeft} token
              {missionState.skipTokensLeft === 1 ? "" : "s"} remaining.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>
              Skipped days still allow the concept check, but no mission points.
            </span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSkipOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleSkip()}>
              Skip this day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
