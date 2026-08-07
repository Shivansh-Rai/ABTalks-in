"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveHackathonSubmissionAction } from "@/app/actions/hackathon-submission-actions";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { hackathonSubmissionSchema } from "@/lib/validations/hackathon";

type Brief = {
  id: string;
  number: number;
  title: string;
};

type InitialSubmission = {
  problemId: string | null;
  repoUrl: string;
  liveUrl: string;
  aiLogUrl: string;
  updatedAtIso: string;
};

type Props = {
  briefs: Brief[];
  initial: InitialSubmission | null;
  editable: boolean;
  closed: boolean;
};

type FieldErrors = Partial<Record<"problemId" | "repoUrl" | "liveUrl" | "aiLogUrl", string>>;

export function SubmissionForm({ briefs, initial, editable }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initial?.problemId ?? briefs[0]?.id ?? "");
  const [repoUrl, setRepoUrl] = useState(initial?.repoUrl ?? "");
  const [liveUrl, setLiveUrl] = useState(initial?.liveUrl ?? "");
  const [aiLogUrl, setAiLogUrl] = useState(initial?.aiLogUrl ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const briefById = useMemo(
    () => new Map(briefs.map((brief) => [brief.id, brief])),
    [briefs],
  );

  const selectedBrief = selectedId ? briefById.get(selectedId) ?? null : null;
  const initialBrief = initial?.problemId ? briefById.get(initial.problemId) ?? null : null;
  const movingBrief = !!initial?.problemId && selectedId !== initial.problemId;
  const showIncompleteBadge =
    initial !== null && (initial.liveUrl === "" || initial.aiLogUrl === "");

  function setFieldError(name: keyof FieldErrors, message?: string) {
    setErrors((prev) => ({
      ...prev,
      [name]: message,
    }));
  }

  async function submit() {
    const parsed = hackathonSubmissionSchema.safeParse({
      problemId: selectedId,
      repoUrl,
      liveUrl,
      aiLogUrl,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          typeof key === "string" &&
          (key === "problemId" ||
            key === "repoUrl" ||
            key === "liveUrl" ||
            key === "aiLogUrl") &&
          !nextErrors[key]
        ) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setErrors({});

    startTransition(async () => {
      const result = await saveHackathonSubmissionAction(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Submission saved");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  if (!editable) {
    const savedBrief = initial?.problemId ? briefById.get(initial.problemId) ?? null : null;

    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Your submission</h2>
          {showIncompleteBadge ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
              Incomplete - add your live URL and AI-usage log before the deadline.
            </span>
          ) : null}
        </div>

        {initial === null ? (
          <p className="mt-4 text-sm text-zinc-400">
            No submission was recorded for your team.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <StaticRow label="Brief" value={savedBrief?.title ?? "No brief selected"} />
            <StaticRow label="Public GitHub repo link" href={initial.repoUrl} value={initial.repoUrl} />
            <StaticRow
              label="Live URL"
              href={initial.liveUrl || undefined}
              value={initial.liveUrl || "Not provided yet"}
            />
            <StaticRow
              label="AI-usage log URL"
              href={initial.aiLogUrl || undefined}
              value={initial.aiLogUrl || "Not provided yet"}
            />
          </div>
        )}

        <p className="mt-4 text-sm text-zinc-400">
          Submissions closed · {HACKATHON.deadlineLabel}
        </p>
        {initial !== null && mounted ? (
          <p className="mt-2 text-xs text-zinc-500">
            Last saved {new Date(initial.updatedAtIso).toLocaleString()}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-white">Submission</h2>
        {showIncompleteBadge ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
            Incomplete - add your live URL and AI-usage log before the deadline.
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        Edit as often as you like until the deadline. Each save replaces the last one.
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {briefs.map((brief) => (
          <button
            key={brief.id}
            type="button"
            onClick={() => {
              setSelectedId(brief.id);
              setFieldError("problemId");
            }}
            aria-pressed={selectedId === brief.id}
            className={cn(
              "rounded-xl border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm",
              selectedId === brief.id
                ? "border-[#7364E6] bg-[#7364E6]/20 text-white"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/25 hover:text-white",
            )}
          >
            PROBLEM STATEMENT {brief.number}
          </button>
        ))}
      </div>

      {selectedBrief ? (
        <p className="mt-3 text-sm text-zinc-400">{selectedBrief.title}</p>
      ) : null}
      {errors.problemId ? (
        <p className="mt-2 text-sm text-destructive">{errors.problemId}</p>
      ) : null}

      {movingBrief && initialBrief && selectedBrief ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Your saved entry is for <strong>{initialBrief.title}</strong>. Saving now moves it to{" "}
          <strong>{selectedBrief.title}</strong> — you can only enter one brief.
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <Field
          id="repoUrl"
          label="Public GitHub repo link"
          value={repoUrl}
          onChange={(value) => {
            setRepoUrl(value);
            setFieldError("repoUrl");
          }}
          placeholder="https://github.com/your-username/your-project"
          helper={HACKATHON.deliverables[0]?.body ?? ""}
          error={errors.repoUrl}
        />
        <Field
          id="liveUrl"
          label="Live URL"
          value={liveUrl}
          onChange={(value) => {
            setLiveUrl(value);
            setFieldError("liveUrl");
          }}
          placeholder="https://your-project.vercel.app"
          helper={HACKATHON.deliverables[1]?.body ?? ""}
          error={errors.liveUrl}
        />
        <Field
          id="aiLogUrl"
          label="AI-usage log URL"
          value={aiLogUrl}
          onChange={(value) => {
            setAiLogUrl(value);
            setFieldError("aiLogUrl");
          }}
          placeholder="https://github.com/your-username/your-project/blob/main/PROMPTS.md"
          helper={HACKATHON.deliverables[2]?.body ?? ""}
          error={errors.aiLogUrl}
        />
      </div>

      <div className="mt-6">
        {movingBrief ? (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger
              render={
                <Button type="button" className="w-full sm:w-auto" disabled={pending} />
              }
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save submission"
              )}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Move your entry to {selectedBrief?.title ?? "this brief"}?
                </DialogTitle>
                <DialogDescription>
                  This replaces your saved brief choice. Your team can only keep one active
                  submission.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter showCloseButton>
                <Button type="button" disabled={pending} onClick={() => void submit()}>
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Move and save"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={() => void submit()}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save submission"
            )}
          </Button>
        )}
      </div>

      {initial !== null && mounted ? (
        <p className="mt-3 text-xs text-zinc-500">
          Last saved {new Date(initial.updatedAtIso).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  helper,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  helper: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      <p className="text-sm text-zinc-500">{helper}</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function StaticRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-sm text-[#C4B5FD] underline-offset-2 hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-zinc-200">{value}</p>
      )}
    </div>
  );
}
