"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import {
  lookupHackathonTeamAction,
  submitHackathonRegistrationAction,
} from "@/app/actions/hackathon-actions";
import { CollegeCombobox } from "@/components/shared/college-combobox";
import { SuccessPanel } from "@/components/hackathon/success-panel";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LegalConsentFields,
  legalConsentAccepted,
  DEFAULT_LEGAL_CONSENT,
  type LegalConsentValues,
} from "@/components/legal/legal-consent-fields";
import type { RegistrationPrefill } from "@/features/hackathon/registration-identity";
import { requiredPhoneSchema } from "@/lib/validations/phone";
import {
  hackathonRegistrationSchema,
  type HackathonRegistrationInput,
} from "@/lib/validations/hackathon";
import { cn } from "@/lib/utils";

const GRADUATION_YEARS = [
  2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032,
] as const;

const DEFAULT_GRADUATION_YEAR = 2026;

/** No profile to read from — ask for everything the row needs. */
const FALLBACK_PREFILL: RegistrationPrefill = {
  college: "",
  graduationYear: null,
  needsPhone: true,
};

type EntryType = HackathonRegistrationInput["entryType"];

type FormValues = {
  entryType: EntryType;
  college: string;
  graduationYear: number;
  phone: string;
  teamName: string;
  teamCode: string;
  acceptLegal: boolean;
  newsletterOptIn: boolean;
};

type SuccessState = {
  entryType: EntryType;
  teamCode: string;
  teamName: string | null;
};

const ENTRY_OPTIONS: { value: EntryType; title: string; body: string }[] = [
  {
    value: "SOLO",
    title: "Going solo",
    body: "Register as an individual. You'll still get a code if you ever need it.",
  },
  {
    value: "TEAM_CREATE",
    title: "Create a team",
    body: "Start a team of up to 3. You'll get a 6-character code to share.",
  },
  {
    value: "TEAM_JOIN",
    title: "Join a team with a code",
    body: "Enter the code your team leader shared with you.",
  },
];

