"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { CandidateGender, CandidatePersona } from "@prisma/client";
import { saveBasicInfoAction } from "@/app/actions/candidate-profile-actions";
import { PhoneVerifyField } from "@/components/shared/phone-verify-field";
import { PERSONA_LABELS, GENDER_LABELS } from "@/lib/candidate-vocab";
import { COUNTRY_NAMES, countryCodeForName, countryNameForCode } from "@/lib/country-catalog";
import {
  INDIA_DIALING_CODE,
  isIndianPhone,
} from "@/lib/validations/phone";
import { useSectionSave } from "./use-section-save";
import { useProfileWizard } from "./wizard-context";
import {
  PwField,
  PwInput,
  PwRow,
  PwSelect,
  PwSuggest,
  PwTextarea,
} from "./wizard-fields";

export type BasicInfoValues = {
  fullName: string;
  phone: string;
  headline: string;
  summary: string;
  locationCity: string;
  locationRegion: string;
  countryCode: string;
  gender: CandidateGender | "";
  primaryPersona: CandidatePersona;
};

/** Form shape: the candidate picks a country NAME, storage keeps the code. */
type FormValues = Omit<BasicInfoValues, "countryCode"> & { country: string };

/**
 * Letters, spaces and the punctuation real names carry. Mirrors the server
 * guard in validations/candidate-profile.ts so the message arrives before the
 * round trip rather than after it.
 */
const LETTERS_ONLY = /^[\p{L}][\p{L}\s.'\-&]*$/u;

const lettersOnly = (label: string) => (value: string) =>
  value.trim() === "" || LETTERS_ONLY.test(value.trim())
    ? true
    : `${label} cannot contain numbers or symbols`;

function splitPhone(e164: string): {
  countryCode: string;
  national: string;
} {
  const trimmed = e164.trim();
  if (trimmed.startsWith(INDIA_DIALING_CODE) && trimmed.length >= 13) {
    return {
      countryCode: INDIA_DIALING_CODE,
      national: trimmed.slice(INDIA_DIALING_CODE.length),
    };
  }
  const match = trimmed.match(/^(\+\d{1,3})(\d+)$/);
  if (match) {
    return { countryCode: match[1]!, national: match[2]! };
  }
  return { countryCode: INDIA_DIALING_CODE, national: trimmed.replace(/^\+/, "") };
}

export function BasicInfoSection({
  initial,
  phoneVerified,
  otpRequired,
}: {
  initial: BasicInfoValues;
  phoneVerified: boolean;
  otpRequired: boolean;
}) {
  const router = useRouter();
  const { formId, onSaved, setDirty } = useProfileWizard();
  const { save } = useSectionSave(
    saveBasicInfoAction,
    "Basic information",
    "basic",
  );
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      ...initial,
      country: countryNameForCode(initial.countryCode),
    },
  });

  const summary = watch("summary") ?? "";
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const defaults = splitPhone(initial.phone);

  useEffect(() => {
    setDirty(isDirty);
  }, [isDirty, setDirty]);

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(async (v) => {
        setPhoneError(null);
        if (
          otpRequired &&
          !phoneVerified &&
          (v.phone.trim() === "" || isIndianPhone(v.phone))
        ) {
          setPhoneError("Please verify your phone number to continue.");
          return;
        }
        const { country, ...rest } = v;
        if (await save({ ...rest, countryCode: countryCodeForName(country) })) {
          onSaved();
        }
      })}
    >
      <PwRow cols={2}>
        <PwField
          label="Full name"
          required
          htmlFor="bi-fullName"
          error={errors.fullName?.message}
        >
          <PwInput
            id="bi-fullName"
            autoComplete="name"
            placeholder="Your full name"
            aria-invalid={Boolean(errors.fullName)}
            className={errors.fullName ? "pw-invalid" : undefined}
            {...register("fullName", {
              required: "Full name is required",
              validate: lettersOnly("Full name"),
            })}
          />
        </PwField>
        <PwField
          label="Phone Number"
          required={otpRequired}
          htmlFor="bi-phone"
          verified={phoneVerified}
          error={phoneError}
        >
          {phoneVerified ? (
            <PwInput
              id="bi-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              readOnly
              {...register("phone")}
            />
          ) : (
            <div className="pw-phone-verify">
              <PhoneVerifyField
                defaultCountryCode={defaults.countryCode}
                defaultPhoneNumber={defaults.national}
                verificationRequired={otpRequired}
                onChange={(v) => {
                  setValue("phone", v.e164, { shouldDirty: true });
                  setPhoneError(null);
                }}
                onVerified={(e164) => {
                  setValue("phone", e164, { shouldDirty: true });
                  setPhoneError(null);
                  router.refresh();
                }}
              />
            </div>
          )}
        </PwField>
      </PwRow>

      <PwRow cols={3}>
        <PwField label="I am a" htmlFor="bi-persona">
          <PwSelect id="bi-persona" {...register("primaryPersona")}>
            {Object.values(CandidatePersona).map((p) => (
              <option key={p} value={p}>
                {PERSONA_LABELS[p] ?? p}
              </option>
            ))}
          </PwSelect>
        </PwField>
        <PwField
          label="City"
          htmlFor="bi-city"
          error={errors.locationCity?.message}
        >
          <PwInput
            id="bi-city"
            placeholder="Enter your city"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.locationCity)}
            className={errors.locationCity ? "pw-invalid" : undefined}
            {...register("locationCity", { validate: lettersOnly("City") })}
          />
        </PwField>
        <PwField
          label="State / Region"
          htmlFor="bi-region"
          error={errors.locationRegion?.message}
        >
          <PwInput
            id="bi-region"
            placeholder="Enter your state"
            autoComplete="address-level1"
            aria-invalid={Boolean(errors.locationRegion)}
            className={errors.locationRegion ? "pw-invalid" : undefined}
            {...register("locationRegion", {
              validate: lettersOnly("State / region"),
            })}
          />
        </PwField>
      </PwRow>

      <PwRow cols={3}>
        <PwField
          label="Country"
          htmlFor="bi-country"
          error={errors.country?.message}
        >
          <PwSuggest
            id="bi-country"
            suggestions={COUNTRY_NAMES}
            placeholder="Start typing your country"
            autoComplete="country-name"
            aria-invalid={Boolean(errors.country)}
            className={errors.country ? "pw-invalid" : undefined}
            {...register("country", {
              validate: (v) =>
                v.trim() === "" || countryCodeForName(v) !== ""
                  ? true
                  : "Pick a country from the list",
            })}
          />
        </PwField>
        <PwField label="Gender" htmlFor="bi-gender">
          <PwSelect id="bi-gender" {...register("gender")}>
            <option value="">Prefer not to say</option>
            {Object.values(CandidateGender).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g] ?? g}
              </option>
            ))}
          </PwSelect>
        </PwField>
        <PwField label="Profile Headline" htmlFor="bi-headline">
          <PwInput
            id="bi-headline"
            maxLength={160}
            placeholder="Describe yourself in one line"
            {...register("headline")}
          />
        </PwField>
      </PwRow>

      <PwRow cols={1}>
        <PwField
          label="About"
          htmlFor="bi-summary"
          counter={`${summary.length}/2000`}
        >
          <PwTextarea
            id="bi-summary"
            rows={4}
            maxLength={2000}
            placeholder="Tell recruiters who you are."
            {...register("summary")}
          />
        </PwField>
      </PwRow>
    </form>
  );
}
