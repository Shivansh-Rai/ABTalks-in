"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  completeRecruiterSetupAction,
  saveRecruiterSetupStepAction,
} from "@/app/actions/recruiter-setup-actions";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "PROFILE" | "COMPANY" | "COMPLETE";

type Props = {
  /** Where the server says this recruiter left off. */
  initialStep: Step;
  initialValues: { fullName: string; company: string; phone: string };
};

/**
 * Resumable recruiter setup.
 *
 * Each step is saved server-side as it is completed, so the step shown here is
 * the server's answer, not this component's memory. Closing the tab loses
 * nothing: the next visit re-renders at whatever the database says.
 */
export function RecruiterSetupForm({ initialStep, initialValues }: Props) {
  const [step, setStep] = useState<Step>(initialStep);
  const [fullName, setFullName] = useState(initialValues.fullName);
  const [company, setCompany] = useState(initialValues.company);
  const [phone, setPhone] = useState(initialValues.phone);
  const [pending, startTransition] = useTransition();

  function saveProfile() {
    startTransition(async () => {
      const res = await saveRecruiterSetupStepAction({
        step: "PROFILE",
        fullName,
        phone,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setStep("COMPANY");
    });
  }

  function saveCompany() {
    startTransition(async () => {
      const saved = await saveRecruiterSetupStepAction({
        step: "COMPANY",
        company,
      });
      if (!saved.ok) {
        toast.error(saved.message);
        return;
      }
      const done = await completeRecruiterSetupAction();
      if (!done.ok) {
        toast.error(done.message);
        return;
      }
      // Deliberately no router.refresh(): refreshing re-renders /talent/setup,
      // whose guard sends a now-complete-but-unapproved recruiter to
      // /talent/pending — which flashed "Workspace ready" and replaced it with
      // "Application received" a second later. The state is terminal, and the
      // guard still catches anyone who comes back to this URL.
      setStep("COMPLETE");
    });
  }

  if (step === "COMPLETE") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-7 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold">Workspace ready</h2>
        <p className="text-sm text-muted-foreground">
          Your workspace is yours alone. Someone else at your company gets their
          own — they cannot see your candidates, projects or credits, and you
          cannot see theirs.
        </p>
        {/* Setting up is not the same as being let in. Say so here rather than
            redirecting into a review screen that contradicts the line above. */}
        <p className="text-sm text-muted-foreground">
          One step left, and it is ours: ABTalks confirms your company before
          your workspace opens. We will email you when that is done.
        </p>
        <Link
          href="/talent/pending"
          className={cn(buttonVariants({ size: "sm" }), "mt-1")}
        >
          See your application status
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Step {step === "PROFILE" ? "1" : "2"} of 2
      </p>

      {step === "PROFILE" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-name">Your name</Label>
            <Input
              id="setup-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="setup-phone">Phone (optional)</Label>
            <Input
              id="setup-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <Button
            onClick={saveProfile}
            disabled={pending || fullName.trim().length < 2}
            className="w-full"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-company">Company</Label>
            <Input
              id="setup-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <Button
            onClick={saveCompany}
            disabled={pending || company.trim().length < 2}
            className="w-full"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Finish setup"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
