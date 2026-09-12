"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
} from "react-hook-form";
import {
  CERTIFICATE_PROVIDERS,
  KNOWN_COURSE_NAMES,
  providerForCourse,
} from "@/lib/certification-catalog";
import { MAX_CERTIFICATIONS } from "@/lib/validations/candidate-profile";
import { saveAccomplishmentsAction } from "@/app/actions/candidate-profile-actions";
import { useSectionSave } from "./use-section-save";
import { useProfileWizard } from "./wizard-context";
import {
  CURRENT_YEAR,
  PwAddMore,
  PwCheckbox,
  PwEntryCard,
  PwField,
  PwInput,
  PwMonthYear,
  PwRow,
  PwSuggest,
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
  /**
   * UI-only. A certificate that does not expire simply has no expiry date, so
   * this is derived on load and collapses back to nulls on save — there is no
   * column for it and none is needed.
   */
  noExpiry: boolean;
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
  noExpiry: false,
};

/** This month, so an issue date can never be picked in the future. */
const CURRENT_MONTH = new Date().getMonth() + 1;

const AWARDS_HELP =
  "Adding awards & accomplishments helps you stand out";
const AWARDS_PLACEHOLDER =
  "Mention your academic or extracurricular achievements where you were recognised for your performance";

/**
 * Issue and expiry for one certification.
 *
 * The issue date cannot be in the future — the year list stops at this year and
 * the month list stops at this month once that year is picked. Expiry collapses
 * entirely behind "This certificate does not expire", because a date input the
 * answer has made meaningless should not stay on screen.
 */
function CertificationDates({
  control,
  index,
}: {
  control: Control<FormValues>;
  index: number;
}) {
  const issuedYear = useWatch({
    control,
    name: `rows.${index}.issuedYear`,
  });
  const noExpiry = useWatch({ control, name: `rows.${index}.noExpiry` });

  return (
    <>
      <PwRow cols={2}>
        <PwField label="Issued" required>
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
                    fromYear={1975}
                    toYear={CURRENT_YEAR}
                    maxMonth={
                      year.value === CURRENT_YEAR ? CURRENT_MONTH : undefined
                    }
                  />
                )}
              />
            )}
          />
        </PwField>
        {noExpiry ? (
          <PwField label="Expires">
            <p className="pw-note-muted">This certificate does not expire.</p>
          </PwField>
        ) : (
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
                      fromYear={issuedYear ?? 1975}
                    />
                  )}
                />
              )}
            />
          </PwField>
        )}
      </PwRow>

      <PwRow cols={1}>
        <PwField>
          <Controller
            control={control}
            name={`rows.${index}.noExpiry`}
            render={({ field }) => (
              <PwCheckbox
                id={`crt-noexpiry-${index}`}
                checked={Boolean(field.value)}
                onChange={field.onChange}
              >
                This certificate does not expire
              </PwCheckbox>
            )}
          />
        </PwField>
      </PwRow>
    </>
  );
}

export function AccomplishmentsSection({
  verified,
  initial,
}: {
  verified: VerifiedAccomplishmentView[];
  initial: { rows: CertificationFormRow[]; awards: string };
}) {
  const { formId, onSaved, setDirty } = useProfileWizard();
  const { save } = useSectionSave(
    saveAccomplishmentsAction,
    "Accomplishments",
    "certifications",
  );
  const { control, register, handleSubmit, setValue, formState } =
    useForm<FormValues>({
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
        const payload = {
          ...v,
          rows: v.rows.map(({ noExpiry, ...row }) => ({
            ...row,
            expiresMonth: noExpiry ? null : row.expiresMonth,
            expiresYear: noExpiry ? null : row.expiresYear,
          })),
        };
        if (await save(payload)) onSaved();
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
                <PwSuggest
                  id={`crt-name-${index}`}
                  suggestions={KNOWN_COURSE_NAMES}
                  placeholder="Start typing your certification"
                  {...register(`rows.${index}.name`, {
                    onChange: (e: { target: { value: string } }) => {
                      // Picking a course we recognise fills its provider in.
                      const provider = providerForCourse(e.target.value);
                      if (provider) {
                        setValue(`rows.${index}.issuer`, provider, {
                          shouldDirty: true,
                        });
                      }
                    },
                  })}
                />
              </PwField>
              <PwField label="Issuer" required htmlFor={`crt-issuer-${index}`}>
                <PwSuggest
                  id={`crt-issuer-${index}`}
                  suggestions={CERTIFICATE_PROVIDERS}
                  placeholder="e.g. NPTEL, Coursera, Udemy"
                  {...register(`rows.${index}.issuer`)}
                />
              </PwField>
            </PwRow>

            <CertificationDates control={control} index={index} />

            <PwRow cols={1}>
              <PwField label="Credential URL" required htmlFor={`crt-url-${index}`}>
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
      {fields.length < MAX_CERTIFICATIONS ? (
        <PwAddMore onClick={() => append({ ...emptyCertificationRow })} />
      ) : (
        <p className="pw-sub-text">
          You have added the maximum of {MAX_CERTIFICATIONS} certifications.
        </p>
      )}

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
