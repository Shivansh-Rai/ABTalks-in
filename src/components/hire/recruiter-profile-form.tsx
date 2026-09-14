"use client";

import { useState, useTransition } from "react";
import { updateRecruiterProfileAction } from "@/app/actions/recruiter-profile-actions";
import {
  type RecruiterProfileDetails,
  isValidRecruiterPhone,
} from "@/lib/validations/recruiter-profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <CardTitle className="text-lg">Recruiter Profile</CardTitle>
          </div>
          <CardDescription>
            Your personal information visible to candidates when you reach out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="fullName"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="phone"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
                className={
                  phoneError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
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
                <p id="phone-hint" className="text-[11px] text-muted-foreground">
                  Optional contact detail for candidates (7-15 digits, optional +).
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
            >
              Work Email
            </label>
            <Input
              id="email"
              value={initialData.email}
              disabled
              readOnly
              className="cursor-not-allowed bg-muted/50"
            />
            <p className="text-[11px] text-muted-foreground">
              Work email is your verified login credential and cannot be edited.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Company Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <CardTitle className="text-lg">Company Identity</CardTitle>
          </div>
          <CardDescription>
            Company details shown on your outreach messages and job listings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="companyName"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="website"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
                className={
                  websiteError
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }
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

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label
                htmlFor="industry"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="companySize"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="location"
                className="text-xs font-semibold tracking-wide uppercase text-muted-foreground"
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={isPending}
          className="min-w-[140px]"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
