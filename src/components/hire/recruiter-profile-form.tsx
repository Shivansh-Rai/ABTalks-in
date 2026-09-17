"use client";

import { useState, useTransition } from "react";
import { updateRecruiterProfileAction } from "@/app/actions/recruiter-profile-actions";
import {
  type RecruiterProfileDetails,
  isValidRecruiterPhone,
} from "@/lib/validations/recruiter-profile";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { dsButtonVariants } from "@/components/design/ds-button";
import { CLAY_CTA } from "@/components/jobs/job-ui";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2, Building2, User } from "lucide-react";

function validatePhoneInput(val: string): string | null {
  if (!val || val.trim().length === 0) return null;
  const trimmed = val.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return "Phone number can only contain digits, spaces, hyphens, and an optional leading +.";
  }
  if ((trimmed.match(/\+/g) || []).length > 1 || (trimmed.includes("+") && !trimmed.startsWith("+"))) {
    return "Phone number can only have a single leading +.";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Enter a valid phone number (7-15 digits, optional + prefix).";
  }
  return null;
}

function validateWebsiteInput(val: string): string | null {
  if (!val || val.trim().length === 0) return null;
  const trimmed = val.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return "Please enter a valid website URL.";
    }
    if (!u.hostname || !u.hostname.includes(".")) {
      return "Please enter a valid website domain (e.g. example.com).";
    }
    return null;
  } catch {
    return "Please enter a valid website URL.";
  }
}

export function RecruiterProfileForm({
  initialData,
}: {
  initialData: RecruiterProfileDetails;
}) {
  const [isPending, startTransition] = useTransition();

  const [fullName, setFullName] = useState(initialData.fullName ?? "");
  const [phone, setPhone] = useState(initialData.phone ?? "");
  const [companyName, setCompanyName] = useState(initialData.companyName ?? "");
  const [website, setWebsite] = useState(initialData.website ?? "");
  const [industry, setIndustry] = useState(initialData.industry ?? "");
  const [companySize, setCompanySize] = useState(initialData.companySize ?? "");
  const [location, setLocation] = useState(initialData.location ?? "");

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const pErr = validatePhoneInput(phone);
    if (pErr) {
      setPhoneError(pErr);
      document.getElementById("phone")?.focus();
      return;
    }
    setPhoneError(null);

    const wErr = validateWebsiteInput(website);
    if (wErr) {
      setWebsiteError(wErr);
      document.getElementById("website")?.focus();
      return;
    }
    setWebsiteError(null);

    startTransition(async () => {
      const res = await updateRecruiterProfileAction({
        fullName,
        phone,
        companyName,
        website,
        industry,
        companySize,
        location,
      });

      if (res.ok) {
        setSuccess(res.message);
      } else {
        if (res.message.toLowerCase().includes("phone")) {
          setPhoneError(res.message);
        }
        if (res.message.toLowerCase().includes("website") || res.message.toLowerCase().includes("url")) {
          setWebsiteError(res.message);
        }
        setError(res.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full">
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm font-medium text-destructive"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Recruiter Identity */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <CardTitle className="font-heading text-lg font-bold text-foreground">
                Recruiter Profile
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-0.5">
                Your personal information visible to candidates when you reach out.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="fullName"
                className="text-sm font-semibold text-foreground flex items-center gap-1"
              >
                Full Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="fullName"
                name="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                required
                disabled={isPending}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="text-sm font-semibold text-foreground"
              >
                Phone Number
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value;
                  setPhone(val);
                  if (phoneError) {
                    setPhoneError(validatePhoneInput(val));
                  }
                }}
                onBlur={() => setPhoneError(validatePhoneInput(phone))}
                placeholder="+1 555-0199"
                disabled={isPending}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? "phone-error" : "phone-hint"}
                className={cn(
                  "h-10 rounded-xl",
                  phoneError && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {phoneError ? (
                <p
                  id="phone-error"
                  role="alert"
                  className="text-xs font-medium text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{phoneError}</span>
                </p>
              ) : (
                <p id="phone-hint" className="text-xs text-muted-foreground">
                  Optional contact detail for candidates (7-15 digits, optional +).
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-foreground"
              >
                Work Email
              </label>
              <Input
                id="email"
                value={initialData.email}
                disabled
                readOnly
                className="h-10 rounded-xl cursor-not-allowed bg-muted/60 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Work email is your verified login credential and cannot be edited.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Identity */}
      <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <CardTitle className="font-heading text-lg font-bold text-foreground">
                Company Identity
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-0.5">
                Company details shown on your outreach messages and job listings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="companyName"
                className="text-sm font-semibold text-foreground flex items-center gap-1"
              >
                Company Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="companyName"
                name="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                required
                disabled={isPending}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="website"
                className="text-sm font-semibold text-foreground"
              >
                Company Website
              </label>
              <Input
                id="website"
                name="website"
                value={website}
                onChange={(e) => {
                  const val = e.target.value;
                  setWebsite(val);
                  if (websiteError) {
                    setWebsiteError(validateWebsiteInput(val));
                  }
                }}
                onBlur={() => setWebsiteError(validateWebsiteInput(website))}
                placeholder="https://example.com"
                disabled={isPending}
                aria-invalid={Boolean(websiteError)}
                aria-describedby={websiteError ? "website-error" : undefined}
                className={cn(
                  "h-10 rounded-xl",
                  websiteError && "border-destructive focus-visible:ring-destructive",
                )}
              />
              {websiteError && (
                <p
                  id="website-error"
                  role="alert"
                  className="text-xs font-medium text-destructive flex items-center gap-1"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{websiteError}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="industry"
                className="text-sm font-semibold text-foreground"
              >
                Industry
              </label>
              <Input
                id="industry"
                name="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. FinTech, AI, SaaS"
                disabled={isPending}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="companySize"
                className="text-sm font-semibold text-foreground"
              >
                Company Size
              </label>
              <Input
                id="companySize"
                name="companySize"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="e.g. 50-200 employees"
                disabled={isPending}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="location"
                className="text-sm font-semibold text-foreground"
              >
                Headquarters / Location
              </label>
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                disabled={isPending}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            dsButtonVariants({ size: "default" }),
            CLAY_CTA,
            "min-w-[150px] gap-2 font-semibold",
          )}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
}