function Spinner() {
  return (
    <svg
      className="hk-reg__spinner"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" opacity=".3" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

export function RegistrationForm({
  prefill = FALLBACK_PREFILL,
  onSuccess,
}: {
  prefill?: RegistrationPrefill;
  onSuccess?: (data: SuccessState) => void;
}) {
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [pending, startTransition] = useTransition();
  const [lookupPending, startLookup] = useTransition();
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupOk, setLookupOk] = useState(false);
  const [legalConsent, setLegalConsent] = useState<LegalConsentValues>(
    DEFAULT_LEGAL_CONSENT,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(
      hackathonRegistrationSchema,
    ) as unknown as Resolver<FormValues>,
    defaultValues: {
      entryType: "SOLO",
      college: prefill.college,
      graduationYear: prefill.graduationYear ?? DEFAULT_GRADUATION_YEAR,
      phone: "",
      teamName: "",
      teamCode: "",
      acceptLegal: DEFAULT_LEGAL_CONSENT.acceptLegal,
      newsletterOptIn: DEFAULT_LEGAL_CONSENT.newsletterOptIn,
    },
    mode: "onTouched",
  });

  const entryType = form.watch("entryType");
  const totalSteps = entryType === "SOLO" ? 2 : 3;
  const consented = legalConsentAccepted(legalConsent);

  function buildPayload(values: FormValues): HackathonRegistrationInput {
    const base = {
      college: values.college,
      graduationYear: values.graduationYear,
      // Only carries a value when the profile had no number to reuse; the
      // server prefers what is on the profile either way.
      phone: prefill.needsPhone ? values.phone : "",
      acceptLegal: values.acceptLegal,
      newsletterOptIn: values.newsletterOptIn,
    };
    if (values.entryType === "TEAM_CREATE") {
      return { ...base, entryType: "TEAM_CREATE", teamName: values.teamName };
    }
    if (values.entryType === "TEAM_JOIN") {
      return { ...base, entryType: "TEAM_JOIN", teamCode: values.teamCode };
    }
    return { ...base, entryType: "SOLO" };
  }

  async function goNext() {
    setSubmitError(null);
    if (step === 1) {
      const ok = await form.trigger("entryType");
      if (!ok) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await form.trigger(["college", "graduationYear"]);
      if (!ok) return;
      // The shared schema can only treat `phone` as an optional string — it has
      // no way to know whether this account already has one — so the "actually
      // required here" case is checked in the one place that knows.
      if (prefill.needsPhone) {
        const phone = requiredPhoneSchema.safeParse(form.getValues("phone"));
        if (!phone.success) {
          form.setError("phone", {
            message:
              phone.error.issues[0]?.message ?? "Enter a valid phone number",
          });
          return;
        }
      }
      if (entryType === "SOLO") {
        if (!consented) {
          setSubmitError(
            "Please accept the Terms of Service and Privacy Policy.",
          );
          return;
        }
        form.setValue("acceptLegal", legalConsent.acceptLegal);
        form.setValue("newsletterOptIn", legalConsent.newsletterOptIn);
        form.handleSubmit(onSubmit)();
        return;
      }
      setStep(3);
    }
  }

  function checkTeamCode() {
    const code = form.getValues("teamCode").trim().toUpperCase();
    form.setValue("teamCode", code, { shouldValidate: true });
    setLookupMessage(null);
    setLookupOk(false);

    startLookup(async () => {
      const result = await lookupHackathonTeamAction(code);
      if (!result.ok) {
        setLookupMessage(result.message);
        setLookupOk(false);
        return;
      }
      setLookupOk(true);
      setLookupMessage(
        `Joining ${result.data.teamName ?? "team"} — ${result.data.spotsLeft} spot(s) left.`,
      );
    });
  }

  function onSubmit(values: FormValues) {
    setSubmitError(null);
    if (!consented) {
      setSubmitError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    const payload = buildPayload(values);

    startTransition(async () => {
      const result = await submitHackathonRegistrationAction(payload);
      if (!result.ok) {
        setSubmitError(result.message);
        toast.error(result.message);
        return;
      }
      const next: SuccessState = {
        entryType: result.data.entryType,
        teamCode: result.data.teamCode,
        teamName: result.data.teamName,
      };
      setSuccess(next);
      onSuccess?.(next);
    });
  }

  if (success) {
    return (
      <SuccessPanel
        entryType={success.entryType}
        teamCode={success.teamCode}
        teamName={success.teamName}
      />
    );
  }

  const submitLabel = pending ? (
    <>
      <Spinner />
      Registering…
    </>
  ) : (
    "Register"
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="hk-reg">
        <div className="hk-reg__meter">
          <div className="hk-reg__meter-row">
            <span>
              Step {step} of {totalSteps}
            </span>
            <b>{Math.round((step / totalSteps) * 100)}%</b>
          </div>
          <div className="hk-reg__track">
            <div
              className="hk-reg__fill"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 ? (
          <FormField
            control={form.control}
            name="entryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="hk-reg__legend">
                  How are you entering?
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(v) => {
                      const next =
                        v === "TEAM_CREATE" || v === "TEAM_JOIN" || v === "SOLO"
                          ? v
                          : "SOLO";
                      field.onChange(next);
                      setLookupOk(false);
                      setLookupMessage(null);
                      if (step > 2 && next === "SOLO") setStep(2);
                    }}
                    className="hk-reg__choices"
                  >
                    {ENTRY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        htmlFor={`entry-${opt.value}`}
                        className={cn(
                          "hk-reg__choice",
                          field.value === opt.value && "is-selected",
                        )}
                      >
                        <RadioGroupItem
                          value={opt.value}
                          id={`entry-${opt.value}`}
                        />
                        <span className="min-w-0">
                          <span className="hk-reg__choice-title block">
                            {opt.title}
                          </span>
                          <span className="hk-reg__choice-body block">
                            {opt.body}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {step === 2 ? (
          <div>
            <p className="hk-reg__legend">Where do you study?</p>
            <p className="hk-reg__hint">
              {prefill.needsPhone
                ? "We take your name and email from your account — this is all we're missing."
                : "Your name, email and WhatsApp number come from your account, so this is all we need."}
            </p>

            <div className="hk-reg__fields mt-4">
              <FormField
                control={form.control}
                name="college"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>College</FormLabel>
                    <FormControl>
                      <CollegeCombobox
                        value={field.value}
                        onChange={(name) => field.onChange(name)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="graduationYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Graduation year</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => {
                        if (v != null) field.onChange(Number(v));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GRADUATION_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Asked only for accounts with no number on file — everyone who
                  came through /register already has a verified one. */}
              {prefill.needsPhone ? (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          autoComplete="tel"
                          placeholder="+91…"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 && entryType === "TEAM_CREATE" ? (
          <div>
            <p className="hk-reg__legend">Name your team</p>
            <p className="hk-reg__hint">
              You&apos;ll get a 6-character code to share with your teammates.
            </p>
            <div className="hk-reg__fields mt-4">
              <FormField
                control={form.control}
                name="teamName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        ) : null}

        {step === 3 && entryType === "TEAM_JOIN" ? (
          <div>
            <p className="hk-reg__legend">Enter your team code</p>
            <p className="hk-reg__hint">
              The 6-character code your team leader shared with you.
            </p>
            <div className="hk-reg__fields mt-4">
              <FormField
                control={form.control}
                name="teamCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        maxLength={6}
                        autoCapitalize="characters"
                        className="hk-reg__code-input"
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                          setLookupOk(false);
                          setLookupMessage(null);
                        }}
                        onBlur={() => {
                          field.onBlur();
                          if (form.getValues("teamCode").trim().length === 6) {
                            checkTeamCode();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button
                type="button"
                className="ab-btn hk-btn--outline"
                onClick={checkTeamCode}
                disabled={lookupPending}
              >
                {lookupPending ? (
                  <>
                    <Spinner />
                    Checking…
                  </>
                ) : (
                  "Check code"
                )}
              </button>
              {lookupMessage ? (
                <p
                  className={cn(
                    "hk-reg__lookup",
                    lookupOk ? "is-ok" : "is-bad",
                  )}
                >
                  {lookupMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === totalSteps ? (
          <LegalConsentFields
            className="hk-reg__legal"
            values={legalConsent}
            onChange={(next) => {
              setLegalConsent(next);
              form.setValue("acceptLegal", next.acceptLegal);
              form.setValue("newsletterOptIn", next.newsletterOptIn);
            }}
          />
        ) : null}

        {submitError ? (
          <div className="hk-reg__error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="hk-reg__actions">
          {step === 2 && entryType === "SOLO" ? (
            <button
              type="button"
              className="ab-btn ab-btn--primary"
              onClick={goNext}
              disabled={pending || !consented}
            >
              {submitLabel}
            </button>
          ) : step < totalSteps ? (
            <button
              type="button"
              className="ab-btn ab-btn--primary"
              onClick={goNext}
              disabled={pending}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="ab-btn ab-btn--primary"
              disabled={
                pending ||
                !consented ||
                (entryType === "TEAM_JOIN" && !lookupOk)
              }
            >
              {submitLabel}
            </button>
          )}

          {step > 1 ? (
            <button
              type="button"
              className="ab-btn hk-btn--outline"
              onClick={() => {
                setSubmitError(null);
                setStep((s) => s - 1);
              }}
              disabled={pending}
            >
              Back
            </button>
          ) : (
            <span />
          )}
        </div>
      </form>
    </Form>
  );
}
