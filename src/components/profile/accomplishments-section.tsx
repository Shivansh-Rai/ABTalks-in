"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { saveAccomplishmentsAction } from "@/app/actions/candidate-profile-actions";
import { useSectionSave } from "./use-section-save";
import { useProfileWizard } from "./wizard-context";
import {
  PwAddMore,
  PwEntryCard,
  PwField,
  PwInput,
  PwMonthYear,
  PwRow,
  PwTextarea,
} from "./wizard-fields";

export type CertificationFormRow = {
  name: string;
  issuer: string;
  issuedMonth: number | null;
  issuedYear: number | null;
  expiresMonth: number | null;
  expiresYear: number | null;
  credentialUrl: string;
};

/** Platform-derived; rendered read-only and never posted back. */
export type VerifiedAccomplishmentView = {
  key: string;
  title: string;
  detail: string | null;
  outcomeLabel: string;
};

type FormValues = { rows: CertificationFormRow[]; awards: string };

export const emptyCertificationRow: CertificationFormRow = {
  name: "",
  issuer: "",
  issuedMonth: null,
  issuedYear: null,
  expiresMonth: null,
  expiresYear: null,
  credentialUrl: "",
};

const AWARDS_HELP =
  "Adding awards & accomplishments helps you stand out";
const AWARDS_PLACEHOLDER =
  "Mention your academic or extracurricular achievements where you were recognised for your performance";

export function AccomplishmentsSection({
  verified,
  initial,
}: {
  verified: VerifiedAccomplishmentView[];
  initial: { rows: CertificationFormRow[]; awards: string };
}) {
  const { formId, onSaved, setDirty } = useProfileWizard();
  const { save } = useSectionSave(saveAccomplishmentsAction, "Accomplishments");
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: {
      rows:
        initial.rows.length > 0 ? initial.rows : [{ ...emptyCertificationRow }],
      awards: initial.awards,
    },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "rows",
  });

  useEffect(() => {
    setDirty(formState.isDirty);
  }, [formState.isDirty, setDirty]);

  function removeOrClear(index: number) {
    if (fields.length === 1) {
      replace([{ ...emptyCertificationRow }]);
      return;
    }
    remove(index);
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(async (v) => {
        if (await save(v)) onSaved();
      })}
    >
      {/* ---- A. Verified — platform records, not editable ---- */}
      <div className="pw-verified-head">
        <div className="pw-verified-copy">
          <h3 className="pw-sub-title">Verified Accomplishments</h3>
          <p className="pw-sub-text">
            Your accomplishments as seen on ABTalks. 
          </p>
        </div>
        <Link href="/achievements" className="pw-btn-action pw-btn-quiet">
          <svg viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="9" r="6" />
            <path d="M15.5 13.5 17 22l-5-2.8L7 22l1.5-8.5" />
          </svg>
          View Your Certificates
        </Link>
      </div>

      {verified.length > 0 ? (
        <ul className="pw-verified-list">
          {verified.map((item) => (
            <li className="pw-verified-item" key={item.key}>
              <span className="pw-verified-tick" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="pw-verified-body">
                <span className="pw-verified-title">{item.title}</span>
                {item.detail ? (
                  <span className="pw-verified-detail">{item.detail}</span>
                ) : null}
              </span>
              <span className="pw-verified-pill">{item.outcomeLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pw-verified-empty">
          Nothing here yet. Finish a challenge, a cohort or ViCoDathon and it
          appears automatically.
        </p>
      )}

      {/* ---- B. Certifications — the candidate's own external certs ---- */}
      <h3 className="pw-sub-title pw-sub-spaced">Certifications</h3>
      <p className="pw-sub-text pw-sub-spaced">
            Add details of your certification. 
          </p>
    

      <div className="pw-entries">
        {fields.map((field, index) => (
          <PwEntryCard
            key={field.id}
            index={index}
            title="Certification"
            onRemove={() => removeOrClear(index)}
          >
            <PwRow cols={2}>
              <PwField label="Name" required htmlFor={`crt-name-${index}`}>
                <PwInput
                  id={`crt-name-${index}`}
                  placeholder="Enter your certification name"
                  {...register(`rows.${index}.name`, { required: true })}
                />
              </PwField>
              <PwField label="Issuer" required htmlFor={`crt-issuer-${index}`}>
                <PwInput
                  id={`crt-issuer-${index}`}
                  placeholder="Enter your certification issuer"
                  {...register(`rows.${index}.issuer`, { required: true })}
                />
              </PwField>
            </PwRow>

            <PwRow cols={2}>
              <PwField label="Issued">
                <Controller
                  control={control}
                  name={`rows.${index}.issuedMonth`}
                  render={({ field: month }) => (
                    <Controller
                      control={control}
                      name={`rows.${index}.issuedYear`}
                      render={({ field: year }) => (
                        <PwMonthYear
                          month={month.value}
                          year={year.value}
                          onMonthChange={month.onChange}
                          onYearChange={year.onChange}
                        />
                      )}
                    />
                  )}
                />
              </PwField>
              <PwField label="Expires">
                <Controller
                  control={control}
                  name={`rows.${index}.expiresMonth`}
                  render={({ field: month }) => (
                    <Controller
                      control={control}
                      name={`rows.${index}.expiresYear`}
                      render={({ field: year }) => (
                        <PwMonthYear
                          month={month.value}
                          year={year.value}
                          onMonthChange={month.onChange}
                          onYearChange={year.onChange}
                        />
                      )}
                    />
                  )}
                />
              </PwField>
            </PwRow>

            <PwRow cols={1}>
              <PwField label="Credential URL" htmlFor={`crt-url-${index}`}>
                <PwInput
                  id={`crt-url-${index}`}
                  type="url"
                  inputMode="url"
                  placeholder="Please mention your completion URL"
                  {...register(`rows.${index}.credentialUrl`)}
                />
              </PwField>
            </PwRow>
          </PwEntryCard>
        ))}
      </div>
      <PwAddMore onClick={() => append({ ...emptyCertificationRow })} />

      {/* ---- C. Awards — one prose field, not repeatable entries ---- */}
      <h3 className="pw-sub-title pw-sub-spaced">Awards</h3>
      <p className="pw-sub-text">{AWARDS_HELP}</p>

      <PwRow cols={1}>
        <PwField htmlFor="awards" area>
          <PwTextarea
            id="awards"
            rows={6}
            maxLength={4000}
            placeholder={AWARDS_PLACEHOLDER}
            {...register("awards")}
          />
        </PwField>
      </PwRow>
    </form>
  );
}
